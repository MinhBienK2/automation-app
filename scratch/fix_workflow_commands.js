import fs from "node:fs/promises";

async function main() {
  const filePath = "/home/minhbien/Documents/automation_app/electron/backend/commands/workflowCommands.ts";
  let content = await fs.readFile(filePath, "utf8");

  // Replace validateWorkflowRun function
  const oldValidate = `  function validateWorkflowRun(workflowId: string): RunValidationIssue[] {
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
  }`;

  const newValidate = `  async function validateWorkflowRun(workflowId: string): Promise<RunValidationIssue[]> {
    const workflow = await requireWorkflow(workflowId);
    const graph = await getWorkflowGraph(workflowId);
    const settings = await getSettings(workflowId);
    return [
      ...validateGraph(graph, graphContextForWorkflow(workflow)).map((issue) => ({
        source: "graph" as const,
        field: null,
        node_id: issue.node_id ?? null,
        edge_id: issue.edge_id ?? null,
        message: issue.message,
        level: issue.level,
      })),
      ...settingsService.validateSettings(settings).map((issue) => ({
        source: "settings" as const,
        field: issue.field ?? null,
        node_id: null,
        edge_id: null,
        message: issue.message,
        level: issue.level,
      })),
    ];
  }`;

  content = content.replace(oldValidate, newValidate);

  // Replace startWorkflowRun function
  const oldStart = `  async function startWorkflowRun(
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
  }`;

  const newStart = `  async function startWorkflowRun(
    workflowId: string,
    source: "manual" | "schedule" = "manual",
  ): Promise<WorkflowRunSnapshot> {
    const workflow = await requireWorkflow(workflowId);
    const settings = await getSettings(workflowId);
    const conflict = activeRunConflict(workflowId, settings);
    if (conflict) {
      throw commandError(conflict.message, conflict.field);
    }
    const graph = await getWorkflowGraph(workflowId);
    const runIssues = await validateWorkflowRun(workflowId);
    const firstError = runIssues.find((issue) => issue.level === "error");
    if (firstError) {
      if (source === "manual") {
        await deps.operationsRepository.recordLaunchBlocked({ workflow, issues: runIssues });
      }
      throw commandError(firstError.message, firstError.field ?? firstError.node_id ?? "workflowId");
    }
    const graphContext = graphContextForWorkflow(workflow);
    if (compileGraph(graph, graphContext).steps.length === 0) {
      throw commandError("Workflow graph has no executable steps", "graph");
    }

    let profileEnvironment: ProfileEnvironment | undefined;
    if (workflow.browser_profile_id) {
      const profile = await repository.getBrowserProfile(workflow.browser_profile_id);
      if (profile) {
        profileEnvironment = profile.environment;
      }
    }

    const compiledGraph = compileWorkflowRunPlan(graph, settings, {
      ...graphContext,
      profileEnvironment,
    });
    return await runManager.startWorkflowRun({
      workflow,
      source,
      settings,
      graphSnapshot: graph,
      compiledGraph,
    });
  }`;

  content = content.replace(oldStart, newStart);

  // Replace listWorkflows and getWorkflow
  const oldListGet = `    listWorkflows(): WorkflowSummary[] {
      return repository.listWorkflows();
    },

    getWorkflow(id: string): WorkflowDetail | null {
      return repository.getWorkflow(id);
    },

    validateWorkflowRun(workflowId: string): RunValidationIssue[] {
      return validateWorkflowRun(workflowId);
    },`;

  const newListGet = `    async listWorkflows(): Promise<WorkflowSummary[]> {
      return repository.listWorkflows();
    },

    async getWorkflow(id: string): Promise<WorkflowDetail | null> {
      return repository.getWorkflow(id);
    },

    async validateWorkflowRun(workflowId: string): Promise<RunValidationIssue[]> {
      return validateWorkflowRun(workflowId);
    },`;

  content = content.replace(oldListGet, newListGet);

  // Replace renameWorkflow
  const oldRename = `    renameWorkflow(id: string, name: string) {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      requireWorkflow(id);
      repository.renameWorkflow(id, normalized);
    },`;

  const newRename = `    async renameWorkflow(id: string, name: string) {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      await requireWorkflow(id);
      await repository.renameWorkflow(id, normalized);
    },`;

  content = content.replace(oldRename, newRename);

  // Replace runWorkflowFromNode
  const oldRunFromNode = `    async runWorkflowFromNode(
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

      let profileEnvironment: ProfileEnvironment | undefined;
      if (workflow.browser_profile_id) {
        const profile = repository.getBrowserProfile(workflow.browser_profile_id);
        if (profile) {
          profileEnvironment = profile.environment;
        }
      }

      const graph = getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId, {
        ...graphContextForWorkflow(workflow),
        mode: runMode,
        settings,
        profileEnvironment,
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
    },`;

  const newRunFromNode = `    async runWorkflowFromNode(
      workflowId: string,
      startNodeId: string,
      mode?: "selected_only" | "from_selected",
    ): Promise<WorkflowRunSnapshot> {
      const workflow = await requireWorkflow(workflowId);
      const settings = await getSettings(workflowId);
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
        await saveSettings(workflowId, settings);
      }

      let profileEnvironment: ProfileEnvironment | undefined;
      if (workflow.browser_profile_id) {
        const profile = await repository.getBrowserProfile(workflow.browser_profile_id);
        if (profile) {
          profileEnvironment = profile.environment;
        }
      }

      const graph = await getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId, {
        ...graphContextForWorkflow(workflow),
        mode: runMode,
        settings,
        profileEnvironment,
      });
      if (compiledGraph.steps.length === 0) {
        throw commandError("Selected graph node has no executable steps", "startNodeId");
      }

      return await runManager.startWorkflowRun({
        workflow,
        source: "manual",
        settings,
        graphSnapshot: graph,
        compiledGraph,
        targetStepId: startNodeId,
        reuseRetainedSession: true,
        retainedSessionWorkflowId: workflowId,
      });
    },`;

  content = content.replace(oldRunFromNode, newRunFromNode);

  // Replace runBatchWorkflow
  const oldBatch = `    async runBatchWorkflow(
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
    },`;

  const newBatch = `    async runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      const workflow = await requireWorkflow(workflowId);
      if (runManager.hasActiveBatchRun() || runManager.hasActiveWorkflowRuns()) {
        throw commandError("A workflow run is already active", "run");
      }
      const settings = await getSettings(workflowId);
      const concurrencyLimit =
        request.concurrency_limit ?? settings.run_policy.batch_concurrency_limit ?? 1;
      if (concurrencyLimit > 1) {
        throw commandError(
          "Batch concurrency above 1 is not supported until row isolation is implemented",
          "concurrency_limit",
        );
      }
      const graph = await getWorkflowGraph(workflowId);
      const graphContext = graphContextForWorkflow(workflow);
      if (compileGraph(graph, graphContext).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      let profileEnvironment: ProfileEnvironment | undefined;
      if (workflow.browser_profile_id) {
        const profile = await repository.getBrowserProfile(workflow.browser_profile_id);
        if (profile) {
          profileEnvironment = profile.environment;
        }
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings, {
        ...graphContext,
        profileEnvironment,
      });
      return await runBatchWorkflowRows({
        workflowId,
        request,
        settings,
        graphSnapshot: graph,
        compiledGraph,
        runner,
        runManager,
      });
    },`;

  content = content.replace(oldBatch, newBatch);

  await fs.writeFile(filePath, content, "utf8");
  console.log("Rewrote workflowCommands.ts successfully");
}

main().catch(console.error);
