import type {
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import type { WebSurface } from "../surface.js";

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

/**
 * `page` and `context` stay first-class overrides even though the runtime now
 * carries a surface: a test that wants a spy page should say so, not assemble
 * a surface literal around it.
 */
export function minimalRuntime(
  overrides: Partial<RunnerActionRuntime> & {
    page?: WebSurface["page"];
    context?: WebSurface["context"];
  } = {},
): RunnerActionRuntime {
  const { page: pageOverride, context: contextOverride, ...rest } = overrides;
  const overriddenSurface = rest.surface?.kind === "web" ? rest.surface : undefined;
  const page = pageOverride ?? overriddenSurface?.page ?? ({
    goto: async () => undefined,
    locator: () => {
      throw new Error("not used");
    },
    evaluate: async () => "",
  } as unknown as WebSurface["page"]);

  return {
    runId: "run-1",
    settings: {
      run_policy: { execute_js_enabled: true },
    } as RunnerActionRuntime["settings"],
    outputs: {},
    elementRefs: new Map(),
    clipboard: "",
    currentStepNumber: null,
    currentStepId: null,
    currentStepName: null,
    currentActionType: null,
    currentActionSummary: null,
    currentActionSensitive: null,
    currentStepMetadata: null,
    signal: undefined,
    ...rest,
    surface: rest.surface ?? {
      kind: "web",
      context:
        contextOverride ??
        overriddenSurface?.context ??
        ({
          pages: () => [page],
          newPage: async () => page,
          close: async () => undefined,
        } as unknown as WebSurface["context"]),
      page,
    },
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
