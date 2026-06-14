import type {
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSummary,
  RunValidationIssue,
  WorkflowRunSnapshot,
  WorkflowDeleteOptions,
  CompiledWorkflowGraph,
  ActionConfig,
  BatchRunRequest,
  GraphValidationIssue,
  ProfileEnvironment,
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { migrateWorkflowGraph } from "../graph/migration.js";
import {
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  compileWorkflowGraph as compileGraph,
  validateActionConfig,
  validateWorkflowGraph as validateGraph,
} from "../graph/compiler.js";
import { browserProfileKey } from "../runtime/runManager.js";
import { runBatchWorkflowRows } from "../runtime/batchWorkflowRun.js";

function isUnsupportedGraphDiscriminantMessage(message: string) {
  return (
    message.startsWith("Unsupported graph node type: ") ||
    message.startsWith("Unsupported condition kind: ") ||
    message.includes("Unsupported action type: ")
  );
}

function assertNoUnsupportedGraphDiscriminants(graph: WorkflowGraph) {
  const issue = validateGraph(graph).find(
    (candidate) =>
      candidate.level === "error" &&
      isUnsupportedGraphDiscriminantMessage(candidate.message),
  );
  if (!issue) return;
  throw commandError(issue.message, "workflow.graph");
}

export function createWorkflowCommands(deps: CommandDeps) {
  const {
    repository,
    settingsService,
    runManager,
    runner,
    requireWorkflow,
    getSettings,
    saveSettings,
    createWorkflow,
    getWorkflowGraph,
    activeRunConflict,
    assertWorkflowDeletionAllowed,
    graphContextForWorkflow,
  } = deps;

  function validateWorkflowRun(workflowId: string): RunValidationIssue[] {
    const workflow = requireWorkflow(workflowId);
    const graph = getWorkflowGraph(workflowId);
    return [
      ...validateGraph(graph, graphContextForWorkflow(workflow)).map((issue) => ({
        source: "graph" as const,
        field: null,
        node_id: issue.node_id ?? null,
        edge_id: issue.edge_id ?? null,
        message: issue.message,
        level: issue.level,
      })),
      ...settingsService.validateSettings(getSettings(workflowId)).map((issue) => ({
        source: "settings" as const,
        field: issue.field ?? null,
        node_id: null,
        edge_id: null,
        message: issue.message,
        level: issue.level,
      })),
    ];
  }

  async function startWorkflowRun(
    workflowId: string,
    source: "manual" | "schedule" = "manual",
  ): Promise<WorkflowRunSnapshot> {
    const workflow = requireWorkflow(workflowId);
    const settings = getSettings(workflowId);
    const conflict = activeRunConflict(workflowId, settings);
    if (conflict) {
      throw commandError(conflict.message, conflict.field);
    }
    const graph = getWorkflowGraph(workflowId);
    const runIssues = validateWorkflowRun(workflowId);
    const firstError = runIssues.find((issue) => issue.level === "error");
    if (firstError) {
      if (source === "manual") {
        deps.operationsRepository.recordLaunchBlocked({ workflow, issues: runIssues });
      }
      throw commandError(firstError.message, firstError.field ?? firstError.node_id ?? "workflowId");
    }
    const graphContext = graphContextForWorkflow(workflow);
    if (compileGraph(graph, graphContext).steps.length === 0) {
      throw commandError("Workflow graph has no executable steps", "graph");
    }

    let profileEnvironment: ProfileEnvironment | undefined;
    if (workflow.browser_profile_id) {
      const profile = repository.getBrowserProfile(workflow.browser_profile_id);
      if (profile) {
        profileEnvironment = profile.environment;
      }
    }

    const compiledGraph = compileWorkflowRunPlan(graph, settings, {
      ...graphContext,
      profileEnvironment,
    });
    return runManager.startWorkflowRun({
      workflow,
      source,
      settings,
      graphSnapshot: graph,
      compiledGraph,
    });
  }



  return {
    listWorkflows(): WorkflowSummary[] {
      return repository.listWorkflows();
    },

    getWorkflow(id: string): WorkflowDetail | null {
      return repository.getWorkflow(id);
    },

    validateWorkflowRun(workflowId: string): RunValidationIssue[] {
      return validateWorkflowRun(workflowId);
    },

    createWorkflow,

    renameWorkflow(id: string, name: string) {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      requireWorkflow(id);
      repository.renameWorkflow(id, normalized);
    },

    deleteWorkflow(id: string, _options: WorkflowDeleteOptions = {}) {
      const settings = getSettings(id);
      assertWorkflowDeletionAllowed(id, settings);
      repository.deleteWorkflow(id);
    },

    duplicateWorkflow(workflowId: string, name: string): WorkflowDetail {
      const sourceWorkflow = requireWorkflow(workflowId);
      deps.context.database.exec("BEGIN IMMEDIATE");
      try {
        let created = createWorkflow(name, {
          project_id: sourceWorkflow.project_id,
        });
        if (sourceWorkflow.browser_profile_id) {
          created = repository.assignWorkflowBrowserProfile(
            created.id,
            sourceWorkflow.browser_profile_id,
          ) ?? created;
        }
        const graph = repository.getWorkflowGraph(workflowId);
        if (graph) repository.saveWorkflowGraph(created.id, graph);
        const settings = getSettings(workflowId);
        if (settings) {
          saveSettings(created.id, {
            ...settingsService.duplicateWorkflowSettings(settings, created),
            browser_launch: getSettings(created.id).browser_launch,
          });
        }
        deps.context.database.exec("COMMIT");
        return { workflow: created, steps: [] };
      } catch (error) {
        deps.context.database.exec("ROLLBACK");
        throw error;
      }
    },

    getWorkflowGraph(workflowId: string): WorkflowGraph {
      return getWorkflowGraph(workflowId);
    },

    saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
      requireWorkflow(workflowId);
      const migrated = migrateWorkflowGraph(graph);
      assertNoUnsupportedGraphDiscriminants(migrated);
      repository.saveWorkflowGraph(workflowId, migrated);
    },

    validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
      return validateGraph(migrateWorkflowGraph(graph));
    },

    compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
      return compileGraph(migrateWorkflowGraph(graph));
    },

    async runWorkflow(workflowId: string): Promise<WorkflowRunSnapshot> {
      return startWorkflowRun(workflowId, "manual");
    },

    async runWorkflowFromNode(
      workflowId: string,
      startNodeId: string,
      mode?: "selected_only" | "from_selected",
    ): Promise<WorkflowRunSnapshot> {
      const workflow = requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      const conflict = activeRunConflict(workflowId, settings);
      if (conflict) {
        throw commandError(conflict.message, conflict.field);
      }
      const profileKey = browserProfileKey(settings);
      if (settings.browser_launch.session_mode !== "persistent_profile" || !profileKey) {
        throw commandError(
          "Run from selected requires a persistent browser profile",
          "browser_launch.session_mode",
        );
      }
      if (settings.run_policy.browser_retention !== "retain") {
        throw commandError(
          "Run from selected requires browser retention to be set to retain",
          "run_policy.browser_retention",
        );
      }
      if (!runner.hasReusableRetainedSession?.(workflowId, profileKey)) {
        const retained_session = runner.getRetainedSessionState?.(workflowId, profileKey) ?? {
          available: false,
          workflow_id: null,
          profile_name: null,
          reason: "No retained browser session",
        };
        runManager.updateLatestRetainedSession(retained_session);
        throw commandError(
          "No reusable browser session is available. Run the workflow again to create one.",
          "run",
        );
      }

      const runMode = mode ?? settings.run_policy.run_from_selected_mode;
      if (mode && mode !== settings.run_policy.run_from_selected_mode) {
        settings.run_policy.run_from_selected_mode = mode;
        saveSettings(workflowId, settings);
      }

      const graph = getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId, {
        ...graphContextForWorkflow(workflow),
        mode: runMode,
      });
      if (compiledGraph.steps.length === 0) {
        throw commandError("Selected graph node has no executable steps", "startNodeId");
      }

      return runManager.startWorkflowRun({
        workflow,
        source: "manual",
        settings,
        graphSnapshot: graph,
        compiledGraph,
        targetStepId: startNodeId,
        reuseRetainedSession: true,
        retainedSessionWorkflowId: workflowId,
      });
    },

    async stopRun(runId?: string | null): Promise<WorkflowRunSnapshot> {
      return runManager.stopRun({ runId, fallbackWorkflow: repository.listWorkflows()[0] ?? null });
    },

    getRunState() {
      return runManager.getRunState();
    },

    listRunStates(): WorkflowRunSnapshot[] {
      return runManager.listRunStates();
    },

    async runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      const workflow = requireWorkflow(workflowId);
      if (runManager.hasActiveBatchRun() || runManager.hasActiveWorkflowRuns()) {
        throw commandError("A workflow run is already active", "run");
      }
      const settings = getSettings(workflowId);
      const concurrencyLimit =
        request.concurrency_limit ?? settings.run_policy.batch_concurrency_limit ?? 1;
      if (concurrencyLimit > 1) {
        throw commandError(
          "Batch concurrency above 1 is not supported until row isolation is implemented",
          "concurrency_limit",
        );
      }
      const graph = getWorkflowGraph(workflowId);
      const graphContext = graphContextForWorkflow(workflow);
      if (compileGraph(graph, graphContext).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      let profileEnvironment: ProfileEnvironment | undefined;
      if (workflow.browser_profile_id) {
        const profile = repository.getBrowserProfile(workflow.browser_profile_id);
        if (profile) {
          profileEnvironment = profile.environment;
        }
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings, {
        ...graphContext,
        profileEnvironment,
      });
      return runBatchWorkflowRows({
        workflowId,
        request,
        settings,
        graphSnapshot: graph,
        compiledGraph,
        runner,
        runManager,
      });
    },

    dryRunValidateConfig(config: ActionConfig) {
      const validation = validateActionConfig(config);
      if (validation) throw commandError(validation.message, validation.field);
    },
    
    // We expose startWorkflowRun as a helper for other domains (e.g., schedules) if needed
    _startWorkflowRun: startWorkflowRun,
    _validateWorkflowRun: validateWorkflowRun,
  };
}
