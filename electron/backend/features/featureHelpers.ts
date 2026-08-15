import { randomUUID } from "node:crypto";
import { migrateWorkflowGraph } from "../graph/migration.js";
import { commandError, createDraftGraph } from "../commandHelpers.js";
import type { CommandContext } from "./types.js";
import type {
  BrowserProfile,
  Project,
  Workflow,
  WorkflowCreateOptions,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import type { WorkflowRepository } from "./workflows/workflowRepository.js";
import type { RunManager } from "../runtime/runManager.js";
import type { WorkflowSettingsService } from "./workflows/workflowSettingsService.js";
import {
  createHighEntropyBrowserIdentityId,
  deriveFingerprintSeedFromIdentityId,
} from "./workflows/workflowSettingsService.js";

export function createFeatureHelpers(
  context: CommandContext,
  deps: {
    repository: WorkflowRepository;
    runManager: RunManager;
    settingsService: WorkflowSettingsService;
  }
) {
  const { repository, runManager, settingsService } = deps;

  async function ensureProjectModelReady() {
    if (!context.database.ownerId) return;
    await runManager.recoverInterruptedRuns();
    const list = await repository.listProjects();
    const project = list[0];
    if (project) {
      await ensureDefaultBrowserProfile(project);
      const workflows = await repository.listWorkflows();
      for (const workflow of workflows) {
        const projectId = workflow.project_id ?? project.id;
        if (!workflow.project_id) {
          await repository.assignWorkflowProject(workflow.id, projectId);
        }
        const current = await repository.getWorkflowSummary(workflow.id);
        if (!current?.browser_profile_id) {
          const ownerProject = (await repository.getProject(projectId)) ?? project;
          const browserProfile = await ensureDefaultBrowserProfile(ownerProject);
          await repository.assignWorkflowBrowserProfile(workflow.id, browserProfile.id);
        }
      }
    }
  }

  async function ensureDefaultProject(): Promise<Project> {
    const list = await repository.listProjects();
    const existing = list[0];
    if (existing) return existing;
    throw commandError("No projects available. Please create a project first.", "projectId");
  }

  async function ensureDefaultBrowserProfile(project: Project): Promise<BrowserProfile> {
    const existing = await repository.getDefaultBrowserProfile(project.id);
    if (existing) return existing;
    const launchConfig = await defaultProfileBrowserLaunch("Project browser profile");
    return await repository.createBrowserProfile(project.id, {
      name: "Project browser profile",
      description: "Project-owned browser profile with persistent storage and fingerprint identity",
      browser_launch: launchConfig,
      is_default: true,
    });
  }

  async function defaultProfileBrowserLaunch(name: string): Promise<WorkflowSettings["browser_launch"]> {
    const now = new Date().toISOString();
    const defaultSettings = await settingsService.defaultWorkflowSettings(
      {
        id: `profile-${randomUUID()}`,
        name,
        created_at: now,
        updated_at: now,
      },
      { randomizeIdentity: true },
    );
    return defaultSettings.browser_launch;
  }

  async function requireProject(projectId: string): Promise<Project> {
    const project = await repository.getProject(projectId);
    if (!project) throw commandError("Project not found", "projectId");
    return project;
  }

  async function requireBrowserProfile(browserProfileId: string): Promise<BrowserProfile> {
    const browserProfile = await repository.getBrowserProfile(browserProfileId);
    if (!browserProfile) {
      throw commandError("Browser profile not found", "browserProfileId");
    }
    return browserProfile;
  }

  async function graphContextForWorkflow(workflow: WorkflowSummary, graph?: WorkflowGraph) {
    const subflowMap = new Map<string, any>();
    if (graph) {
      const subflowIds = callSubflowIds(graph);
      await Promise.all(
        subflowIds.map(async (subflowId) => {
          const subflow = await repository.getSubflow(subflowId);
          if (subflow) {
            subflowMap.set(subflowId, {
              id: subflow.id,
              project_id: subflow.project_id,
              name: subflow.name,
              graph: migrateWorkflowGraph(subflow.graph),
            });
          }
        })
      );
    }

    return {
      projectId: workflow.project_id ?? null,
      workflowLabel: workflow.name,
      resolveSubflow(subflowId: string) {
        return subflowMap.get(subflowId) ?? null;
      },
    };
  }

  async function referencedSubflowsForWorkflowGraph(
    workflow: WorkflowSummary,
    graph: WorkflowGraph,
  ): Promise<any[]> {
    const projectId = workflow.project_id;
    if (!projectId) return [];
    const referencedIds = callSubflowIds(graph);
    const subflows = [];
    for (const subflowId of referencedIds) {
      const subflow = await repository.getSubflow(subflowId);
      if (!subflow) {
        throw commandError("Workflow references a missing subflow", "workflow.graph");
      }
      if (subflow.project_id !== projectId) {
        throw commandError(
          "Workflow references a subflow outside its project",
          "workflow.graph",
        );
      }
      subflows.push(subflow);
    }
    return subflows;
  }

  function callSubflowIds(graph: WorkflowGraph): string[] {
    return [
      ...new Set(
        graph.nodes
          .filter((node) => node.node_type === "call_subflow")
          .map((node) => (node.config as { subflow_id?: unknown }).subflow_id)
          .filter((subflowId): subflowId is string =>
            typeof subflowId === "string" && subflowId.trim().length > 0
          ),
      ),
    ];
  }

  function remapCallSubflowIds(
    graph: WorkflowGraph,
    subflowIdMap: Map<string, string>,
  ): WorkflowGraph {
    return {
      ...graph,
      nodes: graph.nodes.map((node) => {
        if (node.node_type !== "call_subflow") return node;
        const config = node.config as { subflow_id?: unknown };
        const nextSubflowId =
          typeof config.subflow_id === "string"
            ? subflowIdMap.get(config.subflow_id) ?? config.subflow_id
            : config.subflow_id;
        return {
          ...node,
          config: {
            ...asRecord(node.config),
            subflow_id: nextSubflowId,
          },
        };
      }),
    };
  }

  function asRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  }

  async function requireWorkflow(workflowId: string): Promise<WorkflowSummary> {
    const workflow = await repository.getWorkflowSummary(workflowId);
    if (!workflow) {
      throw commandError("Workflow not found", "workflowId");
    }
    return workflow;
  }

  async function getSettings(workflowId: string): Promise<WorkflowSettings> {
    const persisted = await repository.getWorkflowSettings(workflowId);
    const workflow = await requireWorkflow(workflowId);
    const normalized = persisted
      ? settingsService.normalizeWorkflowSettings(persisted, workflow)
      : settingsService.defaultWorkflowSettings(workflow);
    
    let browserProfile = workflow.browser_profile_id
      ? await repository.getBrowserProfile(workflow.browser_profile_id)
      : null;
    
    if (!browserProfile || browserProfile.project_id !== workflow.project_id) {
      if (workflow.project_id) {
        const defaultProfile = await repository.getDefaultBrowserProfile(workflow.project_id);
        if (defaultProfile) {
          browserProfile = defaultProfile;
        }
      }
    }

    if (!browserProfile) return normalized;

    return settingsService.normalizeWorkflowSettings(
      {
        ...normalized,
        browser_launch: browserProfile.browser_launch,
      },
      workflow,
    );
  }

  async function lastRunAtForWorkflow(workflowId: string): Promise<string | null> {
    const row = await context.database.queryOne(
      `SELECT COALESCE(finished_at, started_at) AS last_run_at
       FROM runs
       WHERE workflow_id = $1 AND owner_id = $2
       ORDER BY started_at DESC
       LIMIT 1`,
      [workflowId, context.database.ownerId],
    ) as { last_run_at?: string | null } | null;
    return row?.last_run_at ?? null;
  }

  function activeRunConflict(
    workflowId: string,
    settings: WorkflowSettings,
    desktopTargetId?: string | null,
  ) {
    return runManager.activeRunConflict(workflowId, settings, desktopTargetId);
  }

  /**
   * Why a scheduled occurrence cannot start now.
   *
   * The Desktop Target is included, so two schedules pointed at one application
   * skip rather than interleave keystrokes into its windows. Skipping is the
   * right outcome and not merely the convenient one: queueing a desktop run
   * means an application window opening on the operator's screen at an
   * unpredictable later moment, which is worse than the run not happening. The
   * skip is recorded with its reason, so it is visible rather than silent.
   */
  async function schedulerConflictReason(workflowId: string) {
    const settings = await getSettings(workflowId);
    const workflow = await repository.getWorkflowSummary(workflowId);
    return (
      activeRunConflict(workflowId, settings, workflow?.desktop_target_id)?.reason ?? null
    );
  }

  async function assertCanChangeBrowserIdentityProfile(
    workflowId: string,
    nextSettings: WorkflowSettings,
  ) {
    const currentSettings = await getSettings(workflowId);
    runManager.assertCanChangeBrowserIdentityProfile(workflowId, currentSettings, nextSettings);
  }

  async function assertWorkflowDeletionAllowed(workflowId: string, settings: WorkflowSettings) {
    runManager.assertWorkflowDeletionAllowed(workflowId, settings);
  }

  async function saveSelectedProfileBrowserLaunch(
    workflow: WorkflowSummary,
    browserLaunch: WorkflowSettings["browser_launch"],
  ) {
    const profileId = workflow.browser_profile_id;
    if (!profileId) return browserLaunch;
    const browserProfile = await repository.getBrowserProfile(profileId);
    if (!browserProfile || browserProfile.project_id !== workflow.project_id) {
      return browserLaunch;
    }
    const updated = await repository.updateBrowserProfile(browserProfile.id, {
      browser_launch: browserLaunch,
    });
    return updated?.browser_launch ?? browserLaunch;
  }

  function assertCanResetBrowserIdentity(workflowId: string, settings: WorkflowSettings) {
    runManager.assertCanResetBrowserIdentity(workflowId, settings);
  }

  async function usedFingerprintSeeds(exceptWorkflowId?: string) {
    const list = await repository.listWorkflows();
    const filtered = list.filter((workflow) => workflow.id !== exceptWorkflowId);
    const seeds = new Set<string>();
    for (const w of filtered) {
      const s = await getSettings(w.id);
      if (s.browser_launch.fingerprint_seed) {
        seeds.add(s.browser_launch.fingerprint_seed);
      }
    }
    return seeds;
  }

  async function usedBrowserProfileFingerprintSeeds(exceptWorkflowId?: string) {
    const seeds = await usedFingerprintSeeds(exceptWorkflowId);
    const projects = await repository.listProjects();
    for (const project of projects) {
      const profiles = await repository.listBrowserProfiles(project.id);
      for (const profile of profiles) {
        const seed = profile.browser_launch.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  async function duplicateBrowserProfileLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
    exceptWorkflowId?: string,
  ): Promise<WorkflowSettings["browser_launch"]> {
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds(exceptWorkflowId);
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

  async function rotateBrowserIdentity(workflowId: string): Promise<WorkflowSettings> {
    const settings = await getSettings(workflowId);
    assertCanResetBrowserIdentity(workflowId, settings);
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds(workflowId);
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      seeds,
    );
    const timestamp = new Date().toISOString();
    return await saveSettings(workflowId, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        run_from_selected_enabled: false,
      },
      browser_launch: {
        ...settings.browser_launch,
        identity_id: identityId,
        profile_dir: identityId,
        profile_name:
          settings.browser_launch.session_mode === "persistent_profile"
            ? identityId
            : null,
        fingerprint_seed: fingerprintSeed,
      },
      migration_notes: [
        ...settings.migration_notes,
        {
          path: "browser_launch.identity_id",
          action: "rotated",
          message: `Browser identity rotated from ${settings.browser_launch.identity_id} to ${identityId} at ${timestamp}`,
        },
      ],
    });
  }

  async function saveSettings(workflowId: string, settings: WorkflowSettings) {
    const workflow = await requireWorkflow(workflowId);
    const activeSettings = settingsService.normalizeWorkflowSettings(settings, workflow);
    await assertCanChangeBrowserIdentityProfile(workflowId, activeSettings);
    const issues = settingsService.validateSettings(activeSettings);
    const firstError = issues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(
        firstError.message,
        firstError.field
          ? `${firstError.section}.${firstError.field}`
          : firstError.section,
      );
    }

    const browserLaunch = await saveSelectedProfileBrowserLaunch(
      workflow,
      activeSettings.browser_launch,
    );
    const timestamp = new Date().toISOString();
    const normalized: WorkflowSettings = {
      ...activeSettings,
      workflow_id: workflowId,
      version: 2,
      general: {
        ...activeSettings.general,
        name: activeSettings.general.name.trim(),
        updated_at: timestamp,
        created_at: activeSettings.general.created_at ?? workflow.created_at,
      },
      browser_launch: browserLaunch,
      migration_notes: activeSettings.migration_notes,
      updated_at: timestamp,
      created_at: activeSettings.created_at ?? workflow.created_at,
    };
    await repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  async function createWorkflow(name: string, options: WorkflowCreateOptions = {}): Promise<Workflow> {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const project = options.project_id
      ? await requireProject(options.project_id)
      : await ensureDefaultProject();
    // A desktop workflow still gets a browser profile row today. Untangling
    // that means making the profile optional across settings and the run
    // lifecycle, which the desktop run path will force anyway.
    const browserProfile = options.browser_profile_id
      ? await requireBrowserProfile(options.browser_profile_id)
      : await ensureDefaultBrowserProfile(project);
    const workflow = await repository.createWorkflow(
      normalized,
      createDraftGraph(),
      new Date(),
      {
        projectId: project.id,
        browserProfileId: browserProfile.id,
        surface: options.surface ?? "web",
      },
    );
    const defaultSettings = settingsService.defaultWorkflowSettings(workflow, {
      randomizeIdentity: true,
    });
    await repository.saveWorkflowSettings(workflow.id, {
      ...defaultSettings,
      browser_launch: browserProfile.browser_launch,
    });
    return {
      ...workflow,
      project_id: project.id,
      browser_profile_id: browserProfile.id,
    };
  }

  async function getWorkflowGraph(workflowId: string): Promise<WorkflowGraph> {
    const graph = await repository.getWorkflowGraph(workflowId);
    if (!graph) {
      await requireWorkflow(workflowId);
      return createDraftGraph();
    }
    const migrated = migrateWorkflowGraph(graph);
    if (JSON.stringify(migrated) !== JSON.stringify(graph)) {
      await repository.saveWorkflowGraph(workflowId, migrated);
    }
    return migrated;
  }

  return {
    ensureProjectModelReady,
    ensureDefaultProject,
    ensureDefaultBrowserProfile,
    defaultProfileBrowserLaunch,
    requireProject,
    requireBrowserProfile,
    graphContextForWorkflow,
    referencedSubflowsForWorkflowGraph,
    callSubflowIds,
    remapCallSubflowIds,
    asRecord,
    requireWorkflow,
    getSettings,
    lastRunAtForWorkflow,
    activeRunConflict,
    schedulerConflictReason,
    assertCanChangeBrowserIdentityProfile,
    assertWorkflowDeletionAllowed,
    saveSelectedProfileBrowserLaunch,
    assertCanResetBrowserIdentity,
    usedFingerprintSeeds,
    usedBrowserProfileFingerprintSeeds,
    duplicateBrowserProfileLaunch,
    rotateBrowserIdentity,
    saveSettings,
    createWorkflow,
    getWorkflowGraph,
  };
}
