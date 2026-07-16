
import type {
  CompiledWorkflowGraph,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import { executeDesktopAction } from "./DesktopActionExecutors.js";
import { pushActionTrace, actionConfigSummary } from "../runtime/actionTrace.js";
import type { ActionTrace } from "../runtime/actionTrace.js";

export type RunnerRunRequest = {
  runId: string;
  graph: CompiledWorkflowGraph;
  settings: WorkflowSettings;
  mode: "run_workflow" | "test_step";
  targetStepId?: string;
  reuseRetainedSession?: boolean;
  retainedSessionWorkflowId?: string;
  signal?: AbortSignal;
  onProgress?: (progress: Partial<RunState>) => void;
};

function createInitialState(request: RunnerRunRequest, outputs: Record<string, unknown>): RunState {
  if (request.settings.environment?.initial_variables) {
    for (const variable of request.settings.environment.initial_variables) {
      outputs[variable.name] = variable.value;
    }
  }

  return {
    status: "running",
    mode: request.mode,
    target_step_id: request.targetStepId ?? null,
    current_step_id: null,
    current_step_number: null,
    completed_step_ids: [],
    outputs,
    retained_session: {
      available: false,
      workflow_id: null,
      profile_name: null,
      reason: "Desktop does not use retained sessions",
    },
    error: null,
  };
}

export class DesktopWorkflowRunner {
  private traces: ActionTrace[] = [];

  constructor() {}

  getTraces(): ActionTrace[] {
    return this.traces;
  }

  async run(request: RunnerRunRequest): Promise<RunState> {
    const outputs: Record<string, unknown> = {};
    const state = createInitialState(request, outputs);
    let stepNumber = 0;
    this.traces = [];

    for (const step of request.graph.steps) {
      if (request.signal?.aborted) {
        state.status = "stopped";
        break;
      }

      stepNumber++;
      state.current_step_id = step.node_id;
      state.current_step_number = stepNumber;

      if (request.onProgress) {
        request.onProgress({ ...state });
      }

      const startedAt = new Date().toISOString();
      try {
        await executeDesktopAction(step.config as any, outputs, request.signal);
        
        pushActionTrace(this as any, {
          node_id: step.node_id,
          label: step.label,
          action_type: step.config.type,
          action_summary: actionConfigSummary(step.config),
          status: "success",
          mode: "manual",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
        });

        state.completed_step_ids.push(step.node_id);
      } catch (err: any) {
        const isAborted = request.signal?.aborted || err.message === "Aborted";
        
        pushActionTrace(this as any, {
          node_id: step.node_id,
          label: step.label,
          action_type: step.config.type,
          action_summary: actionConfigSummary(step.config),
          status: isAborted ? "stopped" : "failed",
          mode: "manual",
          started_at: startedAt,
          finished_at: new Date().toISOString(),
          reason: err.message || String(err),
        });

        state.status = isAborted ? "stopped" : "failed";
        if (!isAborted) {
          state.error = {
            step_id: step.node_id,
            step_number: stepNumber,
            step_name: step.label || "Step",
            action_type: step.config.type,
            reason: err.message || String(err),
          };
        }
        break;
      }

      if (request.onProgress) {
        request.onProgress({ ...state });
      }

      if (request.mode === "test_step" && request.targetStepId === step.node_id) {
        break;
      }
    }

    if (state.status === "running") {
      state.status = "success";
    }

    return state;
  }

  async closeRetainedContext(): Promise<void> {}
  async closeRetainedSession(): Promise<void> {}
  hasReusableRetainedSession(): boolean { return false; }
  getRetainedSessionState() {
    return {
      available: false,
      workflow_id: null,
      profile_name: null,
      reason: "Desktop does not use retained sessions",
    };
  }
  getRetainedSessionStates() { return []; }
  createIsolatedRunRunner() { return this; }
}
