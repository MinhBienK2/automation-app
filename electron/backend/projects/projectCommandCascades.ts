import nodeFs from "node:fs";
import path from "node:path";
import type { DbAdapter } from "../db/dbAdapter.js";
import type {
  Project,
  BrowserProfile,
  ProjectPackage,
  Subflow,
  Workflow,
  WorkflowCreateOptions,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import { sanitizePathSegment } from "../evidence/artifacts.js";
import { migrateWorkflowGraph } from "../graph/migration.js";
import type { ProjectPackageService } from "../services/projectPackageService.js";
import {
  createHighEntropyBrowserIdentityId,
  deriveFingerprintSeedFromIdentityId,
} from "../services/workflowSettingsService.js";
import { WorkflowRepository } from "../repositories/workflowRepository.js";
import { commandError } from "../commandHelpers.js";
import { browserProfileKey } from "../runtime/runManager.js";
import { personaForSeed } from "../../../src/lib/personaCatalog.js";

type RunConflict = {
  message: string;
  field: string;
};

type ProjectCommandCascadeDeps = {
  database: DbAdapter;
  browserProfilesDir: string;
  repository: WorkflowRepository;
  projectPackageService: ProjectPackageService;
  requireProject: (projectId: string) => Promise<Project>;
  requireBrowserProfile: (browserProfileId: string) => Promise<BrowserProfile>;
  ensureDefaultBrowserProfile: (project: Project) => Promise<BrowserProfile>;
  createWorkflow: (name: string, options?: WorkflowCreateOptions) => Promise<Workflow>;
  getSettings: (workflowId: string) => Promise<WorkflowSettings>;
  saveSettings: (workflowId: string, settings: WorkflowSettings) => Promise<WorkflowSettings>;
  assertWorkflowDeletionAllowed: (workflowId: string, settings: WorkflowSettings) => void;
  activeRunConflict: (workflowId: string, settings: WorkflowSettings) => RunConflict | null;
  retainedSessionActiveFor: (workflowId: string, profileName: string) => boolean;
  remapCallSubflowIds: (
    graph: WorkflowGraph,
    subflowIdMap: Map<string, string>,
  ) => WorkflowGraph;
};

export function getBrowserProfileKey(profile: BrowserProfile) {
  if (profile.browser_launch.session_mode !== "persistent_profile") return null;
  return (
    profile.browser_launch.profile_dir?.trim() ||
    profile.browser_launch.profile_name?.trim() ||
    null
  );
}

export function duplicateProjectWorkflowSettings(
  sourceSettings: WorkflowSettings,
  created: Workflow,
  browserLaunch: WorkflowSettings["browser_launch"],
): WorkflowSettings {
  let copied: WorkflowSettings;
  try {
    copied = structuredClone(sourceSettings);
  } catch {
    copied = JSON.parse(JSON.stringify(sourceSettings)) as WorkflowSettings;
  }
  return {
    ...copied,
    workflow_id: created.id,
    general: {
      ...copied.general,
      name: created.name,
      created_at: created.created_at,
      updated_at: created.updated_at,
    },
    run_policy: {
      ...copied.run_policy,
      run_from_selected_enabled: false,
    },
    browser_launch: browserLaunch,
    created_at: created.created_at,
    updated_at: created.updated_at,
  };
}

export function createProjectCommandCascades(deps: ProjectCommandCascadeDeps) {
  async function usedFingerprintSeeds(exceptWorkflowId?: string) {
    const workflows = await deps.repository.listWorkflows();
    const seeds = new Set<string>();
    for (const workflow of workflows) {
      if (workflow.id === exceptWorkflowId) continue;
      const settings = await deps.getSettings(workflow.id);
      if (settings.browser_launch.fingerprint_seed) {
        seeds.add(settings.browser_launch.fingerprint_seed);
      }
    }
    return seeds;
  }

  async function usedBrowserProfileFingerprintSeeds() {
    const seeds = await usedFingerprintSeeds();
    const projects = await deps.repository.listProjects();
    for (const project of projects) {
      const profiles = await deps.repository.listBrowserProfiles(project.id);
      for (const profile of profiles) {
        const seed = profile.browser_launch?.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  async function duplicateProjectBrowserLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
  ): Promise<WorkflowSettings["browser_launch"]> {
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds();
    return {
      ...browserLaunch,
      identity_id: identityId,
      profile_dir: identityId,
      profile_name:
        browserLaunch.session_mode === "persistent_profile" ? identityId : null,
      fingerprint_seed: deriveFingerprintSeedFromIdentityId(
        identityId,
        seeds,
      ),
    };
  }

  async function assertCanResetBrowserProfileIdentity(
    profile: BrowserProfile,
  ) {
    const workflows = await deps.repository.listWorkflows();
    for (const workflow of workflows) {
      if (workflow.browser_profile_id !== profile.id) continue;
      const settings = {
        ...(await deps.getSettings(workflow.id)),
        browser_launch: profile.browser_launch,
      };
      const conflict = deps.activeRunConflict(workflow.id, settings);
      if (conflict) throw commandError(conflict.message, conflict.field);
      const profileName = browserProfileKey(settings);
      if (profileName && deps.retainedSessionActiveFor(workflow.id, profileName)) {
        throw commandError(
          "Close the retained browser session before resetting this project settings",
          "browser_launch.profile_dir",
        );
      }
    }
  }

  async function deleteBrowserProfileDirectoryIfPrivate(
    browserProfileId: string,
    profileDir: string | null,
    nextProfileDir: string | null,
  ) {
    if (
      !profileDir ||
      profileDir === nextProfileDir ||
      await isProfileReferencedOutsideBrowserProfile(browserProfileId, profileDir)
    ) {
      return;
    }
    nodeFs.rmSync(path.join(deps.browserProfilesDir, sanitizePathSegment(profileDir)), {
      recursive: true,
      force: true,
    });
  }

  async function isProfileReferencedOutsideBrowserProfile(
    browserProfileId: string,
    profileDir: string,
  ) {
    const projects = await deps.repository.listProjects();
    for (const project of projects) {
      const profiles = await deps.repository.listBrowserProfiles(project.id);
      for (const profile of profiles) {
        if (profile.id === browserProfileId) continue;
        if (getBrowserProfileKey(profile) === profileDir) return true;
      }
    }
    const workflows = await deps.repository.listWorkflows();
    for (const workflow of workflows) {
      if (workflow.browser_profile_id === browserProfileId) continue;
      const settings = await deps.getSettings(workflow.id);
      if (browserProfileKey(settings) === profileDir) return true;
    }
    return false;
  }

  async function isProfileReferencedOutsideProject(
    projectId: string,
    workflowIds: Set<string>,
    profileDir: string,
  ) {
    const projects = await deps.repository.listProjects();
    for (const project of projects) {
      if (project.id === projectId) continue;
      const profiles = await deps.repository.listBrowserProfiles(project.id);
      for (const profile of profiles) {
        if (getBrowserProfileKey(profile) === profileDir) return true;
      }
    }
    const workflows = await deps.repository.listWorkflows();
    for (const workflow of workflows) {
      if (workflowIds.has(workflow.id)) return false;
      const settings = await deps.getSettings(workflow.id);
      if (browserProfileKey(settings) === profileDir) return true;
    }
    return false;
  }

  async function rotateBrowserProfileIdentity(
    browserProfileId: string,
  ): Promise<BrowserProfile> {
    const profile = await deps.requireBrowserProfile(browserProfileId);
    await assertCanResetBrowserProfileIdentity(profile);
    const oldProfileDir = getBrowserProfileKey(profile);
    const identityId = createHighEntropyBrowserIdentityId();
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      await usedBrowserProfileFingerprintSeeds(),
    );
    const updated = await deps.repository.updateBrowserProfile(profile.id, {
      browser_launch: {
        ...profile.browser_launch,
        identity_id: identityId,
        profile_dir: identityId,
        profile_name:
          profile.browser_launch.session_mode === "persistent_profile"
            ? identityId
            : null,
        fingerprint_seed: fingerprintSeed,
      },
    });
    if (!updated) throw commandError("Browser profile not found", "browserProfileId");
    await deleteBrowserProfileDirectoryIfPrivate(
      profile.id,
      oldProfileDir,
      getBrowserProfileKey(updated),
    );
    return updated;
  }

  async function duplicateProjectCascade(projectId: string): Promise<Project> {
    const sourceProject = await deps.requireProject(projectId);
    const sourceProfiles = await deps.repository.listBrowserProfiles(sourceProject.id);
    const subflowSummaries = await deps.repository.listSubflows(sourceProject.id);
    const sourceSubflows: Subflow[] = [];
    for (const subflowSummary of subflowSummaries) {
      const subflow = await deps.repository.getSubflow(subflowSummary.id);
      if (subflow) sourceSubflows.push(subflow);
    }
    const allWorkflows = await deps.repository.listWorkflows();
    const sourceWorkflows = allWorkflows.filter((workflow) => workflow.project_id === sourceProject.id);

    return await deps.database.transaction(async (tx) => {
      const txRepository = new WorkflowRepository(tx);
      const createdProject = await txRepository.createProject(
        `Copy of ${sourceProject.name}`,
        sourceProject.description,
      );
      const browserProfileIdMap = new Map<string, string>();
      for (const profile of sourceProfiles) {
        const launchConfig = await duplicateProjectBrowserLaunch(profile.browser_launch);
        const copiedProfile = await txRepository.createBrowserProfile(createdProject.id, {
          name: profile.name,
          description: profile.description,
          is_default: profile.is_default,
          browser_launch: launchConfig,
          environment: profile.environment,
        });
        browserProfileIdMap.set(profile.id, copiedProfile.id);
      }
      
      // Ensure default profile inside transaction context
      const defaultProfile = await txRepository.getDefaultBrowserProfile(createdProject.id);
      if (!defaultProfile) {
        const identity_id = createHighEntropyBrowserIdentityId();
        const defaultLaunch = {
          identity_id,
          display_name: "Default Profile",
          session_mode: "persistent_profile" as const,
          profile_dir: identity_id,
          profile_name: "Default Profile",
          proxy_enabled: false,
          proxy_server: "",
          proxy_bypass: "",
          webrtc_policy: "default" as const,
          timezone: "",
          locale: "",
          geoip: true,
          headless: false,
          humanize: true,
          human_preset: "default" as const,
          fingerprint_seed: "",
          persona_id: personaForSeed(identity_id).id,
          persona: personaForSeed(identity_id),
          font_strategy: "default" as const,
          override_fonts: [],
        };
        await txRepository.createBrowserProfile(createdProject.id, {
          name: "Default Profile",
          description: "System created default profile",
          is_default: true,
          browser_launch: defaultLaunch,
        });
      }

      const subflowIdMap = new Map<string, string>();
      for (const subflow of sourceSubflows) {
        const copiedSubflow = await txRepository.createSubflow(
          createdProject.id,
          subflow.name,
          subflow.description,
          subflow.graph,
        );
        subflowIdMap.set(subflow.id, copiedSubflow.id);
      }

      for (const workflow of sourceWorkflows) {
        const copiedWorkflow = await txRepository.createWorkflow(
          workflow.name,
          { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
          new Date(),
          { projectId: createdProject.id }
        );
        const selectedProfileId = workflow.browser_profile_id
          ? browserProfileIdMap.get(workflow.browser_profile_id) ?? null
          : null;
        if (selectedProfileId) {
          await txRepository.assignWorkflowBrowserProfile(
            copiedWorkflow.id,
            selectedProfileId,
          );
        }
        const selectedProfile = selectedProfileId
          ? await txRepository.getBrowserProfile(selectedProfileId)
          : null;
        const graph = await deps.repository.getWorkflowGraph(workflow.id);
        if (graph) {
          await txRepository.saveWorkflowGraph(
            copiedWorkflow.id,
            deps.remapCallSubflowIds(graph, subflowIdMap),
          );
        }
        const settings = await deps.repository.getWorkflowSettings(workflow.id);
        if (settings) {
          const duplicatedSettings = duplicateProjectWorkflowSettings(
            settings,
            copiedWorkflow,
            selectedProfile?.browser_launch ??
              (await txRepository.getWorkflowSettings(copiedWorkflow.id))?.browser_launch ?? settings.browser_launch,
          );
          await txRepository.saveWorkflowSettings(copiedWorkflow.id, duplicatedSettings);
        }
      }

      return createdProject;
    });
  }

  async function importProjectPackageCascade(packageValue: ProjectPackage): Promise<Project> {
    const preparedImport = deps.projectPackageService.prepareImport({ packageValue });
    return await deps.database.transaction(async (tx) => {
      const txRepository = new WorkflowRepository(tx);
      const createdProject = await txRepository.createProject(
        preparedImport.importedName,
        preparedImport.description,
      );
      const browserProfileIdMap = new Map<string, string>();
      const profilesSource = preparedImport.browser_profiles ?? [];
      for (const profile of profilesSource) {
        const launchConfig = await duplicateProjectBrowserLaunch(profile.browser_launch);
        const createdProfile = await txRepository.createBrowserProfile(createdProject.id, {
          name: profile.name,
          description: profile.description,
          is_default: profile.is_default,
          browser_launch: launchConfig,
          environment: profile.environment,
        });
        browserProfileIdMap.set(profile.id, createdProfile.id);
      }
      
      // Ensure default profile
      const defaultProfile = await txRepository.getDefaultBrowserProfile(createdProject.id);
      if (!defaultProfile) {
        const identity_id = createHighEntropyBrowserIdentityId();
        const defaultLaunch = {
          identity_id,
          display_name: "Default Profile",
          session_mode: "persistent_profile" as const,
          profile_dir: identity_id,
          profile_name: "Default Profile",
          proxy_enabled: false,
          proxy_server: "",
          proxy_bypass: "",
          webrtc_policy: "default" as const,
          timezone: "",
          locale: "",
          geoip: true,
          headless: false,
          humanize: true,
          human_preset: "default" as const,
          fingerprint_seed: "",
          persona_id: personaForSeed(identity_id).id,
          persona: personaForSeed(identity_id),
          font_strategy: "default" as const,
          override_fonts: [],
        };
        await txRepository.createBrowserProfile(createdProject.id, {
          name: "Default Profile",
          description: "System created default profile",
          is_default: true,
          browser_launch: defaultLaunch,
        });
      }

      const subflowIdMap = new Map<string, string>();
      for (const subflow of preparedImport.subflows) {
        const createdSubflow = await txRepository.createSubflow(
          createdProject.id,
          subflow.name,
          subflow.description,
          migrateWorkflowGraph(subflow.graph),
        );
        subflowIdMap.set(subflow.id, createdSubflow.id);
      }

      for (const packagedWorkflow of preparedImport.workflows) {
        const createdWorkflow = await txRepository.createWorkflow(
          packagedWorkflow.name,
          { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
          new Date(),
          { projectId: createdProject.id }
        );
        const workflowProfileId = packagedWorkflow.browser_profile_id;
        const selectedProfileId = workflowProfileId
          ? browserProfileIdMap.get(workflowProfileId) ?? null
          : null;
        if (selectedProfileId) {
          await txRepository.assignWorkflowBrowserProfile(
            createdWorkflow.id,
            selectedProfileId,
          );
        }
        const selectedProfile = selectedProfileId
          ? await txRepository.getBrowserProfile(selectedProfileId)
          : null;
        if (packagedWorkflow.flow) {
          await txRepository.saveWorkflowGraph(
            createdWorkflow.id,
            deps.remapCallSubflowIds(packagedWorkflow.flow, subflowIdMap),
          );
        }
        if (packagedWorkflow.settings) {
          await txRepository.saveWorkflowSettings(createdWorkflow.id, {
            ...packagedWorkflow.settings,
            workflow_id: createdWorkflow.id,
            general: {
              ...packagedWorkflow.settings.general,
              name: createdWorkflow.name,
              created_at: createdWorkflow.created_at,
              updated_at: createdWorkflow.updated_at,
            },
            run_policy: {
              ...packagedWorkflow.settings.run_policy,
              run_from_selected_enabled: false,
            },
            browser_launch: selectedProfile?.browser_launch ??
              (await txRepository.getWorkflowSettings(createdWorkflow.id))?.browser_launch ?? packagedWorkflow.settings.browser_launch,
            created_at: createdWorkflow.created_at,
            updated_at: createdWorkflow.updated_at,
          });
        }
      }

      return createdProject;
    });
  }

  async function deleteProjectCascade(projectId: string) {
    const project = await deps.requireProject(projectId);
    const workflows = (await deps.repository.listWorkflows())
      .filter((workflow) => workflow.project_id === project.id);
    const workflowIds = new Set(workflows.map((workflow) => workflow.id));
    for (const workflow of workflows) {
      deps.assertWorkflowDeletionAllowed(workflow.id, await deps.getSettings(workflow.id));
    }

    const profileDirs = new Set<string>();
    for (const profile of await deps.repository.listBrowserProfiles(project.id)) {
      const profileDir = getBrowserProfileKey(profile);
      if (profileDir) profileDirs.add(profileDir);
    }
    for (const workflow of workflows) {
      const profileDir = browserProfileKey(await deps.getSettings(workflow.id));
      if (profileDir) profileDirs.add(profileDir);
    }
    const deletableProfileDirs = [];
    for (const profileDir of profileDirs) {
      if (!(await isProfileReferencedOutsideProject(project.id, workflowIds, profileDir))) {
        deletableProfileDirs.push(profileDir);
      }
    }

    await deps.database.transaction(async (tx) => {
      const txRepository = new WorkflowRepository(tx);
      for (const w of workflows) {
        await txRepository.deleteWorkflow(w.id);
      }
      const subflows = await txRepository.listSubflows(project.id);
      for (const sf of subflows) {
        await txRepository.deleteSubflow(sf.id);
      }
      const profiles = await txRepository.listBrowserProfiles(project.id);
      for (const p of profiles) {
        await txRepository.deleteBrowserProfile(p.id);
      }
      await txRepository.deleteProject(project.id);
    });

    for (const profileDir of deletableProfileDirs) {
      nodeFs.rmSync(path.join(deps.browserProfilesDir, sanitizePathSegment(profileDir)), {
        recursive: true,
        force: true,
      });
    }
  }

  return {
    rotateBrowserProfileIdentity,
    duplicateProjectCascade,
    importProjectPackageCascade,
    deleteProjectCascade,
  };
}
