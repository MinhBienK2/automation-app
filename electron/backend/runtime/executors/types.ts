import type {
  ActionConfig,
  CompiledNestedAction,
  CompiledStepMetadata,
  WorkflowSettings,
} from "../../../../src/types/workflow.js";
import type {
  BrowserDriverContext,
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../../browser/sessionManager.js";
import type { AppPaths } from "../../db/database.js";
import type { RuntimeElementRef } from "../targetResolver.js";
import type { ExecutionSurface } from "../surface.js";
import type { SurfaceStepTrace } from "../actionTrace.js";

/**
 * What an action executor is given.
 *
 * This is the narrow half of the runner's run state — the fields an executor can
 * actually read. `traces`, `evidence`, `liveState`, `domainPolicy` and
 * `onProgress` were part of this shape and referenced zero times across the whole
 * executor module; they stay on the runner's own `Runtime`, which extends this
 * type rather than restating it, so the shared fields are declared once.
 */
export type RunnerActionRuntime = {
  runId: string;
  settings: WorkflowSettings;
  surface: ExecutionSurface;
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  outputs: Record<string, unknown>;
  elementRefs: Map<string, RuntimeElementRef>;
  clipboard: string;
  currentStepNumber: number | null;
  currentStepId: string | null;
  currentStepName: string | null;
  currentActionType: string | null;
  currentActionSummary: string | null;
  currentActionSensitive: boolean | null;
  currentSurfaceTrace: SurfaceStepTrace | null;
  currentStepMetadata: CompiledStepMetadata | null;
  activeFrameXpath?: string | null;
  signal?: AbortSignal;
};

/**
 * Generic over the caller's runtime so the flow-control callbacks can round-trip
 * the runner's own richer state without widening what the executors themselves
 * can read: an executor body only ever sees `RunnerActionRuntime` members.
 */
export type RunnerActionExecutorDependencies<
  Runtime extends RunnerActionRuntime = RunnerActionRuntime,
> = {
  appPaths: AppPaths;
  random: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
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
  executeActions: (
    runtime: Runtime,
    actions: CompiledNestedAction[],
  ) => Promise<void>;
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
  recordEvidence: (
    runtime: Runtime,
    artifact: {
      actionType: string;
      artifactKind: "screenshot" | "download";
      relativePath: string;
    },
  ) => void;
  createLoopControl: (kind: "break" | "continue") => Error;
  createRunnerStop: (
    status: "success" | "failure" | "stopped",
    message: string,
    closeBrowser?: boolean,
  ) => Error;
};

type ActionTargetConfig = {
  target?: Extract<ActionConfig, { type: "click" }>["config"]["target"];
};
