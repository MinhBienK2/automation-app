// @vitest-environment node
import path from "node:path";
import { describe, expect, test } from "vitest";
import { createRunnerSupervisor } from "./runnerSupervisor";

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
});
