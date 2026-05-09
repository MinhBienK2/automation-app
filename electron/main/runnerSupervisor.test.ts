// @vitest-environment node
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createRunnerSupervisor } from "./runnerSupervisor";
import type { RunnerEvent, StartRunPayload } from "../shared/product";

function minimalPayload(): StartRunPayload {
  return {
    protocolVersion: 1,
    runId: "run_process_1",
    workflowId: "wf_1",
    runPlan: {
      schemaVersion: 1,
      workflowId: "wf_1",
      graphVersionId: "gv_1",
      steps: [],
      nodeMap: {},
    },
    runProfileSnapshot: { timeoutMs: 30_000 },
    identityProfileSnapshot: {
      id: "id_default",
      name: "Default",
      browserEngine: "cloakbrowser",
      headless: true,
      profileReuseEnabled: false,
    },
    environmentSnapshot: {},
    artifactDirectories: {
      root: "/tmp/run_process_1",
      screenshots: "/tmp/run_process_1/screenshots",
      downloads: "/tmp/run_process_1/downloads",
      traces: "/tmp/run_process_1/traces",
      evidence: "/tmp/run_process_1/evidence",
    },
    operatorPolicySnapshot: { allowedOrigins: [], maxConcurrency: 1 },
  };
}

function createStreamingRunnerScript() {
  const directory = mkdtempSync(path.join(tmpdir(), "cloak-runner-supervisor-"));
  const runnerEntry = path.join(directory, "runner.mjs");
  writeFileSync(
    runnerEntry,
    `
      import readline from "node:readline";

      const lines = readline.createInterface({
        input: process.stdin,
        crlfDelay: Number.POSITIVE_INFINITY,
      });

      function send(message) {
        process.stdout.write(JSON.stringify(message) + "\\n");
      }

      send({ type: "runner.ready", ok: true, payload: { protocolVersion: 1 } });

      lines.on("line", (line) => {
        const message = JSON.parse(line);
        if (message.type === "startRun") {
          send({
            id: message.id,
            type: "event",
            payload: {
              type: "run.started",
              severity: "info",
              runId: message.payload.runId,
              payload: { workflowId: message.payload.workflowId },
              createdAt: "2026-05-09T00:00:00.000Z"
            }
          });
          send({
            id: message.id,
            type: "event",
            payload: {
              type: "run.completed",
              severity: "info",
              runId: message.payload.runId,
              payload: { status: "completed" },
              createdAt: "2026-05-09T00:00:01.000Z"
            }
          });
          send({
            id: message.id,
            ok: true,
            payload: { runId: message.payload.runId, status: "completed" }
          });
          return;
        }
        if (message.type === "shutdown") {
          send({ id: message.id, ok: true, payload: { ok: true } });
          process.exit(0);
        }
      });
    `,
  );

  return {
    runnerEntry,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}

function createIgnoringCancelRunnerScript() {
  const directory = mkdtempSync(path.join(tmpdir(), "cloak-runner-ignore-cancel-"));
  const runnerEntry = path.join(directory, "runner.mjs");
  writeFileSync(
    runnerEntry,
    `
      import readline from "node:readline";

      const lines = readline.createInterface({
        input: process.stdin,
        crlfDelay: Number.POSITIVE_INFINITY,
      });

      function send(message) {
        process.stdout.write(JSON.stringify(message) + "\\n");
      }

      lines.on("line", (line) => {
        const message = JSON.parse(line);
        if (message.type === "healthCheck") {
          send({
            id: message.id,
            ok: true,
            payload: {
              protocolVersion: 1,
              ok: true,
              capabilities: { actions: [], transport: "stdio-jsonl", browserEngine: "cloakbrowser" }
            }
          });
          return;
        }
        if (message.type === "cancelRun") {
          return;
        }
      });
    `,
  );

  return {
    runnerEntry,
    dispose: () => rmSync(directory, { recursive: true, force: true }),
  };
}

describe("RunnerSupervisor", () => {
  test("spawns the local runner process and completes the health handshake", async () => {
    const supervisor = createRunnerSupervisor({
      runnerEntry: path.resolve("electron/runner/stdio-runner.mjs"),
    });

    try {
      const health = await supervisor.healthCheck();

      expect(health).toMatchObject({
        protocolVersion: 1,
        ok: true,
        capabilities: expect.objectContaining({
          actions: expect.arrayContaining(["navigate", "click", "fill", "wait", "take_screenshot"]),
          transport: "stdio-jsonl",
        }),
      });
    } finally {
      await supervisor.shutdown();
    }
  });

  test("starts a process-backed run and streams runner events before the terminal result", async () => {
    const script = createStreamingRunnerScript();
    const supervisor = createRunnerSupervisor({
      runnerEntry: script.runnerEntry,
    });
    const events: RunnerEvent[] = [];

    try {
      const result = await supervisor.startRun(minimalPayload(), (event) => events.push(event));

      expect(result).toEqual({ runId: "run_process_1", status: "completed" });
      expect(events.map((event) => event.type)).toEqual(["run.started", "run.completed"]);
    } finally {
      await supervisor.shutdown();
      script.dispose();
    }
  });

  test("kills and restarts the runner when cancelRun does not respond", async () => {
    const script = createIgnoringCancelRunnerScript();
    const supervisor = createRunnerSupervisor({
      runnerEntry: script.runnerEntry,
      requestTimeoutMs: 200,
    });

    try {
      await expect(supervisor.cancelRun({ runId: "run_1" })).rejects.toThrow(
        "Runner request 'cancelRun' timed out.",
      );
      await expect(supervisor.healthCheck()).resolves.toMatchObject({
        ok: true,
      });
    } finally {
      await supervisor.shutdown();
      script.dispose();
    }
  });
});
