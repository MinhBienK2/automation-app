import nodeFs from "node:fs";
import path from "node:path";
import type { DatabaseSync } from "node:sqlite";
import type {
  Project,
  ProjectEnvironment,
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
import type { WorkflowRepository } from "../persistence/workflowRepository.js";
import { commandError } from "../commandHelpers.js";
import { browserProfileKey } from "../runtime/runManager.js";

type RunConflict = {
  message: string;
  field: string;
};

type ProjectCommandCascadeDeps = {
  database: DatabaseSync;
  browserProfilesDir: string;
  repository: WorkflowRepository;
  projectPackageService: ProjectPackageService;
  requireProject: (projectId: string) => Project;
  requireProjectEnvironment: (environmentId: string) => ProjectEnvironment;
  ensureDefaultProjectEnvironment: (project: Project) => ProjectEnvironment;
  createWorkflow: (name: string, options?: WorkflowCreateOptions) => Workflow;
  getSettings: (workflowId: string) => WorkflowSettings;
  saveSettings: (workflowId: string, settings: WorkflowSettings) => WorkflowSettings;
  assertWorkflowDeletionAllowed: (workflowId: string, settings: WorkflowSettings) => void;
  activeRunConflict: (workflowId: string, settings: WorkflowSettings) => RunConflict | null;
  retainedSessionActiveFor: (workflowId: string, profileName: string) => boolean;
  remapCallSubflowIds: (
    graph: WorkflowGraph,
    subflowIdMap: Map<string, string>,
  ) => WorkflowGraph;
};

export function projectEnvironmentProfileKey(environment: ProjectEnvironment) {
  if (environment.browser_launch.session_mode !== "persistent_profile") return null;
  return (
    environment.browser_launch.profile_dir?.trim() ||
    environment.browser_launch.profile_name?.trim() ||
    null
  );
}

export function duplicateProjectWorkflowSettings(
  sourceSettings: WorkflowSettings,
  created: Workflow,
  browserLaunch: WorkflowSettings["browser_launch"],
): WorkflowSettings {
  const copied = structuredClone(sourceSettings);
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
  function usedFingerprintSeeds(exceptWorkflowId?: string) {
    return new Set(
      deps.repository
        .listWorkflows()
        .filter((workflow) => workflow.id !== exceptWorkflowId)
        .map((workflow) => deps.getSettings(workflow.id).browser_launch.fingerprint_seed)
        .filter((seed): seed is string => Boolean(seed)),
    );
  }

  function usedProjectEnvironmentFingerprintSeeds() {
    const seeds = usedFingerprintSeeds();
    for (const project of deps.repository.listProjects()) {
      for (const environment of deps.repository.listProjectEnvironments(project.id)) {
        const seed = environment.browser_launch?.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  function duplicateProjectBrowserLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
  ): WorkflowSettings["browser_launch"] {
    const identityId = createHighEntropyBrowserIdentityId();
    return {
      ...browserLaunch,
      identity_id: identityId,
      profile_dir: identityId,
      profile_name:
        browserLaunch.session_mode === "persistent_profile" ? identityId : null,
      fingerprint_seed: deriveFingerprintSeedFromIdentityId(
        identityId,
        usedProjectEnvironmentFingerprintSeeds(),
      ),
    };
  }

  function assertCanResetProjectEnvironmentBrowserIdentity(
    environment: ProjectEnvironment,
  ) {
    for (const workflow of deps.repository.listWorkflows()) {
      if (workflow.environment_id !== environment.id) continue;
      const settings = {
        ...deps.getSettings(workflow.id),
        browser_launch: environment.browser_launch,
      };
      const conflict = deps.activeRunConflict(workflow.id, settings);
      if (conflict) throw commandError(conflict.message, conflict.field);
      const profileName = browserProfileKey(settings);
      if (profileName && deps.retainedSessionActiveFor(workflow.id, profileName)) {
        throw commandError(
          "Close the retained browser session before resetting this project identity",
          "browser_launch.profile_dir",
        );
      }
    }
  }

  function deleteProjectEnvironmentProfileDirectoryIfPrivate(
    environmentId: string,
    profileDir: string | null,
    nextProfileDir: string | null,
  ) {
    if (
      !profileDir ||
      profileDir === nextProfileDir ||
      isProfileReferencedOutsideProjectEnvironment(environmentId, profileDir)
    ) {
      return;
    }
    nodeFs.rmSync(path.join(deps.browserProfilesDir, sanitizePathSegment(profileDir)), {
      recursive: true,
      force: true,
    });
  }

  function isProfileReferencedOutsideProjectEnvironment(
    environmentId: string,
    profileDir: string,
  ) {
    for (const project of deps.repository.listProjects()) {
      for (const environment of deps.repository.listProjectEnvironments(project.id)) {
        if (environment.id === environmentId) continue;
        if (projectEnvironmentProfileKey(environment) === profileDir) return true;
      }
    }
    return deps.repository
      .listWorkflows()
      .some((workflow) => {
        if (workflow.environment_id === environmentId) return false;
        return browserProfileKey(deps.getSettings(workflow.id)) === profileDir;
      });
  }

  function isProfileReferencedOutsideProject(
    projectId: string,
    workflowIds: Set<string>,
    profileDir: string,
  ) {
    for (const project of deps.repository.listProjects()) {
      if (project.id === projectId) continue;
      for (const environment of deps.repository.listProjectEnvironments(project.id)) {
        if (projectEnvironmentProfileKey(environment) === profileDir) return true;
      }
    }
    return deps.repository
      .listWorkflows()
      .some((workflow) => {
        if (workflowIds.has(workflow.id)) return false;
        return browserProfileKey(deps.getSettings(workflow.id)) === profileDir;
      });
  }

  function rotateProjectEnvironmentBrowserIdentity(
    environmentId: string,
  ): ProjectEnvironment {
    const environment = deps.requireProjectEnvironment(environmentId);
    assertCanResetProjectEnvironmentBrowserIdentity(environment);
    const oldProfileDir = projectEnvironmentProfileKey(environment);
    const identityId = createHighEntropyBrowserIdentityId();
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      usedProjectEnvironmentFingerprintSeeds(),
    );
    const updated = deps.repository.updateProjectEnvironment(environment.id, {
      browser_launch: {
        ...environment.browser_launch,
        identity_id: identityId,
        profile_dir: identityId,
        profile_name:
          environment.browser_launch.session_mode === "persistent_profile"
            ? identityId
            : null,
        fingerprint_seed: fingerprintSeed,
      },
    });
    if (!updated) throw commandError("Project environment not found", "environmentId");
    deleteProjectEnvironmentProfileDirectoryIfPrivate(
      environment.id,
      oldProfileDir,
      projectEnvironmentProfileKey(updated),
    );
    return updated;
  }

  function duplicateProjectCascade(projectId: string): Project {
    const sourceProject = deps.requireProject(projectId);
    const sourceEnvironments = deps.repository.listProjectEnvironments(sourceProject.id);
    const sourceSubflows = deps.repository
      .listSubflows(sourceProject.id)
      .map((subflow) => deps.repository.getSubflow(subflow.id))
      .filter((subflow): subflow is Subflow => Boolean(subflow));
    const sourceWorkflows = deps.repository
      .listWorkflows()
      .filter((workflow) => workflow.project_id === sourceProject.id);

    deps.database.exec("BEGIN IMMEDIATE");
    try {
      const createdProject = deps.repository.createProject(
        `Copy of ${sourceProject.name}`,
        sourceProject.description,
      );
      for (const environment of sourceEnvironments) {
        deps.repository.createProjectEnvironment(createdProject.id, {
          name: environment.name,
          description: environment.description,
          is_default: environment.is_default,
          browser_launch: duplicateProjectBrowserLaunch(environment.browser_launch),
        });
      }
      deps.ensureDefaultProjectEnvironment(createdProject);

      const subflowIdMap = new Map<string, string>();
      for (const subflow of sourceSubflows) {
        const copiedSubflow = deps.repository.createSubflow(
          createdProject.id,
          subflow.name,
          subflow.description,
          subflow.graph,
        );
        subflowIdMap.set(subflow.id, copiedSubflow.id);
      }

      for (const workflow of sourceWorkflows) {
        const copiedWorkflow = deps.createWorkflow(workflow.name, {
          project_id: createdProject.id,
        });
        const graph = deps.repository.getWorkflowGraph(workflow.id);
        if (graph) {
          deps.repository.saveWorkflowGraph(
            copiedWorkflow.id,
            deps.remapCallSubflowIds(graph, subflowIdMap),
          );
        }
        const settings = deps.repository.getWorkflowSettings(workflow.id);
        if (settings) {
          deps.saveSettings(
            copiedWorkflow.id,
            duplicateProjectWorkflowSettings(
              settings,
              copiedWorkflow,
              duplicateProjectBrowserLaunch(settings.browser_launch),
            ),
          );
        }
      }

      deps.database.exec("COMMIT");
      return createdProject;
    } catch (error) {
      deps.database.exec("ROLLBACK");
      throw error;
    }
  }

  function importProjectPackageCascade(packageValue: ProjectPackage): Project {
    const preparedImport = deps.projectPackageService.prepareImport({ packageValue });
    deps.database.exec("BEGIN IMMEDIATE");
    try {
      const createdProject = deps.repository.createProject(
        preparedImport.importedName,
        preparedImport.description,
      );
      for (const environment of preparedImport.environments) {
        deps.repository.createProjectEnvironment(createdProject.id, {
          name: environment.name,
          description: environment.description,
          is_default: environment.is_default,
          browser_launch: duplicateProjectBrowserLaunch(environment.browser_launch),
        });
      }
      deps.ensureDefaultProjectEnvironment(createdProject);

      const subflowIdMap = new Map<string, string>();
      for (const subflow of preparedImport.subflows) {
        const createdSubflow = deps.repository.createSubflow(
          createdProject.id,
          subflow.name,
          subflow.description,
          migrateWorkflowGraph(subflow.graph),
        );
        subflowIdMap.set(subflow.id, createdSubflow.id);
      }

      for (const packagedWorkflow of preparedImport.workflows) {
        const createdWorkflow = deps.createWorkflow(packagedWorkflow.name, {
          project_id: createdProject.id,
        });
        if (packagedWorkflow.flow) {
          deps.repository.saveWorkflowGraph(
            createdWorkflow.id,
            deps.remapCallSubflowIds(packagedWorkflow.flow, subflowIdMap),
          );
        }
        if (packagedWorkflow.settings) {
          deps.saveSettings(createdWorkflow.id, {
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
            browser_launch: duplicateProjectBrowserLaunch(
              packagedWorkflow.settings.browser_launch,
            ),
            created_at: createdWorkflow.created_at,
            updated_at: createdWorkflow.updated_at,
          });
        }
      }

      deps.database.exec("COMMIT");
      return createdProject;
    } catch (error) {
      deps.database.exec("ROLLBACK");
      throw error;
    }
  }

  function deleteProjectCascade(projectId: string) {
    const project = deps.requireProject(projectId);
    const workflows = deps.repository
      .listWorkflows()
      .filter((workflow) => workflow.project_id === project.id);
    const workflowIds = new Set(workflows.map((workflow) => workflow.id));
    for (const workflow of workflows) {
      deps.assertWorkflowDeletionAllowed(workflow.id, deps.getSettings(workflow.id));
    }

    const profileDirs = new Set<string>();
    for (const environment of deps.repository.listProjectEnvironments(project.id)) {
      const profileDir = projectEnvironmentProfileKey(environment);
      if (profileDir) profileDirs.add(profileDir);
    }
    for (const workflow of workflows) {
      const profileDir = browserProfileKey(deps.getSettings(workflow.id));
      if (profileDir) profileDirs.add(profileDir);
    }
    const deletableProfileDirs = [...profileDirs].filter(
      (profileDir) => !isProfileReferencedOutsideProject(project.id, workflowIds, profileDir),
    );

    deps.database.exec("BEGIN IMMEDIATE");
    try {
      deps.repository.deleteProject(project.id);
      deps.database.exec("COMMIT");
    } catch (error) {
      deps.database.exec("ROLLBACK");
      throw error;
    }

    for (const profileDir of deletableProfileDirs) {
      nodeFs.rmSync(path.join(deps.browserProfilesDir, sanitizePathSegment(profileDir)), {
        recursive: true,
        force: true,
      });
    }
  }

  return {
    rotateProjectEnvironmentBrowserIdentity,
    duplicateProjectCascade,
    importProjectPackageCascade,
    deleteProjectCascade,
  };
}
