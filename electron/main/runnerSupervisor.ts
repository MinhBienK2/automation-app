import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import type { RunnerEvent, RunnerResult, StartRunPayload } from "../shared/product.js";

export type RunnerHealth = {
  protocolVersion: 1;
  ok: boolean;
  capabilities: {
    actions: string[];
    transport: string;
    browserEngine: string;
  };
};

type RunnerSupervisorOptions = {
  runnerEntry: string;
};

type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  onEvent?: (event: RunnerEvent) => void;
};

type RunnerResponse = {
  id?: string;
  type?: string;
  ok?: boolean;
  error?: string;
  payload?: unknown;
};

export function createRunnerSupervisor(options: RunnerSupervisorOptions) {
  let child: ChildProcessWithoutNullStreams | null = null;
  let stdoutBuffer = "";
  const pending = new Map<string, PendingRequest<unknown>>();

  function ensureStarted() {
    if (child && !child.killed) return;

    child = spawn(process.execPath, [path.resolve(options.runnerEntry)], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        ELECTRON_CLOAK_RUNNER: "1",
      },
    });

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      stdoutBuffer += chunk;
      let newlineIndex = stdoutBuffer.indexOf("\n");
      while (newlineIndex >= 0) {
        const line = stdoutBuffer.slice(0, newlineIndex).trim();
        stdoutBuffer = stdoutBuffer.slice(newlineIndex + 1);
        if (line.length > 0) {
          handleLine(line);
        }
        newlineIndex = stdoutBuffer.indexOf("\n");
      }
    });

    child.on("exit", (code, signal) => {
      const error = new Error(`Runner exited before response (code=${code ?? "null"}, signal=${signal ?? "null"}).`);
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(error);
      }
      pending.clear();
      child = null;
    });
  }

  function handleLine(line: string) {
    let message: RunnerResponse;
    try {
      message = JSON.parse(line) as RunnerResponse;
    } catch {
      return;
    }

    if (!message.id) return;
    const request = pending.get(message.id);
    if (!request) return;

    if (message.type === "event") {
      request.onEvent?.(message.payload as RunnerEvent);
      return;
    }

    pending.delete(message.id);
    clearTimeout(request.timeout);

    if (message.ok && message.payload) {
      request.resolve(message.payload);
    } else {
      request.reject(new Error(message.error || "Runner request failed."));
    }
  }

  function request<T>(
    type: string,
    payload?: Record<string, unknown>,
    onEvent?: (event: RunnerEvent) => void,
  ) {
    ensureStarted();
    if (!child) throw new Error("Runner process did not start.");

    const requestId = randomUUID();
    const message = JSON.stringify({ id: requestId, type, payload: payload ?? {} });

    return new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(requestId);
        reject(new Error(`Runner request '${type}' timed out.`));
      }, 5_000);

      pending.set(requestId, {
        resolve: resolve as PendingRequest<unknown>["resolve"],
        reject,
        timeout,
        onEvent,
      });
      child?.stdin.write(`${message}\n`);
    });
  }

  return {
    healthCheck() {
      return request<RunnerHealth>("healthCheck");
    },

    startRun(payload: StartRunPayload, onEvent: (event: RunnerEvent) => void) {
      return request<RunnerResult>("startRun", payload as unknown as Record<string, unknown>, onEvent);
    },

    cancelRun(input: { runId: string }) {
      return request<{ ok: true }>("cancelRun", input);
    },

    async shutdown() {
      if (!child) return;
      const target = child;
      try {
        await request<{ ok: true }>("shutdown");
      } catch {
        target.kill();
      }

      if (!target.killed) {
        target.kill();
      }
    },
  };
}
