import { randomUUID } from "node:crypto";
import type { DbAdapter } from "../db/dbAdapter.js";
import type {
  CompiledWorkflowGraph,
  WorkflowGraph,
  WorkflowRunSource,
  WorkflowSettings,
  WorkflowSummary,
  RunState,
} from "../../../src/types/workflow.js";
import { getMongoCollection } from "../db/mongo.js";

export function browserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return settings.browser_launch.profile_dir?.trim() || settings.browser_launch.profile_name?.trim() || null;
}

export async function beginRun(
  database: DbAdapter,
  workflowId: string,
  settings: WorkflowSettings,
  graph: WorkflowGraph,
  source: WorkflowRunSource = "manual",
): Promise<string> {
  const runId = randomUUID();
  await database.execute(
    `INSERT INTO runs (
      id,
      workflow_id,
      source,
      status,
      started_at,
      settings_snapshot_json,
      graph_snapshot_json,
      owner_id
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      runId,
      workflowId,
      source,
      "running",
      new Date().toISOString(),
      JSON.stringify(settings),
      JSON.stringify(graph),
      database.ownerId,
    ],
  );
  return runId;
}

export async function finishRun(
  database: DbAdapter,
  runId: string | null,
  graph: CompiledWorkflowGraph,
  state: RunState,
): Promise<void> {
  if (!runId) return;
  await database.transaction(async (tx) => {
    const outputsForDb = { ...state.outputs };
    delete outputsForDb.__action_traces;

    await tx.execute(
      `UPDATE runs
       SET status = $1,
           finished_at = $2,
           outputs_json = $3,
           error_json = $4
       WHERE id = $5 AND owner_id = $6`,
      [
        state.status,
        new Date().toISOString(),
        JSON.stringify(outputsForDb),
        state.error ? JSON.stringify(state.error) : null,
        runId,
        tx.ownerId,
      ],
    );

    const traces = Array.isArray(state.outputs?.__action_traces)
      ? (state.outputs.__action_traces as Array<Record<string, unknown>>)
      : [];

    const mongoCollection = await getMongoCollection("run_steps");

    if (mongoCollection) {
      const documents: any[] = [];

      for (const [index, step] of graph.steps.entries()) {
        const trace = traces.find((candidate) =>
          candidate.node_id === step.node_id && !isNestedTrace(candidate),
        ) ?? traces.find((candidate) => candidate.node_id === step.node_id);
        const failed = state.error?.step_id === step.node_id;
        const completed = state.completed_step_ids.includes(step.node_id);

        documents.push({
          id: randomUUID(),
          run_id: runId,
          node_id: step.node_id,
          step_number: index + 1,
          action_type: step.config.type,
          status: failed ? "failed" : completed ? "success" : "skipped",
          started_at: traceTimestamp(trace, "started_at"),
          finished_at: traceTimestamp(trace, "finished_at") ?? (trace || failed ? new Date().toISOString() : null),
          trace: trace ?? null,
          error: failed && state.error ? state.error : (trace ? traceErrorObject(trace) : null),
          owner_id: tx.ownerId,
          created_at: new Date().toISOString(),
        });
      }

      const nestedTraces = traces
        .map((trace, index) => ({ trace, index }))
        .filter(({ trace }) => isNestedTrace(trace))
        .sort((left, right) => traceOrder(left.trace, left.index) - traceOrder(right.trace, right.index));

      for (const [nestedIndex, { trace }] of nestedTraces.entries()) {
        documents.push({
          id: randomUUID(),
          run_id: runId,
          node_id: String(trace.node_id),
          step_number: graph.steps.length + nestedIndex + 1,
          action_type: typeof trace.action_type === "string" ? trace.action_type : "unknown",
          status: traceRunStepStatus(trace),
          started_at: traceTimestamp(trace, "started_at"),
          finished_at: traceTimestamp(trace, "finished_at") ?? new Date().toISOString(),
          trace: trace ?? null,
          error: traceErrorObject(trace),
          owner_id: tx.ownerId,
          created_at: new Date().toISOString(),
        });
      }

      if (documents.length > 0) {
        await mongoCollection.insertMany(documents);
      }
    }
  });
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

function traceErrorObject(trace: Record<string, unknown> | undefined) {
  if (!trace || trace.status !== "failed") return null;
  const reason = typeof trace.reason === "string" ? trace.reason : "Action failed";
  return {
    step_id: typeof trace.node_id === "string" ? trace.node_id : null,
    action_type: typeof trace.action_type === "string" ? trace.action_type : "unknown",
    reason,
  };
}

export function fallbackWorkflowSummary(id: string, name: string): WorkflowSummary {
  const timestamp = new Date().toISOString();
  return {
    id,
    name,
    // A stand-in for a workflow that could not be read. It says web because
    // that is what a workflow is unless its row says otherwise.
    surface: "web",
    step_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
  };
}

export function serializeVariableValue(valueType: string, value: unknown): string {
  if (value === undefined || value === null) {
    return "";
  }
  if (valueType === "json") {
    return JSON.stringify(value);
  }
  if (valueType === "boolean") {
    return value ? "true" : "false";
  }
  return String(value);
}
