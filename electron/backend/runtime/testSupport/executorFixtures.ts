import type {
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";

/**
 * Shared fixtures for testing action executors.
 *
 * Both executor test files previously carried verbatim copies of these two
 * factories — the only difference between the copies was one default `random`
 * value — so a change to the runtime shape had to be applied twice and the copies
 * were free to drift.
 *
 * This module lives outside a `*.test.ts` name on purpose: that way it is inside
 * the electron TypeScript project and the fixtures are type-checked against the
 * real runtime and dependency shapes. A fixture that has drifted from what
 * executors actually receive is worse than no fixture.
 */

export function minimalRuntime(
  overrides: Partial<RunnerActionRuntime> = {},
): RunnerActionRuntime {
  const page = overrides.page ?? ({
    goto: async () => undefined,
    locator: () => {
      throw new Error("not used");
    },
    evaluate: async () => "",
  } as unknown as RunnerActionRuntime["page"]);

  return {
    runId: "run-1",
    settings: {
      run_policy: { execute_js_enabled: true },
    } as RunnerActionRuntime["settings"],
    context: {
      pages: () => [page],
      newPage: async () => page,
      close: async () => undefined,
    } as unknown as RunnerActionRuntime["context"],
    page,
    outputs: {},
    elementRefs: new Map(),
    clipboard: "",
    currentStepNumber: null,
    currentStepId: null,
    currentStepName: null,
    currentActionType: null,
    currentActionSummary: null,
    currentStepMetadata: null,
    signal: undefined,
    ...overrides,
  };
}

export function minimalDependencies(
  overrides: Partial<RunnerActionExecutorDependencies> = {},
): RunnerActionExecutorDependencies {
  return {
    appPaths: { evidenceDir: "/tmp/evidence" } as RunnerActionExecutorDependencies["appPaths"],
    random: () => 0.5,
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
