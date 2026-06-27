// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { RunnerActionRuntime } from "./runnerActionExecutors.js";
import { conditionMatches } from "./conditions.js";

describe("conditions", () => {
  test("matches check variable boolean conditions", async () => {
    const runtime = {
      outputs: {
        status: true,
        message: "true",
        wrong: false,
      },
    } as RunnerActionRuntime;

    await expect(conditionMatches(runtime, {
      kind: "variable_is_true",
      name: "status",
    })).resolves.toBe(true);
    await expect(conditionMatches(runtime, {
      kind: "variable_is_true",
      name: "message",
    })).resolves.toBe(true);
    await expect(conditionMatches(runtime, {
      kind: "variable_is_true",
      name: "wrong",
    })).resolves.toBe(false);
  });
});
