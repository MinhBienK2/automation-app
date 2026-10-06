import { randomUUID } from "node:crypto";
import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledWorkflowGraph,
  RunMode,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../db/database.js";
import {
  type ExecutionSurface,
  type BrowserDriver,
} from "./surface.js";
import {
  executeRegisteredAction,
} from "../actions/execution.js";
import {
  actionConfigSummary,
  actionEvidenceModel,
  actionSummaryTraceField,
  actionTraceMode,
  pushActionTrace,
  surfaceTraceField,
  runtimeErrorDiagnostics,
  snapshotOutputs,
  subflowTraceFields,
  summarizeActionEffects,
  type ActionTrace,
} from "./actionTrace.js";
import {
  cloakBrowserHumanScrollLocatorIntoView,
  type CloakHumanScrollAdapter,
} from "./interactionActions.js";
import {
  sleep,
} from "./runtimeHelpers.js";
import {
  WebInteractionEngine,
} from "./webInteractionEngine.js";
import {
  NestedStepExecutor,
} from "./nestedStepExecutor.js";
import {
  type BrowserLaunchOptions,
  type SessionManagerPort,
  type RunnerOptions,
  type OpenedSurface,
  type RunnerRunRequest,
  type Runtime,
  RunnerStop,
  LoopControl,
  webSurfaceOf,
  sensitivityOf,
  isAbortError,
} from "./runnerTypes.js";
import {
  createRunnerActionExecutors,
  type RunnerActionRuntime,
} from "./runnerActionExecutors.js";
import { conditionMatches } from "./conditions.js";
import {
  captureFailureScreenshot,
  collectRunnerOutputs,
  recordRunnerEvidence,
} from "./runnerEvidence.js";
import { resolveObjectTemplates } from "./variables.js";

export type {
  BrowserDriver,
  BrowserDriverLocator,
  BrowserDriverFrameLocator,
} from "./surface.js";
export type {
  BrowserLaunchOptions,
  SessionManagerPort,
  RunnerOptions,
  OpenedSurface,
  RunnerRunRequest,
} from "./runnerTypes.js";
export class BrowserWorkflowRunner {
  private readonly appPaths: AppPaths;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly cloakHumanScroll: CloakHumanScrollAdapter;
  private readonly options: RunnerOptions;
  private readonly webEngine: WebInteractionEngine;
  private readonly nestedExecutor: NestedStepExecutor;
  private fallbackSessionManager?: SessionManagerPort;

  constructor(options: RunnerOptions) {
    this.options = options;
    this.appPaths = options.appPaths;
    this.sleep = options.sleep ?? sleep;
    this.random = options.random ?? Math.random;
    this.cloakHumanScroll = options.cloakHumanScroll ?? cloakBrowserHumanScrollLocatorIntoView;
    this.webEngine = new WebInteractionEngine({
      appPaths: this.appPaths,
      sleep: this.sleep,
      random: this.random,
      cloakHumanScroll: this.cloakHumanScroll,
    });
    this.nestedExecutor = new NestedStepExecutor({
      executeAction: (rt, action) => this.executeAction(rt, action),
      reportProgress: (rt) => this.reportProgress(rt),
      sleep: this.sleep,
      throwIfCancelled: (sig) => this.throwIfCancelled(sig),
    });
  }

  private async getOrCreateSessionManager(): Promise<SessionManagerPort> {
    if (this.options.sessionManager) {
      return this.options.sessionManager;
    }
    if (!this.fallbackSessionManager) {
      const { BrowserSessionManager } = await import("../surfaces/web/sessionManager.js");
      this.fallbackSessionManager = new BrowserSessionManager({
        appPaths: this.appPaths,
        driver: this.options.driver,
        retainedSessions: this.options.retainedSessions,
        usesDefaultDriver: this.options.usesDefaultDriver,
      });
    }
    return this.fallbackSessionManager;
  }

  private get activeSessionManager(): SessionManagerPort | undefined {
    return this.options.sessionManager ?? this.fallbackSessionManager;
  }

  createIsolatedRunRunner() {
    return new BrowserWorkflowRunner({
      ...this.options,
      appPaths: this.appPaths,
      sleep: this.sleep,
      random: this.random,
      sessionManager: this.activeSessionManager?.createIsolatedManager?.(),
    });
  }

  async run(request: RunnerRunRequest): Promise<RunState> {
    const opened = await this.openSurface(request);
    const retainedWorkflowId = request.retainedSessionWorkflowId ?? null;
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
      retained_session:
        opened.retainedSessionState?.() ??
        this.activeSessionManager?.getRetainedSessionState?.(
          retainedWorkflowId,
          request.settings.browser_launch?.profile_dir ?? null,
        ) ??
        null,
      error: null,
    };
    const runtime: Runtime = {
      runId: request.runId ?? randomUUID(),
      settings: request.settings,
      surface: opened.surface,
      get context() {
        return (this as any).surface?.kind === "web" ? (this as any).surface.context : (undefined as any);
      },
      get page() {
        return (this as any).surface?.kind === "web" ? (this as any).surface.page : (undefined as any);
      },
      set page(p: any) {
        if ((this as any).surface?.kind === "web") (this as any).surface.page = p;
      },
      get activeFrameXpath() {
        return (this as any).surface?.kind === "web" ? (this as any).surface.activeFrameXpath : (undefined as any);
      },
      set activeFrameXpath(f: any) {
        if ((this as any).surface?.kind === "web") (this as any).surface.activeFrameXpath = f;
      },
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
      currentActionSensitive: null,
      currentSurfaceTrace: null,
      currentStepMetadata: null,
      liveState: state,
      onProgress: request.onProgress,
      signal: request.signal,
      failedStepInfo: null,
    };
    if (opened.outputs) {
      Object.assign(runtime.outputs, opened.outputs);
    } else if (runtime.surface.kind === "web") {
      const { browserIdentityEvidence } = await import("../surfaces/web/sessionManager.js");
      runtime.outputs.browser_identity = await browserIdentityEvidence(
        request.settings,
        runtime.runId,
      );
    }
    if (opened.warnings?.length) {
      // Surfaced as an output rather than a log line: the operator reads the
      // run, not the console, and a degraded tier explains failures that
      // otherwise look like a broken locator.
      runtime.outputs.__surface_warnings = opened.warnings;
    }

    let closeSurface = request.settings.run_policy.browser_retention === "close";

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
        runtime.currentActionSensitive = sensitivityOf(step.config);
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
        closeSurface = closeSurface || error.closeBrowser;
        state.status =
          error.status === "success"
            ? "success"
            : error.status === "stopped"
              ? "stopped"
              : "failed";
        if (error.status === "failure") {
          const failedInfo = runtime.failedStepInfo;
          state.error = {
            step_id: failedInfo ? failedInfo.step_id : (state.current_step_id ?? ""),
            step_number: state.current_step_number ?? 0,
            step_name: failedInfo ? failedInfo.step_name : runtime.currentStepName,
            action_type: "stop_workflow",
            reason: error.message,
            diagnostics: runtimeErrorDiagnostics(runtime),
          };
        }
      } else if (isAbortError(error)) {
        state.status = "stopped";
      } else if (error instanceof LoopControl) {
        state.status = "success";
      } else {
        state.status = "failed";
        const failedInfo = runtime.failedStepInfo;
        state.error = {
          step_id: failedInfo ? failedInfo.step_id : (state.current_step_id ?? ""),
          step_number: state.current_step_number ?? 0,
          step_name: failedInfo ? failedInfo.step_name : runtime.currentStepName,
          action_type: failedInfo ? failedInfo.action_type : (runtime.currentActionType ?? "unknown"),
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

      // Closed through the opener closure, which encapsulates surface-specific
      // retention policies: desktop decides whether to kill the target app,
      // and web decides whether to retain or close the browser context.
      await opened.close({ status: state.status, forceClose: closeSurface });
      state.retained_session =
        opened.retainedSessionState?.() ??
        this.activeSessionManager?.getRetainedSessionState?.(
          retainedWorkflowId,
          request.settings.browser_launch?.profile_dir ?? null,
        ) ??
        null;
    }

    return state;
  }

  async closeRetainedContext(): Promise<void> {
    await this.activeSessionManager?.closeRetainedContext?.();
  }

  async closeRetainedSession(workflowId: string | null, profileName: string | null): Promise<void> {
    await this.activeSessionManager?.closeRetainedSession?.(workflowId, profileName);
  }

  hasReusableRetainedSession(workflowId: string, profileName?: string | null): boolean {
    return this.activeSessionManager?.hasReusableRetainedSession?.(workflowId, profileName) ?? false;
  }

  getRetainedSessionState(workflowId?: string | null, profileName?: string | null): RunState["retained_session"] {
    return this.activeSessionManager?.getRetainedSessionState?.(workflowId, profileName) ?? null;
  }

  getRetainedSessionStates(): NonNullable<RunState["retained_session"]>[] {
    return this.activeSessionManager?.getRetainedSessionStates?.() ?? [];
  }

  /**
   * The one place a run acquires something to act on.
   *
   * A caller that supplied an opener has already decided what the surface is,
   * so the browser is never launched — which is what stops a desktop run from
   * quietly starting a browser it will never use.
   */
  private async openSurface(request: RunnerRunRequest): Promise<OpenedSurface> {
    if (request.openSurface) return request.openSurface();
    if (this.options.openSurface) return this.options.openSurface(request);

    // Fallback when runner is used standalone without an external opener injected (e.g. runner unit tests)
    const sessionManager = await this.getOrCreateSessionManager();
    const { createWebSurfaceOpener } = await import("../surfaces/web/surfaceOpener.js");
    const openWebSurface = createWebSurfaceOpener({
      sessionManager: sessionManager as any,
    });
    return openWebSurface({
      settings: request.settings,
      runId: request.runId,
      retention: request.settings.run_policy?.browser_retention === "close" ? "close" : "retain",
      reuseRetainedSession: request.reuseRetainedSession,
      retainedSessionWorkflowId: request.retainedSessionWorkflowId,
      signal: request.signal,
    })();
  }

  private async applyEnvironment(_runtime: Runtime, _settings: WorkflowSettings) {}

  private async executeStep(runtime: Runtime, step: CompiledGraphStep) {
    const startedAt = new Date().toISOString();
    const outputSnapshot = snapshotOutputs(runtime.outputs);
    const evidenceStartIndex = runtime.evidence.length;
    // Cleared here rather than after the push: a step that throws before it
    // resolves anything must not inherit the last step's element.
    runtime.currentSurfaceTrace = null;
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
        ...surfaceTraceField(runtime),
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
        // A failed step is where this matters most: the locator it did resolve,
        // and the verdict that came back false, are the whole diagnosis.
        ...surfaceTraceField(runtime),
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
    let resolvedAction: ActionConfig;
    try {
      resolvedAction = structuredClone(action);
    } catch {
      resolvedAction = JSON.parse(JSON.stringify(action)) as ActionConfig;
    }
    const { resolveDynamicOutputs } = await import("./variables.js");
    await resolveDynamicOutputs(runtime.outputs, resolvedAction.config);
    if (resolvedAction.type === "check_conditions") {
      const config = resolvedAction.config as any;
      if (config.evaluation_type === "dynamic") {
        const { output_name, evaluation_type, mode } = config;
        resolvedAction.config = {
          output_name: resolveObjectTemplates(output_name, runtime.outputs),
          evaluation_type,
          mode,
          rules_group: (action.config as any).rules_group,
          script: (action.config as any).script,
        } as any;
      } else {
        resolvedAction.config = resolveObjectTemplates(resolvedAction.config, runtime.outputs);
      }
    } else if (resolvedAction.type === "calculate_value") {
      const config = resolvedAction.config as any;
      if (config.evaluation_type === "dynamic") {
        const { output_name, evaluation_type } = config;
        resolvedAction.config = {
          output_name: resolveObjectTemplates(output_name, runtime.outputs),
          evaluation_type,
          expression: (action.config as any).expression,
        } as any;
      } else {
        resolvedAction.config = resolveObjectTemplates(resolvedAction.config, runtime.outputs);
      }
    } else {
      resolvedAction.config = resolveObjectTemplates(resolvedAction.config, runtime.outputs);
    }
    await executeRegisteredAction(this.runnerActionExecutors(runtime), resolvedAction);
  }

  private runnerActionExecutors(runtime: Runtime) {
    return createRunnerActionExecutors(runtime, {
      appPaths: this.appPaths,
      random: this.random,
      sleep: this.sleep,
      webEngine: this.webEngine,
      enforceNavigationPolicy: (runtimeValue, url) => this.webEngine.enforceNavigationPolicy(runtimeValue, url),
      executeWait: (runtimeValue, action) => this.webEngine.executeWait(runtimeValue, action),
      locatorForAction: (runtimeValue, config, fallbackXpath) =>
        this.webEngine.locatorForAction(runtimeValue, config, fallbackXpath),
      executeFindElement: (runtimeValue, action) => this.webEngine.executeFindElement(runtimeValue, action),
      executeDragAndDrop: (runtimeValue, action) => this.webEngine.executeDragAndDrop(runtimeValue, action),
      executeScroll: (runtimeValue, action) => this.webEngine.executeScroll(runtimeValue, action),
      pressKeyHuman: (page, key, signal) => this.webEngine.pressKeyHuman(page, key, signal),
      pressHotkeyHuman: (page, keys, signal) => this.webEngine.pressHotkeyHuman(page, keys, signal),
      executePasteClipboard: (runtimeValue, action) => this.webEngine.executePasteClipboard(runtimeValue, action),
      locatorForCustomSelectTrigger: (runtimeValue, action) =>
        this.webEngine.locatorForCustomSelectTrigger(runtimeValue, action),
      registerDialogHandler: (runtimeValue, behavior, promptText) =>
        this.webEngine.registerDialogHandler(runtimeValue, behavior, promptText),
      waitForDownload: (runtimeValue, outputName, timeoutMs) =>
        this.webEngine.waitForDownload(runtimeValue, outputName, timeoutMs),
      executeActions: (runtimeValue, actions) => this.nestedExecutor.executeActions(runtimeValue, actions),
      executeLoopBody: (runtimeValue, steps) => this.nestedExecutor.executeLoopBody(runtimeValue, steps),
      executeRetry: (runtimeValue, attempts, delayMs, steps, failedSteps) =>
        this.nestedExecutor.executeRetry(runtimeValue, attempts, delayMs, steps, failedSteps),
      executeLoop: (runtimeValue, steps, maxAttempts, predicate, timeoutMs) =>
        this.nestedExecutor.executeLoop(runtimeValue, steps, maxAttempts, predicate, timeoutMs),
      conditionMatches,
      recordEvidence: recordRunnerEvidence,
      createLoopControl: (kind) => new LoopControl(kind),
      createRunnerStop: (status, message, closeBrowser) =>
        new RunnerStop(status, message, closeBrowser),
    });
  }

  private throwIfCancelled(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new RunnerStop("stopped", "Run stopped");
    }
  }
}

