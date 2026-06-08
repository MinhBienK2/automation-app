// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { RunnerActionRuntime } from "./runnerActionExecutors.js";
import { conditionMatches } from "./conditions.js";

describe("conditions", () => {
  test("matches output equality and containment conditions", async () => {
    const runtime = {
      outputs: {
        status: "ready",
        message: "hello owned world",
      },
    } as RunnerActionRuntime;

    await expect(conditionMatches(runtime, {
      kind: "output_equals",
      name: "status",
      value: "ready",
    })).resolves.toBe(true);
    await expect(conditionMatches(runtime, {
      kind: "output_contains",
      name: "message",
      value: "owned",
    })).resolves.toBe(true);
  });
});
