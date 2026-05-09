import readline from "node:readline";
import { createCloakBrowserAdapter } from "./cloakBrowserAdapter.js";
import { runPlan } from "./runnerCore.js";
import type { RunnerEvent, StartRunPayload } from "../shared/product.js";

const capabilities = {
  protocolVersion: 1,
  ok: true,
  capabilities: {
    actions: ["navigate", "click", "fill", "wait", "take_screenshot", "extract_text"],
    transport: "stdio-jsonl",
    browserEngine: "cloakbrowser",
  },
};

type RunnerRequest = {
  id?: string;
  type?: string;
  payload?: unknown;
};

const cancelledRunIds = new Set<string>();
const activeRunIds = new Set<string>();

function send(message: Record<string, unknown>) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function sendError(id: string | undefined, error: string) {
  send({
    id,
    ok: false,
    error,
  });
}

function sendEvent(id: string, event: RunnerEvent) {
  send({
    id,
    type: "event",
    payload: event,
  });
}

function parseStartRunPayload(value: unknown): StartRunPayload {
  const payload = value as Partial<StartRunPayload> | null;
  if (!payload || typeof payload !== "object") {
    throw new Error("startRun payload must be an object.");
  }
  if (payload.protocolVersion !== 1) {
    throw new Error("Unsupported runner protocol version.");
  }
  if (!payload.runId || !payload.workflowId || !payload.runPlan) {
    throw new Error("startRun payload is missing run id, workflow id, or run plan.");
  }
  return payload as StartRunPayload;
}

async function handleStartRun(id: string, payloadValue: unknown) {
  let payload: StartRunPayload;
  try {
    payload = parseStartRunPayload(payloadValue);
  } catch (error) {
    sendError(id, error instanceof Error ? error.message : String(error));
    return;
  }

  if (activeRunIds.has(payload.runId)) {
    sendError(id, `Run '${payload.runId}' is already active.`);
    return;
  }

  activeRunIds.add(payload.runId);
  cancelledRunIds.delete(payload.runId);

  try {
    const result = await runPlan(payload, createCloakBrowserAdapter(), {
      emit: (event) => sendEvent(id, event),
      isCancelled: () => cancelledRunIds.has(payload.runId),
    });
    send({ id, ok: true, payload: result });
  } catch (error) {
    sendError(id, error instanceof Error ? error.message : String(error));
  } finally {
    activeRunIds.delete(payload.runId);
    cancelledRunIds.delete(payload.runId);
  }
}

function handleCancelRun(id: string | undefined, payloadValue: unknown) {
  const payload = payloadValue as { runId?: unknown } | null;
  const runId = typeof payload?.runId === "string" ? payload.runId : null;
  if (!runId) {
    sendError(id, "cancelRun payload must include a run id.");
    return;
  }
  cancelledRunIds.add(runId);
  send({ id, ok: true, payload: { ok: true } });
}

send({
  type: "runner.ready",
  ok: true,
  payload: {
    protocolVersion: 1,
  },
});

const lines = readline.createInterface({
  input: process.stdin,
  crlfDelay: Number.POSITIVE_INFINITY,
});

lines.on("line", (line) => {
  if (!line.trim()) return;

  let message: RunnerRequest;
  try {
    message = JSON.parse(line) as RunnerRequest;
  } catch {
    sendError(undefined, "Malformed JSON request.");
    return;
  }

  if (message.type === "healthCheck") {
    send({ id: message.id, ok: true, payload: capabilities });
    return;
  }

  if (message.type === "startRun") {
    if (!message.id) {
      sendError(undefined, "startRun requires a request id.");
      return;
    }
    void handleStartRun(message.id, message.payload);
    return;
  }

  if (message.type === "cancelRun") {
    handleCancelRun(message.id, message.payload);
    return;
  }

  if (message.type === "shutdown") {
    send({ id: message.id, ok: true, payload: { ok: true } });
    process.exit(0);
  }

  sendError(message.id, `Unsupported runner command '${String(message.type)}'.`);
});
