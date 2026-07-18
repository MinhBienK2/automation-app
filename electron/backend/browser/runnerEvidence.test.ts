// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { RunnerActionRuntime } from "./BrowserActionExecutors.js";
import {
  collectRunnerOutputs,
  recordRunnerEvidence,
} from "./runnerEvidence.js";

describe("runnerEvidence", () => {
  test("records evidence against the current runtime step", () => {
    const runtime = {
      runId: "run-1",
      currentStepId: "step-1",
      currentStepNumber: 2,
      evidence: [],
    } as unknown as RunnerActionRuntime;

    recordRunnerEvidence(runtime, {
      actionType: "take_screenshot",
      artifactKind: "screenshot",
      relativePath: "runs/run-1/shot.png",
    });

    expect(runtime.evidence).toMatchObject([
      {
        run_id: "run-1",
        node_id: "step-1",
        step_number: 2,
        action_type: "take_screenshot",
        artifact_kind: "screenshot",
        path: "runs/run-1/shot.png",
      },
    ]);
  });

  test("collects page outputs with runtime outputs taking precedence", async () => {
    const runtime = {
      outputs: { shared: "runtime", local: true },
      page: {
        evaluate: async () => ({ shared: "page", page_only: 1 }),
      },
    } as unknown as RunnerActionRuntime;

    await expect(collectRunnerOutputs(runtime)).resolves.toMatchObject({
      shared: "runtime",
      local: true,
      page_only: 1,
    });
  });
});
