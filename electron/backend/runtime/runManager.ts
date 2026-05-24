import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type {
  CompiledWorkflowGraph,
  RunState,
  WorkflowGraph,
  WorkflowRunSnapshot,
  WorkflowRunSource,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import type { BrowserWorkflowRunner } from "./runner.js";

export type CommandError = {
  message: string;
  field?: string | null;
};

export type RunnerCommandPort = {
  run: BrowserWorkflowRunner["run"];
  closeRetainedContext?: BrowserWorkflowRunner["closeRetainedContext"];
  createIsolatedRunRunner?: () => RunnerCommandPort;
  hasReusableRetainedSession?: BrowserWorkflowRunner["hasReusableRetainedSession"];
  getRetainedSessionState?: BrowserWorkflowRunner["getRetainedSessionState"];
  getRetainedSessionStates?: BrowserWorkflowRunner["getRetainedSessionStates"];
};

type RunEntry = {
  snapshot: WorkflowRunSnapshot;
  abortController: AbortController;
  timeoutHandle: ReturnType<typeof setTimeout> | null;
  compiledGraph: CompiledWorkflowGraph;
  timedOut: boolean;
  profileName: string | null;
};

type RunConflict = {
  reason: "active_batch" | "active_workflow" | "active_profile";
  message: string;
  field: string;
};

export const idleRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  outputs: {},
  retained_session: {
    available: false,
    workflow_id: null,
    profile_name: null,
    reason: "No retained browser session",
  },
  error: null,
};

export class RunManager {
  private readonly runEntries = new Map<string, RunEntry>();
  private readonly sessionRunSnapshots = new Map<string, WorkflowRunSnapshot>();
  private readonly activeWorkflowRuns = new Map<string, string>();
  private readonly activeProfileRuns = new Map<string, string>();
  private latestRunSnapshot: WorkflowRunSnapshot | null = null;
  private currentBatchRunState: RunState | null = null;
  private currentBatchAbortController: AbortController | null = null;
  private currentBatchRunId: string | null = null;

  constructor(
    private readonly options: {
      database: DatabaseSync;
      runner: RunnerCommandPort;
    },
  ) {}

  activeRunConflict(workflowId: string, settings: WorkflowSettings): RunConflict | null {
    if (this.currentBatchAbortController) {
      return {
        reason: "active_batch",
        message: "A batch run is already active",
        field: "run",
      };
    }
    if (this.activeWorkflowRuns.has(workflowId)) {
      return {
        reason: "active_workflow",
        message: "This workflow is already running",
        field: "workflowId",
      };
    }
    const profileName = browserProfileKey(settings);
    if (profileName && this.activeProfileRuns.has(profileName)) {
      return {
        reason: "active_profile",
        message: "Browser profile is already in use by another active run",
        field: "browser_launch.profile_name",
      };
    }
    return null;
  }

  hasActiveWorkflowRuns() {
    return this.runEntries.size > 0;
  }

  hasActiveBatchRun() {
    return Boolean(this.currentBatchAbortController);
  }

  retainedProfileNames() {
    const names = new Set<string>();
    for (const state of this.options.runner.getRetainedSessionStates?.() ?? []) {
      if (state.available && state.profile_name) names.add(state.profile_name);
    }
    const singleton = this.options.runner.getRetainedSessionState?.();
    if (singleton?.available && singleton.profile_name) names.add(singleton.profile_name);
    return names;
  }

  retainedSessionActiveFor(workflowId: string, profileName: string) {
    if (this.options.runner.hasReusableRetainedSession) {
      return this.options.runner.hasReusableRetainedSession(workflowId, profileName);
    }
    const states = this.options.runner.getRetainedSessionStates?.() ?? [
      this.options.runner.getRetainedSessionState?.(),
    ];
    return states.some(
      (state) =>
        state?.available &&
        state.workflow_id === workflowId &&
        state.profile_name === profileName,
    );
  }

  assertCanChangeBrowserIdentityProfile(
    workflowId: string,
    currentSettings: WorkflowSettings,
    nextSettings: WorkflowSettings,
  ) {
    const currentProfileKey = browserProfileKey(currentSettings);
    if (!currentProfileKey) return;
    if (!this.retainedSessionActiveFor(workflowId, currentProfileKey)) return;
    const nextProfileKey = browserProfileKey(nextSettings);
    const changingIdentityProfile =
      nextProfileKey !== currentProfileKey ||
      nextSettings.browser_launch.identity_id !== currentSettings.browser_launch.identity_id ||
      nextSettings.browser_launch.fingerprint_seed !== currentSettings.browser_launch.fingerprint_seed;
    if (!changingIdentityProfile) return;
    throw commandError(
      "Close the retained browser session before changing or deleting its identity profile",
      "browser_launch.profile_dir",
    );
  }

  assertWorkflowDeletionAllowed(workflowId: string, settings: WorkflowSettings) {
    if (this.activeWorkflowRuns.has(workflowId)) {
      throw commandError(
        "Stop the active workflow run before deleting this workflow",
        "workflowId",
      );
    }
    const currentProfileKey = browserProfileKey(settings);
    if (currentProfileKey && this.activeProfileRuns.has(currentProfileKey)) {
      throw commandError(
        "Stop the active workflow run using this browser profile before deleting this workflow",
        "browser_launch.profile_name",
      );
    }
    if (!currentProfileKey) return;
    if (!this.retainedSessionActiveFor(workflowId, currentProfileKey)) return;
    throw commandError(
      "Close the retained browser session before changing or deleting its identity profile",
      "browser_launch.profile_dir",
    );
  }

  assertCanResetBrowserIdentity(workflowId: string, settings: WorkflowSettings) {
    if (this.activeWorkflowRuns.has(workflowId)) {
      throw commandError(
        "Stop the active workflow run before resetting this browser identity",
        "workflowId",
      );
    }
    const currentProfileKey = browserProfileKey(settings);
    if (currentProfileKey && this.activeProfileRuns.has(currentProfileKey)) {
      throw commandError(
        "Stop the active workflow run using this browser profile before resetting this browser identity",
        "browser_launch.profile_name",
      );
    }
    if (!currentProfileKey || !this.retainedSessionActiveFor(workflowId, currentProfileKey)) return;
    throw commandError(
      "Close the retained browser session before resetting this browser identity",
      "browser_launch.profile_dir",
    );
  }

  async startWorkflowRun({
    workflow,
    source,
    settings,
    graphSnapshot,
    compiledGraph,
    targetStepId = null,
    reuseRetainedSession = false,
    retainedSessionWorkflowId,
  }: {
    workflow: WorkflowSummary;
    source: WorkflowRunSource;
    settings: WorkflowSettings;
    graphSnapshot: WorkflowGraph;
    compiledGraph: CompiledWorkflowGraph;
    targetStepId?: string | null;
    reuseRetainedSession?: boolean;
    retainedSessionWorkflowId?: string;
  }): Promise<WorkflowRunSnapshot> {
    const workflowId = workflow.id;
    const profileName = browserProfileKey(settings);
    const abortController = new AbortController();
    const runId = this.beginRunRecord(workflowId, settings, graphSnapshot);
    const runningState: RunState = {
      ...idleRunState,
      status: "running",
      mode: "run_workflow",
      target_step_id: targetStepId,
      retained_session:
        this.options.runner.getRetainedSessionState?.(workflowId, profileName) ??
        idleRunState.retained_session,
    };
    const snapshot = this.createRunSnapshot({
      runId,
      workflow,
      source,
      state: runningState,
    });
    const entry: RunEntry = {
      snapshot,
      abortController,
      timeoutHandle: null,
      compiledGraph,
      timedOut: false,
      profileName,
    };
    this.runEntries.set(runId, entry);
    this.activeWorkflowRuns.set(workflowId, runId);
    if (profileName) this.activeProfileRuns.set(profileName, runId);
    this.rememberSnapshot(snapshot);

    const runRunner = this.createRunRunner();
    const timeoutMs = settings.run_policy.max_workflow_duration_ms ?? null;
    entry.timeoutHandle = timeoutMs
      ? setTimeout(() => {
          entry.timedOut = true;
          abortController.abort();
        }, timeoutMs)
      : null;
    void this.executeRun({
      runId,
      workflowId,
      profileName,
      runningState,
      compiledGraph,
      settings,
      runRunner,
      abortController,
      targetStepId,
      timeoutMs,
      reuseRetainedSession,
      retainedSessionWorkflowId,
    });
    return this.sessionRunSnapshots.get(runId) ?? snapshot;
  }

  async stopRun({
    runId,
    fallbackWorkflow,
  }: {
    runId?: string | null;
    fallbackWorkflow?: WorkflowSummary | null;
  } = {}): Promise<WorkflowRunSnapshot> {
    if (!runId && this.runEntries.size > 1) {
      throw commandError("Specify a run id to stop when multiple runs are active", "runId");
    }
    const targetRunId = runId ?? [...this.runEntries.keys()][0] ?? null;
    if (targetRunId) {
      const entry = this.runEntries.get(targetRunId);
      if (!entry) {
        throw commandError("Run not found", "runId");
      }
      entry.abortController.abort();
      const stoppedState: RunState = {
        ...entry.snapshot.state,
        status: "stopped",
        mode: "run_workflow",
        error: null,
      };
      return this.updateSnapshot(targetRunId, stoppedState) ?? entry.snapshot;
    }

    if (this.currentBatchAbortController) {
      this.currentBatchAbortController.abort();
      this.currentBatchRunState = {
        ...(this.currentBatchRunState ?? idleRunState),
        status: "stopped",
        mode: "run_workflow",
        error: null,
      };
      return this.createRunSnapshot({
        runId: this.currentBatchRunId ?? "batch",
        workflow: fallbackWorkflow ?? fallbackWorkflowSummary("batch", "Batch run"),
        source: "manual",
        state: this.currentBatchRunState,
      });
    }

    await this.options.runner.closeRetainedContext?.();
    return this.createRunSnapshot({
      runId: this.latestRunSnapshot?.run_id ?? "stopped",
      workflow: fallbackWorkflow ?? fallbackWorkflowSummary("workflow", "Workflow"),
      source: "manual",
      state: {
        ...idleRunState,
        status: "stopped",
        mode: "run_workflow",
      },
    });
  }

  getRunState(): RunState {
    if (this.currentBatchAbortController && this.currentBatchRunState) {
      return this.currentBatchRunState;
    }
    const activeSnapshots = [...this.runEntries.values()].map((entry) => entry.snapshot);
    if (activeSnapshots.length === 1) {
      return activeSnapshots[0].state;
    }
    if (activeSnapshots.length > 1) {
      return {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
      };
    }
    if (this.latestRunSnapshot) {
      const latestRetainedSession = this.latestRunSnapshot.state.retained_session;
      const profileName =
        this.runEntries.get(this.latestRunSnapshot.run_id)?.profileName ??
        latestRetainedSession?.profile_name ??
        null;
      const refreshedRetainedSession = profileName
        ? this.options.runner.getRetainedSessionState?.(
            this.latestRunSnapshot.workflow_id,
            profileName,
          )
        : null;
      return {
        ...this.latestRunSnapshot.state,
        retained_session:
          refreshedRetainedSession?.workflow_id === this.latestRunSnapshot.workflow_id &&
          refreshedRetainedSession.profile_name === profileName
            ? refreshedRetainedSession
            : latestRetainedSession,
      };
    }
    if (this.currentBatchRunState) {
      return this.currentBatchRunState;
    }
    return {
      ...idleRunState,
      retained_session: this.options.runner.getRetainedSessionState?.() ?? idleRunState.retained_session,
    };
  }

  listRunStates(): WorkflowRunSnapshot[] {
    return this.listRunSnapshots();
  }

  updateLatestRetainedSession(retainedSession: RunState["retained_session"]) {
    if (!this.latestRunSnapshot) return;
    this.updateSnapshot(this.latestRunSnapshot.run_id, {
      ...this.latestRunSnapshot.state,
      retained_session: retainedSession,
    });
  }

  beginBatchRun(totalRows: number) {
    this.currentBatchAbortController = new AbortController();
    this.currentBatchRunState = {
      ...idleRunState,
      status: "running",
      mode: "run_workflow",
      outputs: {
        batch_total: totalRows,
        batch_current_row_index: 0,
        batch_succeeded: 0,
        batch_failed: 0,
      },
    };
    return this.currentBatchAbortController;
  }

  getBatchRunState() {
    return this.currentBatchRunState;
  }

  setBatchRunState(state: RunState) {
    this.currentBatchRunState = state;
  }

  patchBatchRunState(update: (state: RunState | null) => RunState) {
    this.currentBatchRunState = update(this.currentBatchRunState);
    return this.currentBatchRunState;
  }

  setCurrentBatchRunId(runId: string | null) {
    this.currentBatchRunId = runId;
  }

  clearBatchRun(abortController: AbortController) {
    if (this.currentBatchAbortController === abortController) {
      this.currentBatchAbortController = null;
    }
    this.currentBatchRunId = null;
  }

  beginRunRecord(workflowId: string, settings: WorkflowSettings, graph: WorkflowGraph) {
    return beginRun(this.options.database, workflowId, settings, graph);
  }

  finishRun(runId: string | null, graph: CompiledWorkflowGraph, state: RunState) {
    finishRun(this.options.database, runId, graph, state);
  }

  private createRunRunner(): RunnerCommandPort {
    return this.options.runner.createIsolatedRunRunner?.() ?? this.options.runner;
  }

  private withRunState(snapshot: WorkflowRunSnapshot, state: RunState): WorkflowRunSnapshot {
    return {
      ...state,
      run_id: snapshot.run_id,
      workflow_id: snapshot.workflow_id,
      workflow_name: snapshot.workflow_name,
      source: snapshot.source,
      started_at: snapshot.started_at,
      state,
    };
  }

  private createRunSnapshot(args: {
    runId: string;
    workflow: WorkflowSummary;
    source: WorkflowRunSource;
    startedAt?: string;
    state: RunState;
  }): WorkflowRunSnapshot {
    return this.withRunState({
      ...args.state,
      run_id: args.runId,
      workflow_id: args.workflow.id,
      workflow_name: args.workflow.name,
      source: args.source,
      started_at: args.startedAt ?? new Date().toISOString(),
      state: args.state,
    }, args.state);
  }

  private rememberSnapshot(snapshot: WorkflowRunSnapshot) {
    this.sessionRunSnapshots.set(snapshot.run_id, snapshot);
    this.latestRunSnapshot = snapshot;
  }

  private updateSnapshot(runId: string, state: RunState) {
    const entry = this.runEntries.get(runId);
    const current = entry?.snapshot ?? this.sessionRunSnapshots.get(runId);
    if (!current) return null;
    const snapshot = this.withRunState(current, state);
    if (entry) entry.snapshot = snapshot;
    this.rememberSnapshot(snapshot);
    return this.sessionRunSnapshots.get(runId) ?? snapshot;
  }

  private listRunSnapshots() {
    return [...this.sessionRunSnapshots.values()].sort((left, right) =>
      left.started_at.localeCompare(right.started_at),
    );
  }

  private async executeRun({
    runId,
    workflowId,
    profileName,
    runningState,
    compiledGraph,
    settings,
    runRunner,
    abortController,
    targetStepId,
    timeoutMs,
    reuseRetainedSession,
    retainedSessionWorkflowId,
  }: {
    runId: string;
    workflowId: string;
    profileName: string | null;
    runningState: RunState;
    compiledGraph: CompiledWorkflowGraph;
    settings: WorkflowSettings;
    runRunner: RunnerCommandPort;
    abortController: AbortController;
    targetStepId: string | null;
    timeoutMs: number | null;
    reuseRetainedSession: boolean;
    retainedSessionWorkflowId?: string;
  }) {
    try {
      let terminalState = await runRunner.run({
        runId,
        graph: compiledGraph,
        settings,
        mode: "run_workflow",
        targetStepId: targetStepId ?? undefined,
        reuseRetainedSession,
        retainedSessionWorkflowId,
        signal: abortController.signal,
        onProgress: (progress) => {
          const activeEntry = this.runEntries.get(runId);
          if (!activeEntry) return;
          if (abortController.signal.aborted && activeEntry.snapshot.state.status === "stopped") {
            return;
          }
          this.updateSnapshot(runId, {
            ...activeEntry.snapshot.state,
            ...progress,
            status: "running",
            mode: "run_workflow",
            target_step_id: targetStepId,
          });
        },
      });
      const activeEntry = this.runEntries.get(runId);
      if (activeEntry?.timedOut && terminalState.status === "stopped") {
        terminalState = {
          ...terminalState,
          status: "failed",
          error: {
            step_id: terminalState.error?.step_id ?? null,
            step_number: terminalState.error?.step_number ?? 0,
            step_name: terminalState.error?.step_name ?? null,
            action_type: terminalState.error?.action_type ?? "workflow",
            reason: `Workflow exceeded maximum duration of ${timeoutMs} ms`,
          },
        };
      } else if (
        abortController.signal.aborted &&
        activeEntry?.snapshot.state.status === "stopped"
      ) {
        terminalState = {
          ...terminalState,
          status: "stopped",
          error: null,
        };
      }
      this.updateSnapshot(runId, terminalState);
      this.finishRun(runId, compiledGraph, terminalState);
    } catch (error) {
      const currentState = this.runEntries.get(runId)?.snapshot.state ?? runningState;
      const failedState: RunState = {
        ...idleRunState,
        status: "failed",
        mode: "run_workflow",
        target_step_id: targetStepId,
        retained_session:
          this.options.runner.getRetainedSessionState?.(workflowId, profileName) ?? null,
        error: {
          step_id: currentState.current_step_id,
          step_number: currentState.current_step_number ?? 0,
          step_name: null,
          action_type: "workflow",
          reason: error instanceof Error ? error.message : String(error),
        },
      };
      this.updateSnapshot(runId, failedState);
      this.finishRun(runId, compiledGraph, failedState);
    } finally {
      const activeEntry = this.runEntries.get(runId);
      if (activeEntry?.timeoutHandle) clearTimeout(activeEntry.timeoutHandle);
      this.releaseRunLocks(workflowId, profileName, runId);
      this.runEntries.delete(runId);
    }
  }

  private releaseRunLocks(workflowId: string, profileName: string | null, runId: string) {
    if (this.activeWorkflowRuns.get(workflowId) === runId) {
      this.activeWorkflowRuns.delete(workflowId);
    }
    if (profileName && this.activeProfileRuns.get(profileName) === runId) {
      this.activeProfileRuns.delete(profileName);
    }
  }
}

export function browserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return settings.browser_launch.profile_dir?.trim() || settings.browser_launch.profile_name?.trim() || null;
}

function beginRun(
  database: DatabaseSync,
  workflowId: string,
  settings: WorkflowSettings,
  graph: WorkflowGraph,
) {
  const runId = randomUUID();
  database
    .prepare(
      `INSERT INTO runs (
        id,
        workflow_id,
        status,
        started_at,
        settings_snapshot_json,
        graph_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      runId,
      workflowId,
      "running",
      new Date().toISOString(),
      JSON.stringify(settings),
      JSON.stringify(graph),
    );
  return runId;
}

export function finishRun(
  database: DatabaseSync,
  runId: string | null,
  graph: CompiledWorkflowGraph,
  state: RunState,
) {
  if (!runId) return;
  database.exec("BEGIN IMMEDIATE");
  try {
    database
      .prepare(
        `UPDATE runs
         SET status = ?,
             finished_at = ?,
             outputs_json = ?,
             error_json = ?
         WHERE id = ?`,
      )
      .run(
        state.status,
        new Date().toISOString(),
        JSON.stringify(state.outputs ?? {}),
        state.error ? JSON.stringify(state.error) : null,
        runId,
      );

    const traces = Array.isArray(state.outputs?.__action_traces)
      ? (state.outputs.__action_traces as Array<Record<string, unknown>>)
      : [];
    const insertStep = database.prepare(
      `INSERT INTO run_steps (
        id,
        run_id,
        node_id,
        step_number,
        action_type,
        status,
        started_at,
        finished_at,
        trace_json,
        error_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const [index, step] of graph.steps.entries()) {
      const trace = traces.find((candidate) =>
        candidate.node_id === step.node_id && !isNestedTrace(candidate),
      ) ?? traces.find((candidate) => candidate.node_id === step.node_id);
      const failed = state.error?.step_id === step.node_id;
      const completed = state.completed_step_ids.includes(step.node_id);
      insertStep.run(
        randomUUID(),
        runId,
        step.node_id,
        index + 1,
        step.config.type,
        failed ? "failed" : completed ? "success" : "skipped",
        traceTimestamp(trace, "started_at"),
        traceTimestamp(trace, "finished_at") ?? (trace || failed ? new Date().toISOString() : null),
        trace ? JSON.stringify(trace) : null,
        failed && state.error ? JSON.stringify(state.error) : traceErrorJson(trace),
      );
    }
    const nestedTraces = traces
      .map((trace, index) => ({ trace, index }))
      .filter(({ trace }) => isNestedTrace(trace))
      .sort((left, right) => traceOrder(left.trace, left.index) - traceOrder(right.trace, right.index));
    for (const [nestedIndex, { trace }] of nestedTraces.entries()) {
      insertStep.run(
        randomUUID(),
        runId,
        String(trace.node_id),
        graph.steps.length + nestedIndex + 1,
        typeof trace.action_type === "string" ? trace.action_type : "unknown",
        traceRunStepStatus(trace),
        traceTimestamp(trace, "started_at"),
        traceTimestamp(trace, "finished_at") ?? new Date().toISOString(),
        JSON.stringify(trace),
        traceErrorJson(trace),
      );
    }
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
}

function isNestedTrace(trace: Record<string, unknown>) {
  return typeof trace.parent_node_id === "string" && trace.parent_node_id.length > 0;
}

function traceOrder(trace: Record<string, unknown>, fallback: number) {
  return typeof trace.trace_sequence === "number" ? trace.trace_sequence : fallback;
}

function traceTimestamp(
  trace: Record<string, unknown> | undefined,
  key: "started_at" | "finished_at",
) {
  return typeof trace?.[key] === "string" ? trace[key] : null;
}

function traceRunStepStatus(trace: Record<string, unknown>) {
  return typeof trace.status === "string" ? trace.status : "success";
}

function traceErrorJson(trace: Record<string, unknown> | undefined) {
  if (!trace || trace.status !== "failed") return null;
  const reason = typeof trace.reason === "string" ? trace.reason : "Action failed";
  return JSON.stringify({
    step_id: typeof trace.node_id === "string" ? trace.node_id : null,
    action_type: typeof trace.action_type === "string" ? trace.action_type : "unknown",
    reason,
  });
}

function fallbackWorkflowSummary(id: string, name: string): WorkflowSummary {
  const timestamp = new Date().toISOString();
  return {
    id,
    name,
    step_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function commandError(message: string, field?: string): CommandError {
  return { message, field };
}
