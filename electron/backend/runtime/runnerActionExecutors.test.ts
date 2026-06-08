// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../actions/execution.js";
import type { BrowserDriverPage } from "../browser/sessionManager.js";
import {
  createRunnerActionExecutors,
  type RunnerActionExecutorDependencies,
  type RunnerActionRuntime,
} from "./runnerActionExecutors.js";

describe("runnerActionExecutors", () => {
  test("renders navigation templates and delegates allowlist enforcement before goto", async () => {
    const calls: string[] = [];
    const page = {
      goto: async (url: string, options?: Record<string, unknown>) => {
        calls.push(`goto:${url}:${options?.waitUntil}`);
      },
      locator: () => {
        throw new Error("not used");
      },
      evaluate: async () => "",
    } satisfies BrowserDriverPage;
    const runtime = minimalRuntime({ page, outputs: { host: "owned.test" } });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      enforceNavigationPolicy: async (_runtime, url) => {
        calls.push(`policy:${url}`);
      },
    }));

    await executeRegisteredAction(executors, {
      type: "navigate",
      config: {
        url: "https://{{ host }}/dashboard",
        wait_until: "dom_content_loaded",
      },
    });

    expect(calls).toEqual([
      "policy:https://owned.test/dashboard",
      "goto:https://owned.test/dashboard:domcontentloaded",
    ]);
  });
});

function minimalRuntime(overrides: Partial<RunnerActionRuntime> = {}): RunnerActionRuntime {
  const page = overrides.page ?? {
    goto: async () => undefined,
    locator: () => {
      throw new Error("not used");
    },
    evaluate: async () => "",
  };
  return {
    runId: "run-1",
    settings: {
      run_policy: { execute_js_enabled: true },
    } as RunnerActionRuntime["settings"],
    context: {
      pages: () => [page],
      newPage: async () => page,
      close: async () => undefined,
    },
    page,
    domainPolicy: null,
    outputs: {},
    elementRefs: new Map(),
    traces: [],
    evidence: [],
    currentStepNumber: null,
    currentStepId: null,
    currentStepName: null,
    currentActionType: null,
    currentActionSummary: null,
    currentStepMetadata: null,
    liveState: {
      status: "running",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs: {},
      retained_session: null,
      error: null,
    },
    clipboard: "",
    signal: undefined,
    ...overrides,
  };
}

function minimalDependencies(
  overrides: Partial<RunnerActionExecutorDependencies> = {},
): RunnerActionExecutorDependencies {
  return {
    appPaths: { evidenceDir: "/tmp/evidence" } as RunnerActionExecutorDependencies["appPaths"],
    random: () => 0,
    sleep: async () => undefined,
    enforceNavigationPolicy: async () => undefined,
    executeWait: async () => undefined,
    locatorForAction: async () => {
      throw new Error("locatorForAction not configured");
    },
    executeFindElement: async () => undefined,
    executeDragAndDrop: async () => undefined,
    executeScroll: async () => undefined,
    pressKeyHuman: async () => undefined,
    pressHotkeyHuman: async () => undefined,
    executePasteClipboard: async () => undefined,
    locatorForCustomSelectTrigger: async () => {
      throw new Error("locatorForCustomSelectTrigger not configured");
    },
    registerDialogHandler: () => undefined,
    waitForDownload: async () => "download",
    executeActions: async () => undefined,
    executeLoopBody: async () => "completed",
    executeRetry: async () => undefined,
    executeLoop: async () => "predicate_false",
    conditionMatches: async () => false,
    recordEvidence: () => undefined,
    createLoopControl: (kind) => new Error(kind),
    createRunnerStop: (_status, message) => new Error(message),
    ...overrides,
  };
}
