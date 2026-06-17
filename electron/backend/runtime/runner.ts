import { randomUUID } from "node:crypto";
import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledStepMetadata,
  CompiledWorkflowGraph,
  DragTargetPosition,
  ElementTarget,
  RunMode,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../persistence/database.js";
import {
  BrowserSessionManager,
  browserIdentityEvidence,
  retainedProfileKey,
  type BrowserDriver,
  type BrowserDriverContext,
  type BrowserDriverLocator,
  type BrowserDriverPage,
  type RetainedSession,
} from "../browser/sessionManager.js";
import {
  executeRegisteredAction,
} from "../actions/execution.js";
import { hostnameAllowed } from "./domainPolicy.js";
import {
  actionConfigSummary,
  actionEvidenceModel,
  actionSummaryTraceField,
  actionTraceMode,
  pushActionTrace,
  runtimeErrorDiagnostics,
  snapshotOutputs,
  subflowTraceFields,
  summarizeActionEffects,
  type ActionTrace,
} from "./actionTrace.js";
import {
  locatorFor,
  locatorForRuntimeElementRef,
  rankedCandidatesForTarget,
  selectRankedElementCandidate,
  type RuntimeElementRef,
} from "./targetResolver.js";
import {
  centerPoint,
  dragTargetPoint,
  type PointerBox,
} from "./interactionPrimitives.js";
import {
  cloakBrowserHumanScrollLocatorIntoView,
  executePasteClipboardAction,
  executeScrollAction,
  nativePointerLocatorIntoView,
  pressHotkeyHuman,
  pressKeyHuman,
  registerDialogHandler,
  type CloakHumanScrollAdapter,
} from "./interactionActions.js";
import {
  sleep,
  waitForLocatorState,
} from "./runtimeHelpers.js";
import { createRunnerActionExecutors } from "./runnerActionExecutors.js";
import { conditionMatches } from "./conditions.js";
import {
  captureFailureScreenshot,
  collectRunnerOutputs,
  recordRunnerEvidence,
  waitForRunnerDownload,
} from "./runnerEvidence.js";
import { resolveObjectTemplates } from "./variables.js";


export {
  createCloakBrowserDriver,
  type BrowserDriver,
  type BrowserDriverContext,
  type BrowserDriverLocator,
  type BrowserDriverPage,
  type BrowserLaunchOptions,
} from "../browser/sessionManager.js";
export type { BrowserDriverFrameLocator } from "../browser/sessionManager.js";

type RunnerOptions = {
  appPaths: AppPaths;
  driver?: BrowserDriver;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  cloakHumanScroll?: CloakHumanScrollAdapter;
  sessionManager?: BrowserSessionManager;
  retainedSessions?: Map<string, RetainedSession>;
  usesDefaultDriver?: boolean;
};

export type RunnerRunRequest = {
  runId?: string | null;
  graph: CompiledWorkflowGraph;
  settings: WorkflowSettings;
  mode: RunMode;
  targetStepId?: string | null;
  reuseRetainedSession?: boolean;
  retainedSessionWorkflowId?: string | null;
  signal?: AbortSignal;
  onProgress?: (state: Partial<RunState>) => void;
};

type Runtime = {
  runId: string;
  settings: WorkflowSettings;
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  domainPolicy: { allowed_domains: string[] } | null;
  outputs: Record<string, unknown>;
  elementRefs: Map<string, RuntimeElementRef>;
  traces: ActionTrace[];
  evidence: EvidenceArtifact[];
  clipboard: string;
  currentStepId: string | null;
  currentStepNumber: number | null;
  currentStepName: string | null;
  currentActionType: string | null;
  currentActionSummary: string | null;
  currentStepMetadata: CompiledStepMetadata | null;
  liveState: RunState;
  onProgress?: (state: Partial<RunState>) => void;
  signal?: AbortSignal;
};

type EvidenceArtifact = {
  run_id: string;
  node_id: string | null;
  step_number: number | null;
  action_type: string;
  artifact_kind: "screenshot" | "download";
  path: string;
  created_at: string;
};

class RunnerStop extends Error {
  status: "success" | "failure" | "stopped";
  closeBrowser: boolean;

  constructor(status: "success" | "failure" | "stopped", message: string, closeBrowser = false) {
    super(message);
    this.status = status;
    this.closeBrowser = closeBrowser;
  }
}

class LoopControl extends Error {
  kind: "break" | "continue";

  constructor(kind: "break" | "continue") {
    super(`${kind}_loop`);
    this.kind = kind;
  }
}

export class BrowserWorkflowRunner {
  private readonly appPaths: AppPaths;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly cloakHumanScroll: CloakHumanScrollAdapter;
  private readonly sessionManager: BrowserSessionManager;

  constructor(options: RunnerOptions) {
    this.appPaths = options.appPaths;
    this.sleep = options.sleep ?? sleep;
    this.random = options.random ?? Math.random;
    this.cloakHumanScroll = options.cloakHumanScroll ?? cloakBrowserHumanScrollLocatorIntoView;
    this.sessionManager = options.sessionManager ?? new BrowserSessionManager({
      appPaths: options.appPaths,
      driver: options.driver,
      retainedSessions: options.retainedSessions,
      usesDefaultDriver: options.usesDefaultDriver,
    });
  }

  createIsolatedRunRunner() {
    return new BrowserWorkflowRunner({
      appPaths: this.appPaths,
      sleep: this.sleep,
      random: this.random,
      sessionManager: this.sessionManager.createIsolatedManager(),
    });
  }

  async run(request: RunnerRunRequest): Promise<RunState> {
    const launch = request.reuseRetainedSession
      ? await this.sessionManager.reuseRetainedSession(request)
      : await this.sessionManager.launchFreshSession(request);
    const retainedWorkflowId = request.retainedSessionWorkflowId ?? null;
    const retainedProfileName = retainedProfileKey(request.settings);
    const outputs: Record<string, unknown> = {};
    Object.defineProperty(outputs, "__dynamicResolvers", {
      value: new Map(),
      writable: true,
      enumerable: false,
      configurable: true,
    });
    const state: RunState = {
      status: "running",
      mode: request.mode,
      target_step_id: request.targetStepId ?? null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs,
      retained_session: this.sessionManager.getRetainedSessionState(retainedWorkflowId, retainedProfileName),
      error: null,
    };
    const runtime: Runtime = {
      runId: request.runId ?? randomUUID(),
      settings: request.settings,
      context: launch.context,
      page: launch.page,
      domainPolicy: request.graph.domain_policy ?? null,
      outputs,
      elementRefs: new Map(),
      traces: [],
      evidence: [],
      clipboard: "",
      currentStepId: null,
      currentStepNumber: null,
      currentStepName: null,
      currentActionType: null,
      currentActionSummary: null,
      currentStepMetadata: null,
      liveState: state,
      onProgress: request.onProgress,
      signal: request.signal,
    };
    runtime.outputs.browser_identity = await browserIdentityEvidence(
      request.settings,
      runtime.runId,
    );

    let closeBrowser = request.settings.run_policy.browser_retention === "close";

    try {
      await this.applyEnvironment(runtime, request.settings);
      let stepNumber = 0;
      for (const step of request.graph.steps) {
        stepNumber += 1;
        this.throwIfCancelled(runtime.signal);
        runtime.currentStepId = step.node_id;
        runtime.currentStepNumber = stepNumber;
        runtime.currentStepName = step.label;
        runtime.currentActionType = step.config.type;
        runtime.currentActionSummary = actionConfigSummary(step.config);
        runtime.currentStepMetadata = step.metadata ?? null;
        state.current_step_id = step.node_id;
        state.current_step_number = stepNumber;
        this.reportProgress(runtime);
        await this.executeStep(runtime, step);
        state.completed_step_ids.push(step.node_id);
        this.reportProgress(runtime);
        if (request.mode === "test_step" && request.targetStepId === step.node_id) break;
      }
      state.status = "success";
    } catch (error) {
      if (error instanceof RunnerStop) {
        closeBrowser = closeBrowser || error.closeBrowser;
        state.status =
          error.status === "success"
            ? "success"
            : error.status === "stopped"
              ? "stopped"
              : "failed";
        if (error.status === "failure") {
          state.error = {
            step_id: state.current_step_id,
            step_number: state.current_step_number ?? 0,
            step_name: runtime.currentStepName,
            action_type: "stop_workflow",
            reason: error.message,
            diagnostics: runtimeErrorDiagnostics(runtime),
          };
        }
      } else if (isAbortError(error)) {
        state.status = "stopped";
      } else {
        state.status = "failed";
        state.error = {
          step_id: state.current_step_id,
          step_number: state.current_step_number ?? 0,
          step_name: runtime.currentStepName,
          action_type: runtime.currentActionType ?? "unknown",
          reason: error instanceof Error ? error.message : String(error),
          diagnostics: runtimeErrorDiagnostics(runtime),
        };
        await captureFailureScreenshot(this.appPaths, runtime);
      }
    } finally {
      runtime.outputs.__action_traces = runtime.traces;
      if (runtime.evidence.length > 0) {
        runtime.outputs.__evidence = runtime.evidence;
      }
      state.outputs = await collectRunnerOutputs(runtime);
      state.current_step_id = null;
      state.current_step_number = null;

      if (closeBrowser) {
        await runtime.context.close();
        this.sessionManager.forgetContext(runtime.context);
      } else {
        this.sessionManager.retainSession(
          runtime.context,
          runtime.page,
          retainedWorkflowId,
          retainedProfileName,
        );
      }
      state.retained_session = this.sessionManager.getRetainedSessionState(
        retainedWorkflowId,
        retainedProfileName,
      );
    }

    return state;
  }

  async closeRetainedContext() {
    await this.sessionManager.closeRetainedContext();
  }

  async closeRetainedSession(workflowId: string | null, profileName: string | null) {
    await this.sessionManager.closeRetainedSession(workflowId, profileName);
  }

  hasReusableRetainedSession(workflowId: string, profileName?: string | null) {
    return this.sessionManager.hasReusableRetainedSession(workflowId, profileName);
  }

  getRetainedSessionState(workflowId?: string | null, profileName?: string | null) {
    return this.sessionManager.getRetainedSessionState(workflowId, profileName);
  }

  getRetainedSessionStates() {
    return this.sessionManager.getRetainedSessionStates();
  }

  private async applyEnvironment(_runtime: Runtime, _settings: WorkflowSettings) {}

  private async executeStep(runtime: Runtime, step: CompiledGraphStep) {
    const startedAt = new Date().toISOString();
    const outputSnapshot = snapshotOutputs(runtime.outputs);
    const evidenceStartIndex = runtime.evidence.length;
    try {
      await this.executeAction(runtime, step.config);
      pushActionTrace(runtime, {
        node_id: step.node_id,
        label: step.label,
        action_type: step.config.type,
        status: "success",
        mode: actionTraceMode(step.config),
        ...actionEvidenceModel(step.config),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...summarizeActionEffects(runtime, outputSnapshot, evidenceStartIndex),
      });
    } catch (error) {
      pushActionTrace(runtime, {
        node_id: step.node_id,
        label: step.label,
        action_type: step.config.type,
        ...actionSummaryTraceField(step.config),
        ...subflowTraceFields(step.metadata),
        status: isAbortError(error) ? "stopped" : "failed",
        mode: actionTraceMode(step.config),
        ...actionEvidenceModel(step.config),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...summarizeActionEffects(runtime, outputSnapshot, evidenceStartIndex),
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private reportProgress(runtime: Runtime) {
    runtime.onProgress?.({
      current_step_id: runtime.liveState.current_step_id,
      current_step_number: runtime.liveState.current_step_number,
      completed_step_ids: [...runtime.liveState.completed_step_ids],
      outputs: {
        ...runtime.outputs,
        __action_traces: [...runtime.traces],
      },
    });
  }

  private async executeAction(runtime: Runtime, action: ActionConfig): Promise<void> {
    this.throwIfCancelled(runtime.signal);
    const resolvedAction = structuredClone(action);
    const { resolveDynamicOutputs } = await import("./variables.js");
    await resolveDynamicOutputs(runtime.outputs, resolvedAction.config);
    resolvedAction.config = resolveObjectTemplates(resolvedAction.config, runtime.outputs);
    await executeRegisteredAction(this.runnerActionExecutors(runtime), resolvedAction);
  }

  private runnerActionExecutors(runtime: Runtime) {
    return createRunnerActionExecutors(runtime, {
      appPaths: this.appPaths,
      random: this.random,
      sleep: this.sleep,
      enforceNavigationPolicy: (runtimeValue, url) => this.enforceNavigationPolicy(runtimeValue, url),
      executeWait: (runtimeValue, action) => this.executeWait(runtimeValue, action),
      locatorForAction: (runtimeValue, config, fallbackXpath) =>
        this.locatorForAction(runtimeValue, config, fallbackXpath),
      executeFindElement: (runtimeValue, action) => this.executeFindElement(runtimeValue, action),
      executeDragAndDrop: (runtimeValue, action) => this.executeDragAndDrop(runtimeValue, action),
      executeScroll: (runtimeValue, action) =>
        executeScrollAction(runtimeValue, action, {
          locatorForAction: (_scrollRuntime, config, fallbackXpath) =>
            this.locatorForAction(runtimeValue, config, fallbackXpath),
          cloakHumanScroll: this.cloakHumanScroll,
          sleep: this.sleep,
          random: this.random,
        }),
      pressKeyHuman: (page, key, signal) => pressKeyHuman(page, key, this.sleep, this.random, signal),
      pressHotkeyHuman: (page, keys, signal) => pressHotkeyHuman(page, keys, this.sleep, this.random, signal),
      executePasteClipboard: (runtimeValue, action) =>
        executePasteClipboardAction(runtimeValue, action, {
          locatorForAction: (_pasteRuntime, config) => this.locatorForAction(runtimeValue, config),
        }),
      locatorForCustomSelectTrigger: (runtimeValue, action) =>
        this.locatorForCustomSelectTrigger(runtimeValue, action),
      registerDialogHandler: (runtimeValue, behavior, promptText) =>
        registerDialogHandler(runtimeValue, behavior, promptText),
      waitForDownload: (runtimeValue, outputName, timeoutMs) =>
        waitForRunnerDownload(this.appPaths, runtimeValue, outputName, timeoutMs),
      executeActions: (runtimeValue, actions) => this.executeActions(runtimeValue, actions),
      executeLoopBody: (runtimeValue, steps) => this.executeLoopBody(runtimeValue, steps),
      executeRetry: (runtimeValue, attempts, delayMs, steps, failedSteps) =>
        this.executeRetry(runtimeValue, attempts, delayMs, steps, failedSteps),
      executeLoop: (runtimeValue, steps, maxAttempts, predicate, timeoutMs) =>
        this.executeLoop(runtimeValue, steps, maxAttempts, predicate, timeoutMs),
      conditionMatches,
      recordEvidence: recordRunnerEvidence,
      createLoopControl: (kind) => new LoopControl(kind),
      createRunnerStop: (status, message, closeBrowser) =>
        new RunnerStop(status, message, closeBrowser),
    });
  }

  private async executeActions(runtime: Runtime, actions: CompiledNestedAction[]) {
    for (const action of actions) {
      this.throwIfCancelled(runtime.signal);
      if (!action.graph_node_id) {
        await this.executeAction(runtime, action);
        continue;
      }
      const previous = {
        runtimeStepId: runtime.currentStepId,
        runtimeActionType: runtime.currentActionType,
        runtimeActionSummary: runtime.currentActionSummary,
        runtimeStepMetadata: runtime.currentStepMetadata,
        runtimeStepName: runtime.currentStepName,
        stateStepId: runtime.liveState.current_step_id,
      };
      runtime.currentStepId = action.graph_node_id;
      runtime.currentActionType = action.type;
      runtime.currentActionSummary = actionConfigSummary(action);
      runtime.currentStepMetadata = action.graph_metadata ?? null;
      runtime.currentStepName = action.graph_label ?? action.graph_node_id;
      runtime.liveState.current_step_id = action.graph_node_id;
      try {
        this.reportProgress(runtime);
        await this.executeNestedAction(runtime, action, previous.runtimeStepId);
        runtime.liveState.completed_step_ids.push(action.graph_node_id);
        this.reportProgress(runtime);
      } finally {
        runtime.currentStepId = previous.runtimeStepId;
        runtime.currentActionType = previous.runtimeActionType;
        runtime.currentActionSummary = previous.runtimeActionSummary;
        runtime.currentStepMetadata = previous.runtimeStepMetadata;
        runtime.currentStepName = previous.runtimeStepName;
        runtime.liveState.current_step_id = previous.stateStepId;
      }
    }
  }

  private async executeNestedAction(
    runtime: Runtime,
    action: CompiledNestedAction,
    parentNodeId: string | null,
  ) {
    const startedAt = new Date().toISOString();
    const nodeId = action.graph_node_id ?? runtime.currentStepId ?? "nested";
    const outputSnapshot = snapshotOutputs(runtime.outputs);
    const evidenceStartIndex = runtime.evidence.length;
    try {
      await this.executeAction(runtime, action);
      pushActionTrace(runtime, {
        node_id: nodeId,
        label: action.graph_label ?? nodeId,
        action_type: action.type,
        parent_node_id: parentNodeId,
        status: "success",
        mode: actionTraceMode(action),
        ...actionEvidenceModel(action),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...summarizeActionEffects(runtime, outputSnapshot, evidenceStartIndex),
      });
    } catch (error) {
      pushActionTrace(runtime, {
        node_id: nodeId,
        label: action.graph_label ?? nodeId,
        action_type: action.type,
        ...actionSummaryTraceField(action),
        ...subflowTraceFields(action.graph_metadata),
        parent_node_id: parentNodeId,
        status: isAbortError(error) ? "stopped" : "failed",
        mode: actionTraceMode(action),
        ...actionEvidenceModel(action),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        ...summarizeActionEffects(runtime, outputSnapshot, evidenceStartIndex),
        reason: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  private async executeLoopBody(
    runtime: Runtime,
    steps: CompiledNestedAction[],
  ): Promise<"completed" | "break" | "continue"> {
    try {
      await this.executeActions(runtime, steps);
      return "completed";
    } catch (error) {
      if (error instanceof LoopControl) return error.kind;
      throw error;
    }
  }

  private async executeWait(runtime: Runtime, action: Extract<ActionConfig, { type: "wait" }>) {
    switch (action.config.condition) {
      case "duration":
        await this.sleep(action.config.duration_ms ?? 1000, runtime.signal);
        return;
      case "page_load":
        await runtime.page.waitForLoadState?.("load", {
          timeout: action.config.timeout_ms ?? undefined,
        });
        return;
      case "url_contains":
        await runtime.page.waitForURL?.(
          (url) => url.href.includes(action.config.url ?? ""),
          { timeout: action.config.timeout_ms ?? undefined },
        );
        return;
      case "element_visible":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "visible",
          action.config.timeout_ms,
        );
        return;
      case "element_attached":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "attached",
          action.config.timeout_ms,
        );
        return;
      case "element_enabled": {
        const locator = await this.locatorForAction(runtime, action.config, "body");
        await waitForLocatorState(locator, "visible", action.config.timeout_ms);
        await this.waitForLocatorEnabled(locator, true, action.config.timeout_ms, runtime.signal);
        return;
      }
      case "text_visible":
        await waitForLocatorState(
          runtime.page.locator(`text=${action.config.text ?? ""}`),
          "visible",
          action.config.timeout_ms,
        );
        return;
      case "element_hidden":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "hidden",
          action.config.timeout_ms,
        );
        return;
      case "element_detached":
        await waitForLocatorState(
          await this.locatorForAction(runtime, action.config, "body"),
          "detached",
          action.config.timeout_ms,
        );
        return;
      case "element_disabled":
        await this.waitForLocatorEnabled(
          await this.locatorForAction(runtime, action.config, "body"),
          false,
          action.config.timeout_ms,
          runtime.signal,
        );
        return;
    }
  }

  private async waitForLocatorEnabled(
    locator: BrowserDriverLocator,
    enabled: boolean,
    timeoutMs: number | null | undefined,
    signal?: AbortSignal,
    retryIntervalMs = 100,
  ) {
    const deadline = Date.now() + (timeoutMs ?? 30_000);
    while (Date.now() <= deadline) {
      this.throwIfCancelled(signal);
      const current = await locator.isEnabled?.();
      if (current === enabled) return;
      await this.sleep(
        Math.min(retryIntervalMs, Math.max(1, deadline - Date.now())),
        signal,
      );
    }
    throw new Error(`Element did not become ${enabled ? "enabled" : "disabled"}`);
  }

  private async enforceNavigationPolicy(runtime: Runtime, url: string) {
    const allowedDomains = runtime.domainPolicy?.allowed_domains ?? [];
    if (allowedDomains.length === 0) return;

    let hostname: string;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      throw new Error(`Navigation URL is invalid for domain allowlist: ${url}`);
    }

    if (hostnameAllowed(hostname, allowedDomains)) return;
    throw new Error(
      `Navigation to ${hostname} is not in the allowlist (${allowedDomains.join(", ")})`,
    );
  }

  private async executeDragAndDrop(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  ) {
    const source = await this.locatorForDragEndpoint(runtime, action, "source");
    const target = await this.locatorForDragEndpoint(runtime, action, "target");
    await this.waitForElementReadiness(
      source,
      action.config.wait_until ?? null,
      action.config.timeout_ms,
      runtime.signal,
      undefined,
    );
    await this.waitForElementReadiness(
      target,
      action.config.wait_until ?? null,
      action.config.timeout_ms,
      runtime.signal,
      undefined,
    );

    const targetPosition = action.config.target_position;
    if (targetPosition && targetPosition.mode !== "center") {
      await this.executePositionedDragAndDrop(
        runtime,
        source,
        target,
        targetPosition,
        action.config.timeout_ms,
      );
      return;
    }

    if (!source.dragTo) {
      throw new Error("drag_and_drop requires driver dragTo support");
    }
    await source.dragTo(target, { timeout: action.config.timeout_ms ?? undefined });
  }

  private async locatorForDragEndpoint(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
    endpoint: "source" | "target",
  ): Promise<BrowserDriverLocator> {
    const refName = endpoint === "source" ? action.config.source_ref : action.config.target_ref;
    if (refName?.trim()) {
      const trimmedRefName = refName.trim();
      const ref = runtime.elementRefs.get(trimmedRefName);
      if (!ref) {
        throw new Error(`Element ref not found: ${refName}`);
      }
      return locatorForRuntimeElementRef(runtime.page, ref);
    }

    if (endpoint === "source") {
      return locatorFor(
        runtime.page,
        action.config.source_target,
        action.config.source_xpath,
        action.config.iframe_xpath,
      );
    }

    return locatorFor(
      runtime.page,
      action.config.target_target,
      action.config.target_xpath,
      action.config.iframe_xpath,
    );
  }

  private async locatorForCustomSelectTrigger(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "select_custom_option" }>,
  ) {
    if (action.config.trigger_ref != null) {
      const refName = action.config.trigger_ref.trim();
      if (!refName) {
        throw new Error("Trigger ref is required");
      }
      const ref = runtime.elementRefs.get(refName);
      if (!ref) {
        throw new Error(`Element ref not found: ${action.config.trigger_ref}`);
      }
      return locatorForRuntimeElementRef(runtime.page, ref);
    }

    return locatorFor(
      runtime.page,
      action.config.trigger_target,
      action.config.trigger_xpath,
      action.config.iframe_xpath,
    );
  }

  private async executePositionedDragAndDrop(
    runtime: Runtime,
    source: BrowserDriverLocator,
    target: BrowserDriverLocator,
    position: DragTargetPosition,
    timeoutMs: number | null | undefined,
  ) {
    const mouse = runtime.page.mouse;
    if (!mouse?.move || !mouse.down || !mouse.up) {
      throw new Error("drag_and_drop target_position requires driver mouse support");
    }

    await nativePointerLocatorIntoView(source, timeoutMs);
    await nativePointerLocatorIntoView(target, timeoutMs);
    this.throwIfCancelled(runtime.signal);

    const sourceBox = await this.locatorBoundingBox(source, "source");
    const targetBox = await this.locatorBoundingBox(target, "target");
    const sourcePoint = centerPoint(sourceBox);
    const targetPoint = dragTargetPoint(targetBox, position);

    this.throwIfCancelled(runtime.signal);
    await mouse.move(sourcePoint.x, sourcePoint.y);
    this.throwIfCancelled(runtime.signal);
    await mouse.down({ button: "left" });
    try {
      this.throwIfCancelled(runtime.signal);
      await mouse.move(targetPoint.x, targetPoint.y);
      this.throwIfCancelled(runtime.signal);
    } finally {
      await mouse.up({ button: "left" });
    }
  }

  private async locatorBoundingBox(
    locator: BrowserDriverLocator,
    role: "source" | "target",
  ): Promise<PointerBox> {
    if (!locator.boundingBox) {
      throw new Error(`drag_and_drop ${role} requires driver boundingBox support`);
    }
    const box = await locator.boundingBox();
    if (!box || !Number.isFinite(box.width) || !Number.isFinite(box.height)) {
      throw new Error(`Drag ${role} element has no visible bounding box`);
    }
    return box;
  }

  private async locatorForAction(
    runtime: Runtime,
    config: {
      target?: ElementTarget | null;
      target_ref?: string | null;
      xpath?: string | null;
      iframe_xpath?: string | null;
      wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
      timeout_ms?: number | null;
    },
    fallbackXpath = "body",
  ) {
    if (config.target_ref?.trim()) {
      const ref = runtime.elementRefs.get(config.target_ref.trim());
      if (!ref) {
        throw new Error(`Element ref not found: ${config.target_ref}`);
      }
      const locator = await locatorForRuntimeElementRef(runtime.page, ref);
      await this.waitForElementReadiness(
        locator,
        config.wait_until ?? null,
        config.timeout_ms,
        runtime.signal,
      );
      return locator;
    }

    const locator = await locatorFor(
      runtime.page,
      config.target,
      config.xpath ?? fallbackXpath,
      config.iframe_xpath,
    );
    await this.waitForElementReadiness(
      locator,
      config.wait_until ?? null,
      config.timeout_ms,
      runtime.signal,
    );
    return locator;
  }

  private async executeFindElement(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "find_element" }>,
  ) {
    const outputName = action.config.output_name.trim();
    const rank = action.config.rank ?? "nearest_viewport_center";
    const candidates = await this.waitForFindElementCandidates(
      runtime,
      action.config,
    );
    if (!candidates.length) {
      throw new Error("No element locator satisfied target constraints");
    }
    const selected = await selectRankedElementCandidate(runtime.page, candidates, rank);
    const target = action.config.target ?? {
      locators: [selected.locatorConfig],
      constraints: null,
      iframe: null,
    };
    const ref: RuntimeElementRef = {
      refId: randomUUID(),
      target,
      locator: selected.locatorConfig,
      index: selected.index,
      outputName,
      rank,
    };
    runtime.elementRefs.set(outputName, ref);
    runtime.outputs[outputName] = {
      kind: "element_ref",
      ref_id: ref.refId,
      locator: selected.locatorConfig.value,
      locator_kind: selected.locatorConfig.kind,
      index: selected.index,
      rank,
      box: selected.box,
    };
  }

  private async waitForFindElementCandidates(
    runtime: Runtime,
    config: Extract<ActionConfig, { type: "find_element" }>["config"],
  ) {
    const timeoutMs = config.timeout_ms ?? 0;
    const deadline = Date.now() + timeoutMs;
    do {
      this.throwIfCancelled(runtime.signal);
      const candidates = await rankedCandidatesForTarget(
        runtime.page,
        config.target,
        config.xpath,
        config.iframe_xpath,
        Boolean(config.filter?.in_viewport),
      );
      if (candidates.length || timeoutMs <= 0) return candidates;
      await this.sleep(Math.min(100, Math.max(1, deadline - Date.now())), runtime.signal);
    } while (Date.now() < deadline);
    return rankedCandidatesForTarget(
      runtime.page,
      config.target,
      config.xpath,
      config.iframe_xpath,
      Boolean(config.filter?.in_viewport),
    );
  }

  private async waitForElementReadiness(
    locator: BrowserDriverLocator,
    waitUntil: unknown,
    timeoutMs: number | null | undefined,
    signal?: AbortSignal,
    retryIntervalMs?: number | null,
  ) {
    switch (waitUntil) {
      case "attached":
        await waitForLocatorState(locator, "attached", timeoutMs);
        return;
      case "visible":
        await waitForLocatorState(locator, "visible", timeoutMs);
        return;
      case "enabled":
      case "clickable":
        await waitForLocatorState(locator, "visible", timeoutMs);
        await this.waitForLocatorEnabled(
          locator,
          true,
          timeoutMs,
          signal,
          retryIntervalMs ?? undefined,
        );
        return;
      case null:
        return;
      default:
        throw new Error("Wait until must be attached, visible, enabled, or clickable");
    }
  }

  private async executeRetry(
    runtime: Runtime,
    attempts: number,
    delayMs: number,
    steps: CompiledNestedAction[],
    failedSteps: CompiledNestedAction[],
  ) {
    let lastError: unknown;
    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        await this.executeActions(runtime, steps);
        return;
      } catch (error) {
        lastError = error;
        if (attempt + 1 < attempts && delayMs > 0) {
          await this.sleep(delayMs, runtime.signal);
        }
      }
    }
    if (failedSteps.length > 0) {
      await this.executeActions(runtime, failedSteps);
      return;
    }
    throw lastError;
  }

  private async executeLoop(
    runtime: Runtime,
    steps: CompiledNestedAction[],
    maxAttempts: number,
    predicate: () => Promise<boolean>,
    timeoutMs?: number | null,
  ): Promise<"predicate_false" | "max_attempts" | "timeout" | "break"> {
    let attempts = 0;
    const startedAt = Date.now();
    while (await predicate()) {
      if (timeoutMs != null && Date.now() - startedAt >= timeoutMs) return "timeout";
      if (attempts >= maxAttempts) return "max_attempts";
      runtime.outputs["system.loop.index"] = attempts;
      runtime.outputs["system.loop.number"] = attempts + 1;
      attempts += 1;
      const control = await this.executeLoopBody(runtime, steps);
      if (control === "break") return "break";
      if (timeoutMs != null && Date.now() - startedAt >= timeoutMs) return "timeout";
    }
    return "predicate_false";
  }

  private throwIfCancelled(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new RunnerStop("stopped", "Run stopped");
    }
  }
}

function isAbortError(error: unknown) {
  return (
    error instanceof RunnerStop && error.status === "stopped"
  ) || (
    error instanceof DOMException && error.name === "AbortError"
  );
}
