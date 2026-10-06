import type {
  ActionConfig,
  CompiledNestedAction,
} from "../../../src/types/workflow.js";
import { collectNestedNodeIds } from "./nestedExecutionHelpers.js";
import {
  actionConfigSummary,
  actionEvidenceModel,
  actionSummaryTraceField,
  actionTraceMode,
  pushActionTrace,
  snapshotOutputs,
  subflowTraceFields,
  summarizeActionEffects,
  surfaceTraceField,
} from "./actionTrace.js";
import { withLoopScope } from "./loopScope.js";
import {
  type Runtime,
  LoopControl,
  isAbortError,
} from "./runnerTypes.js";

export type NestedStepExecutorDependencies = {
  executeAction: (runtime: Runtime, action: ActionConfig) => Promise<void>;
  reportProgress: (runtime: Runtime) => void;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  throwIfCancelled: (signal?: AbortSignal) => void;
};

export class NestedStepExecutor {
  constructor(private readonly deps: NestedStepExecutorDependencies) {}

  async executeActions(runtime: Runtime, actions: CompiledNestedAction[]): Promise<void> {
    for (const action of actions) {
      this.deps.throwIfCancelled(runtime.signal);
      if (!action.graph_node_id) {
        await this.deps.executeAction(runtime, action);
        continue;
      }
      const previous = {
        runtimeStepId: runtime.currentStepId,
        runtimeActionType: runtime.currentActionType,
        runtimeActionSummary: runtime.currentActionSummary,
        runtimeStepMetadata: runtime.currentStepMetadata,
        runtimeStepName: runtime.currentStepName,
        stateStepId: runtime.liveState.current_step_id,
      };
      runtime.currentStepId = action.graph_node_id;
      runtime.currentActionType = action.type;
      runtime.currentActionSummary = actionConfigSummary(action);
      runtime.currentStepMetadata = action.graph_metadata ?? null;
      runtime.currentStepName = action.graph_label ?? action.graph_node_id;
      runtime.liveState.current_step_id = action.graph_node_id;
      try {
        this.deps.reportProgress(runtime);
        await this.executeNestedAction(runtime, action, previous.runtimeStepId);
        runtime.liveState.completed_step_ids.push(action.graph_node_id);
        this.deps.reportProgress(runtime);
      } catch (error) {
        if (!(error instanceof LoopControl)) {
          if (!runtime.failedStepInfo) {
            runtime.failedStepInfo = {
              step_id: action.graph_node_id,
              step_name: action.graph_label ?? action.graph_node_id,
              action_type: action.type,
              action_summary: actionConfigSummary(action),
              metadata: action.graph_metadata ?? null,
              parent_step_id: previous.runtimeStepId,
              parent_step_ids: previous.runtimeStepId ? [previous.runtimeStepId] : [],
            };
          } else if (previous.runtimeStepId) {
            if (!runtime.failedStepInfo.parent_step_ids) {
              runtime.failedStepInfo.parent_step_ids = [];
            }
            if (!runtime.failedStepInfo.parent_step_ids.includes(previous.runtimeStepId)) {
              runtime.failedStepInfo.parent_step_ids.unshift(previous.runtimeStepId);
            }
          }
        }
        throw error;
      } finally {
        runtime.currentStepId = previous.runtimeStepId;
        runtime.currentActionType = previous.runtimeActionType;
        runtime.currentActionSummary = previous.runtimeActionSummary;
        runtime.currentStepMetadata = previous.runtimeStepMetadata;
        runtime.currentStepName = previous.runtimeStepName;
        runtime.liveState.current_step_id = previous.stateStepId;
      }
    }
  }

  async executeNestedAction(
    runtime: Runtime,
    action: CompiledNestedAction,
    parentNodeId: string | null,
  ): Promise<void> {
    const startedAt = new Date().toISOString();
    const nodeId = action.graph_node_id ?? runtime.currentStepId ?? "nested";
    const outputSnapshot = snapshotOutputs(runtime.outputs);
    const evidenceStartIndex = runtime.evidence.length;
    runtime.currentSurfaceTrace = null;
    try {
      await this.deps.executeAction(runtime, action);
      pushActionTrace(runtime, {
        node_id: nodeId,
        label: action.graph_label ?? nodeId,
        action_type: action.type,
        parent_node_id: parentNodeId,
        status: "success",
        mode: actionTraceMode(action),
        ...actionEvidenceModel(action),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...summarizeActionEffects(runtime, outputSnapshot, evidenceStartIndex),
        ...surfaceTraceField(runtime),
      });
    } catch (error) {
      pushActionTrace(runtime, {
        node_id: nodeId,
        label: action.graph_label ?? nodeId,
        action_type: action.type,
        ...actionSummaryTraceField(action),
        ...subflowTraceFields(action.graph_metadata),
        parent_node_id: parentNodeId,
        status: isAbortError(error) ? "stopped" : "failed",
        mode: actionTraceMode(action),
        ...actionEvidenceModel(action),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...summarizeActionEffects(runtime, outputSnapshot, evidenceStartIndex),
        ...surfaceTraceField(runtime),
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  async executeLoopBody(
    runtime: Runtime,
    steps: CompiledNestedAction[],
  ): Promise<"completed" | "break" | "continue"> {
    const nestedIds = collectNestedNodeIds(steps);
    if (nestedIds.length > 0) {
      const nestedSet = new Set(nestedIds);
      runtime.liveState.completed_step_ids = runtime.liveState.completed_step_ids.filter(
        (id) => !nestedSet.has(id),
      );
      this.deps.reportProgress(runtime);
    }
    try {
      await this.executeActions(runtime, steps);
      return "completed";
    } catch (error) {
      if (error instanceof LoopControl) return error.kind;
      throw error;
    }
  }

  async executeRetry(
    runtime: Runtime,
    attempts: number,
    delayMs: number,
    steps: CompiledNestedAction[],
    failedSteps: CompiledNestedAction[],
  ): Promise<void> {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      const nestedIds = collectNestedNodeIds(steps);
      if (nestedIds.length > 0) {
        const nestedSet = new Set(nestedIds);
        runtime.liveState.completed_step_ids = runtime.liveState.completed_step_ids.filter(
          (id) => !nestedSet.has(id),
        );
        this.deps.reportProgress(runtime);
      }
      try {
        await this.executeActions(runtime, steps);
        return;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts && delayMs > 0) {
          await this.deps.sleep(delayMs, runtime.signal);
        }
      }
    }
    if (failedSteps.length > 0) {
      await this.executeActions(runtime, failedSteps);
      return;
    }
    throw lastError;
  }

  async executeLoop(
    runtime: Runtime,
    steps: CompiledNestedAction[],
    maxAttempts: number,
    predicate: () => Promise<boolean>,
    timeoutMs?: number | null,
  ): Promise<"predicate_false" | "max_attempts" | "timeout" | "break"> {
    return withLoopScope(runtime.outputs, async (iteration) => {
      let attempts = 0;
      const startedAt = Date.now();
      while (await predicate()) {
        if (timeoutMs != null && Date.now() - startedAt >= timeoutMs) return "timeout";
        if (attempts >= maxAttempts) return "max_attempts";
        iteration(attempts);
        attempts += 1;
        const control = await this.executeLoopBody(runtime, steps);
        if (control === "break") return "break";
        if (timeoutMs != null && Date.now() - startedAt >= timeoutMs) return "timeout";
      }
      return "predicate_false";
    });
  }
}
