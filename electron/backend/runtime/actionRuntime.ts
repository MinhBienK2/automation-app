/**
 * What an action executor is allowed to read.
 *
 * The runner has one run state, but executors do not all need the same slice of
 * it, and handing every executor the whole thing is what made a second
 * execution surface expensive: the number, text, boolean, list, object, date,
 * crypto, file and HTTP families never touch a browser, yet each received a
 * live page and browser context.
 *
 * So the shapes here are ordered by what they concede:
 *
 * - `VariableScope` — run outputs and step identity. Enough for every
 *   data-only action, and testable with no browser anywhere in sight.
 * - `RunnerActionRuntime` — `VariableScope` plus the live page. Only actions
 *   that drive a browser ask for it.
 *
 * The runner's own `Runtime` extends `RunnerActionRuntime` with the fields only
 * it touches — traces, evidence, live state, domain policy, progress — which
 * executors referenced zero times.
 *
 * Spec: `docs/architecture/runner.md`. Ticket: #32.
 */

import type {
  ActionConfig,
  CompiledNestedAction,
  CompiledStepMetadata,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import type { SurfaceStepTrace } from "./actionTrace.js";
import type { ExecutionSurface } from "./surface.js";
import type { AppPaths } from "../db/database.js";
import type { RuntimeElementRef } from "./targetResolver.js";

/** Run state that has nothing to do with any execution surface. */
export type VariableScope = {
  runId: string;
  settings: WorkflowSettings;
  outputs: Record<string, unknown>;
  elementRefs: Map<string, RuntimeElementRef>;
  clipboard: string;
  currentStepNumber: number | null;
  currentStepId: string | null;
  currentStepName: string | null;
  currentActionType: string | null;
  currentActionSummary: string | null;
  /**
   * The current step's `sensitive` flag, lifted from its action config.
   *
   * Carried on the runtime because the runner's failure path needs it and does
   * not receive the config. Reading it from `currentStepMetadata` instead was a
   * bug: that type declares only `subflow`, so the lookup silently produced
   * `undefined` and every sensitive step that failed got photographed.
   */
  currentActionSensitive: boolean | null;
  currentStepMetadata: CompiledStepMetadata | null;
  signal?: AbortSignal;
};

/**
 * `VariableScope` plus the thing being driven.
 *
 * The surface is a discriminated union rather than a page, so adding the
 * Desktop Surface costs nothing for the executors that never asked for one.
 * Surface-acting executors narrow it once, at the entry of their family.
 */
export type SurfaceActing = VariableScope & {
  surface: ExecutionSurface;
  /**
   * What the surface did to carry out the current step — the resolved element,
   * how it matched, the Capability Tier, the verify verdict.
   *
   * Written by the executor and read by the runner when it pushes the step's
   * trace, for the same reason `currentActionSensitive` is here: the runner
   * composes the trace and never sees the action's config or its driver. The
   * runner clears it before each step, so a trace can never carry the previous
   * step's element.
   */
  currentSurfaceTrace: SurfaceStepTrace | null;
};

/** The shape a surface-acting executor receives. */
export type RunnerActionRuntime = SurfaceActing;

export type ActionTargetConfig = {
  target?: Extract<ActionConfig, { type: "click" }>["config"]["target"];
};

/**
 * What a data-only or flow-control executor may call.
 *
 * Generic over the caller's runtime so the flow-control callbacks can
 * round-trip the runner's own richer state without widening what the executor
 * body may read.
 */
export type DataActionDependencies<Runtime extends VariableScope = VariableScope> = {
  appPaths: AppPaths;
  random: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  executeActions: (runtime: Runtime, actions: CompiledNestedAction[]) => Promise<void>;
  executeLoopBody: (
    runtime: Runtime,
    steps: CompiledNestedAction[],
  ) => Promise<"completed" | "break" | "continue">;
  executeRetry: (
    runtime: Runtime,
    attempts: number,
    delayMs: number,
    steps: CompiledNestedAction[],
    failedSteps: CompiledNestedAction[],
  ) => Promise<void>;
  executeLoop: (
    runtime: Runtime,
    steps: CompiledNestedAction[],
    maxAttempts: number,
    predicate: () => Promise<boolean>,
    timeoutMs?: number | null,
  ) => Promise<"predicate_false" | "max_attempts" | "timeout" | "break">;
  conditionMatches: (runtime: Runtime, condition: unknown) => Promise<boolean>;
  createLoopControl: (kind: "break" | "continue") => Error;
  createRunnerStop: (
    status: "success" | "failure" | "stopped",
    message: string,
    closeBrowser?: boolean,
  ) => Error;
};

/** Everything above, plus the calls that need a page. */
export type RunnerActionExecutorDependencies<
  Runtime extends RunnerActionRuntime = RunnerActionRuntime,
> = DataActionDependencies<Runtime> & {
  enforceNavigationPolicy: (runtime: Runtime, url: string) => Promise<void>;
  executeWait: (
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "wait" }>,
  ) => Promise<void>;
  locatorForAction: (
    runtime: Runtime,
    config: {
      target?: ActionTargetConfig["target"];
      target_ref?: string | null;
      xpath?: string | null;
      iframe_xpath?: string | null;
      wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
      timeout_ms?: number | null;
    },
    fallbackXpath?: string,
  ) => Promise<BrowserDriverLocator>;
  executeFindElement: (
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "find_element" }>,
  ) => Promise<void>;
  executeDragAndDrop: (
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  ) => Promise<void>;
  executeScroll: (
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "scroll" }>,
  ) => Promise<void>;
  pressKeyHuman: (
    page: BrowserDriverPage,
    key: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  pressHotkeyHuman: (
    page: BrowserDriverPage,
    keys: string[],
    signal?: AbortSignal,
  ) => Promise<void>;
  executePasteClipboard: (
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "paste_clipboard" }>,
  ) => Promise<void>;
  locatorForCustomSelectTrigger: (
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "select_custom_option" }>,
  ) => Promise<BrowserDriverLocator>;
  registerDialogHandler: (
    runtime: Runtime,
    behavior: "accept" | "dismiss",
    promptText?: string,
  ) => void;
  waitForDownload: (
    runtime: Runtime,
    outputName: string,
    timeoutMs: number | null | undefined,
  ) => Promise<string>;
  recordEvidence: (
    runtime: Runtime,
    artifact: {
      actionType: string;
      artifactKind: "screenshot" | "download";
      relativePath: string;
    },
  ) => void;
};
