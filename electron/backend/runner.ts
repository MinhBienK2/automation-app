import fs from "node:fs/promises";
import path from "node:path";
import { createHash, randomUUID } from "node:crypto";
import type {
  ActionConfig,
  ActionType,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  ElementLocator,
  ElementTarget,
  RunMode,
  RunState,
  WorkflowSettings,
} from "../../src/types/workflow.js";
import type { AppPaths } from "./database.js";
import {
  resolveEvidenceArtifact,
  sanitizePathSegment,
} from "./evidenceArtifacts.js";

type CloakBrowserModule = {
  launchContext: (options?: BrowserLaunchOptions) => Promise<BrowserDriverContext>;
  launchPersistentContext: (
    options: BrowserLaunchOptions & { userDataDir: string },
  ) => Promise<BrowserDriverContext>;
  binaryInfo?: () => {
    version?: string;
    platform?: string;
    installed?: boolean;
  };
};

export type BrowserLaunchOptions = Record<string, unknown>;

export type BrowserDriver = {
  launch(options: BrowserLaunchOptions): Promise<BrowserDriverContext>;
  launchPersistent(
    options: BrowserLaunchOptions & { userDataDir: string },
  ): Promise<BrowserDriverContext>;
};

export type BrowserDriverContext = {
  pages(): BrowserDriverPage[];
  newPage(): Promise<BrowserDriverPage>;
  close(): Promise<void>;
  on?(eventName: "close", handler: () => void): void;
  addCookies?(cookies: Array<Record<string, unknown>>): Promise<void>;
  clearCookies?(options?: Record<string, unknown>): Promise<void>;
  grantPermissions?(permissions: string[], options?: { origin?: string }): Promise<void>;
  setGeolocation?(geolocation: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  }): Promise<void>;
  setExtraHTTPHeaders?(headers: Record<string, string>): Promise<void>;
  route?(
    url: string | RegExp | ((url: URL) => boolean),
    handler: (route: BrowserRoute) => Promise<void> | void,
  ): Promise<void>;
};

export type BrowserDriverPage = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  locator(selector: string): BrowserDriverLocator;
  waitForLoadState?(state?: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForURL?(url: string | RegExp | ((url: URL) => boolean), options?: Record<string, unknown>): Promise<unknown>;
  waitForRequest?(predicate: string | RegExp | ((request: BrowserRequest) => boolean), options?: Record<string, unknown>): Promise<BrowserRequest>;
  waitForResponse?(predicate: string | RegExp | ((response: BrowserResponse) => boolean), options?: Record<string, unknown>): Promise<BrowserResponse>;
  waitForEvent?(eventName: "download", options?: Record<string, unknown>): Promise<BrowserDownload>;
  once?(eventName: "dialog", handler: (dialog: BrowserDialog) => void | Promise<void>): void;
  getByTestId?(testId: string): BrowserDriverLocator;
  getByRole?(role: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByLabel?(label: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByPlaceholder?(placeholder: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByText?(text: string, options?: Record<string, unknown>): BrowserDriverLocator;
  frameLocator?(selector: string): BrowserDriverFrameLocator;
  goBack?(): Promise<unknown>;
  goForward?(): Promise<unknown>;
  reload?(): Promise<unknown>;
  bringToFront?(): Promise<void>;
  close?(): Promise<void>;
  isClosed?(): boolean;
  screenshot?(options?: Record<string, unknown>): Promise<Buffer>;
  evaluate<R = unknown, A = unknown>(
    pageFunction: string | ((arg?: A) => R | Promise<R>),
    arg?: A,
  ): Promise<R>;
  evaluateHandle?(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown): Promise<unknown>;
  addInitScript?(script: string): Promise<unknown>;
  setViewportSize?(viewport: { width: number; height: number }): Promise<void>;
  keyboard?: {
    press(key: string, options?: Record<string, unknown>): Promise<void>;
    down?(key: string, options?: Record<string, unknown>): Promise<void>;
    up?(key: string, options?: Record<string, unknown>): Promise<void>;
    type(text: string, options?: Record<string, unknown>): Promise<void>;
    insertText?(text: string): Promise<void>;
  };
  mouse?: {
    move?(x: number, y: number): Promise<void>;
    down?(options?: Record<string, unknown>): Promise<void>;
    up?(options?: Record<string, unknown>): Promise<void>;
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
};

export type BrowserDriverFrameLocator = {
  locator(selector: string): BrowserDriverLocator;
  getByTestId?(testId: string): BrowserDriverLocator;
  getByRole?(role: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByLabel?(label: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByPlaceholder?(placeholder: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByText?(text: string, options?: Record<string, unknown>): BrowserDriverLocator;
  frameLocator?(selector: string): BrowserDriverFrameLocator;
};

export type BrowserDriverLocator = {
  fill(value: string, options?: Record<string, unknown>): Promise<void>;
  type?(value: string, options?: Record<string, unknown>): Promise<void>;
  click(options?: Record<string, unknown>): Promise<void>;
  evaluate?<Result, Arg = unknown>(
    pageFunction: (element: Element, arg: Arg) => Result | Promise<Result>,
    arg?: Arg,
  ): Promise<Result>;
  hover?(options?: Record<string, unknown>): Promise<void>;
  dblclick?(options?: Record<string, unknown>): Promise<void>;
  check?(options?: Record<string, unknown>): Promise<void>;
  uncheck?(options?: Record<string, unknown>): Promise<void>;
  selectOption?(value: string | string[] | Record<string, string>): Promise<unknown>;
  setInputFiles?(files: string[]): Promise<void>;
  press?(key: string, options?: Record<string, unknown>): Promise<void>;
  textContent?(options?: Record<string, unknown>): Promise<string | null>;
  getAttribute?(attribute: string, options?: Record<string, unknown>): Promise<string | null>;
  inputValue?(options?: Record<string, unknown>): Promise<string>;
  boundingBox?(): Promise<{ x?: number; y?: number; width: number; height: number } | null>;
  count?(): Promise<number>;
  nth?(index: number): BrowserDriverLocator;
  isVisible?(options?: Record<string, unknown>): Promise<boolean>;
  isEnabled?(options?: Record<string, unknown>): Promise<boolean>;
  waitFor?(options?: Record<string, unknown>): Promise<void>;
  dragTo?(target: BrowserDriverLocator, options?: Record<string, unknown>): Promise<void>;
  scrollIntoViewIfNeeded?(options?: Record<string, unknown>): Promise<void>;
};

type BrowserDialog = {
  accept(promptText?: string): Promise<void>;
  dismiss(): Promise<void>;
};

type BrowserDownload = {
  suggestedFilename?(): string;
  saveAs?(filePath: string): Promise<void>;
  path?(): Promise<string | null>;
};

type BrowserRoute = {
  abort(): Promise<void>;
  fulfill(response: Record<string, unknown>): Promise<void>;
  continue(): Promise<void>;
};

type BrowserRequest = {
  url(): string;
};

type BrowserResponse = {
  url(): string;
  status(): number;
};

type RunnerOptions = {
  appPaths: AppPaths;
  driver?: BrowserDriver;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
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

type RetainedSession = {
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  workflowId: string | null;
  profileName: string | null;
};

type Runtime = {
  runId: string;
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  domainPolicy: { allowed_domains: string[] } | null;
  outputs: Record<string, unknown>;
  traces: ActionTrace[];
  evidence: EvidenceArtifact[];
  clipboard: string;
  currentStepId: string | null;
  currentStepNumber: number | null;
  currentActionType: string | null;
  liveState: RunState;
  onProgress?: (state: Partial<RunState>) => void;
  signal?: AbortSignal;
};

type ActionTrace = {
  node_id: string;
  label: string;
  action_type: string;
  status: "success" | "failed" | "stopped";
  mode: "browser" | "assisted_browser" | "direct_dom" | "observer" | "manual";
  started_at: string;
  finished_at: string;
  reason?: string;
};

type RunnerActionCapability = "cloak_native" | "custom_human" | "direct_dom";

const runnerActionCapabilities: Partial<Record<ActionType, RunnerActionCapability>> = {
  click: "cloak_native",
  double_click: "cloak_native",
  hover: "cloak_native",
  input_text: "cloak_native",
  clear_input: "cloak_native",
  check: "cloak_native",
  uncheck: "cloak_native",
  toggle_checkbox: "cloak_native",
  select_option: "cloak_native",
  select_radio: "cloak_native",
  submit_form: "cloak_native",
  type_sequence: "cloak_native",
  drag_and_drop: "cloak_native",
  upload_file: "cloak_native",
  set_contenteditable: "cloak_native",
  focus_element: "cloak_native",
  right_click: "custom_human",
  press_key: "custom_human",
  hotkey: "custom_human",
  paste_clipboard: "custom_human",
  execute_js: "direct_dom",
  set_local_storage: "direct_dom",
  set_session_storage: "direct_dom",
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
  private readonly driver: BrowserDriver;
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly usesDefaultDriver: boolean;
  private retainedSessions: Map<string, RetainedSession>;

  constructor(options: RunnerOptions) {
    this.appPaths = options.appPaths;
    this.driver = options.driver ?? createCloakBrowserDriver();
    this.usesDefaultDriver = options.usesDefaultDriver ?? !options.driver;
    this.sleep = options.sleep ?? sleep;
    this.random = options.random ?? Math.random;
    this.retainedSessions = options.retainedSessions ?? new Map<string, RetainedSession>();
  }

  createIsolatedRunRunner() {
    return new BrowserWorkflowRunner({
      appPaths: this.appPaths,
      driver: this.driver,
      sleep: this.sleep,
      random: this.random,
      retainedSessions: this.retainedSessions,
      usesDefaultDriver: this.usesDefaultDriver,
    });
  }

  async run(request: RunnerRunRequest): Promise<RunState> {
    const launch = request.reuseRetainedSession
      ? await this.reuseRetainedSession(request)
      : await this.launchFreshSession(request);
    const retainedWorkflowId = request.retainedSessionWorkflowId ?? null;
    const retainedProfileName = retainedProfileKey(request.settings);
    const state: RunState = {
      status: "running",
      mode: request.mode,
      target_step_id: request.targetStepId ?? null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs: {},
      retained_session: this.retainedSessionState(retainedWorkflowId, retainedProfileName),
      error: null,
    };
    const runtime: Runtime = {
      runId: request.runId ?? randomUUID(),
      context: launch.context,
      page: launch.page,
      domainPolicy: request.graph.domain_policy ?? null,
      outputs: {},
      traces: [],
      evidence: [],
      clipboard: "",
      currentStepId: null,
      currentStepNumber: null,
      currentActionType: null,
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
      await this.runFingerprintPreflight(runtime, request.settings);
      let stepNumber = 0;
      for (const step of request.graph.steps) {
        stepNumber += 1;
        this.throwIfCancelled(runtime.signal);
        runtime.currentStepId = step.node_id;
        runtime.currentStepNumber = stepNumber;
        runtime.currentActionType = step.config.type;
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
            step_name: null,
            action_type: "stop_workflow",
            reason: error.message,
          };
        }
      } else if (isAbortError(error)) {
        state.status = "stopped";
      } else {
        state.status = "failed";
        state.error = {
          step_id: state.current_step_id,
          step_number: state.current_step_number ?? 0,
          step_name: null,
          action_type: runtime.currentActionType ?? "unknown",
          reason: error instanceof Error ? error.message : String(error),
        };
        await this.captureFailureScreenshot(runtime);
      }
    } finally {
      runtime.outputs.__action_traces = runtime.traces;
      if (runtime.evidence.length > 0) {
        runtime.outputs.__evidence = runtime.evidence;
      }
      state.outputs = await this.collectOutputs(runtime);
      state.current_step_id = null;
      state.current_step_number = null;

      if (closeBrowser) {
        await runtime.context.close();
        for (const [key, session] of this.retainedSessions) {
          if (session.context === runtime.context) {
            this.retainedSessions.delete(key);
          }
        }
      } else {
        this.retainSession(
          runtime.context,
          runtime.page,
          retainedWorkflowId,
          retainedProfileName,
        );
      }
      state.retained_session = this.retainedSessionState(
        retainedWorkflowId,
        retainedProfileName,
      );
    }

    return state;
  }

  async closeRetainedContext() {
    for (const session of this.retainedSessions.values()) {
      await session.context.close();
    }
    this.retainedSessions.clear();
  }

  hasReusableRetainedSession(workflowId: string, profileName?: string | null) {
    const key = retainedSessionKey(workflowId, profileName ?? null);
    const session = this.retainedSessions.get(key);
    if (!session || this.isRetainedSessionStale(session)) {
      this.retainedSessions.delete(key);
      return false;
    }
    return true;
  }

  getRetainedSessionState(workflowId?: string | null, profileName?: string | null) {
    return this.retainedSessionState(workflowId, profileName);
  }

  getRetainedSessionStates() {
    const states: NonNullable<RunState["retained_session"]>[] = [];
    for (const session of this.retainedSessions.values()) {
      const state = this.retainedSessionState(session.workflowId, session.profileName);
      if (state) {
        states.push(state);
      }
    }
    return states;
  }

  private async launchFreshSession(request: RunnerRunRequest) {
    if (request.retainedSessionWorkflowId !== undefined) {
      await this.closeRetainedSession(
        request.retainedSessionWorkflowId ?? null,
        retainedProfileKey(request.settings),
      );
    } else {
      await this.closeRetainedContext();
    }
    return this.launch(request.settings);
  }

  private async reuseRetainedSession(request: RunnerRunRequest) {
    const profileName = retainedProfileKey(request.settings);
    const workflowId = request.retainedSessionWorkflowId ?? null;
    if (!workflowId || !this.hasReusableRetainedSession(workflowId, profileName)) {
      throw new Error("No reusable browser session is available. Run the workflow again to create one.");
    }
    const session = this.retainedSessions.get(retainedSessionKey(workflowId, profileName));
    if (!session) {
      throw new Error("No reusable browser session is available. Run the workflow again to create one.");
    }
    return { context: session.context, page: session.page, temporary: false };
  }

  private retainSession(
    context: BrowserDriverContext,
    page: BrowserDriverPage,
    workflowId: string | null,
    profileName: string | null,
  ) {
    const key = retainedSessionKey(workflowId, profileName);
    this.retainedSessions.set(key, { context, page, workflowId, profileName });
    context.on?.("close", () => {
      if (this.retainedSessions.get(key)?.context === context) {
        this.retainedSessions.delete(key);
      }
    });
  }

  private async closeRetainedSession(workflowId: string | null, profileName: string | null) {
    const key = retainedSessionKey(workflowId, profileName);
    const session = this.retainedSessions.get(key);
    if (!session) return;
    await session.context.close();
    this.retainedSessions.delete(key);
  }

  private retainedSessionState(workflowId?: string | null, profileName?: string | null): RunState["retained_session"] {
    if (workflowId !== undefined || profileName !== undefined) {
      const key = retainedSessionKey(workflowId ?? null, profileName ?? null);
      const session = this.retainedSessions.get(key);
      if (!session) {
        return {
          available: false,
          workflow_id: workflowId ?? null,
          profile_name: profileName ?? null,
          reason: "No retained browser session",
        };
      }
      if (this.isRetainedSessionStale(session)) {
        this.retainedSessions.delete(key);
        return {
          available: false,
          workflow_id: workflowId ?? null,
          profile_name: profileName ?? null,
          reason: "Browser session was closed",
        };
      }
      return {
        available: true,
        workflow_id: session.workflowId,
        profile_name: session.profileName,
        reason: null,
      };
    }

    const sessions = [...this.retainedSessions.values()];
    if (sessions.length === 0) {
      return {
        available: false,
        workflow_id: null,
        profile_name: null,
        reason: "No retained browser session",
      };
    }
    if (sessions.length > 1) {
      return {
        available: false,
        workflow_id: null,
        profile_name: null,
        reason: "Multiple retained browser sessions",
      };
    }
    const session = sessions[0];
    if (this.isRetainedSessionStale(session)) {
      this.retainedSessions.delete(retainedSessionKey(session.workflowId, session.profileName));
      return {
        available: false,
        workflow_id: null,
        profile_name: null,
        reason: "Browser session was closed",
      };
    }
    return {
      available: true,
      workflow_id: session.workflowId,
      profile_name: session.profileName,
      reason: null,
    };
  }

  private isRetainedSessionStale(session: RetainedSession) {
    const contextClosed = (session.context as { closed?: boolean }).closed === true;
    const pageClosed = session.page.isClosed?.() === true;
    return contextClosed || pageClosed;
  }

  private async launch(settings: WorkflowSettings) {
    if (this.usesDefaultDriver) assertHeadedDisplayAvailable(settings);
    const options = buildLaunchOptions(settings, this.appPaths);
    const profileDir = retainedProfileKey(settings);
    const context = profileDir
      ? await this.driver.launchPersistent({
          ...options,
          userDataDir: path.join(this.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)),
        })
      : await this.driver.launch(options);
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page, temporary: !profileDir };
  }

  private async applyEnvironment(_runtime: Runtime, _settings: WorkflowSettings) {}

  private async runFingerprintPreflight(runtime: Runtime, settings: WorkflowSettings) {
    const browser = settings.browser_launch;
    if (!browser.preflight_enabled) return;
    const probeUrl = browser.preflight_probe_url?.trim();
    if (!probeUrl) {
      throw new Error("Fingerprint preflight probe URL is required");
    }
    const probeOrigin = originForUrl(probeUrl);
    if (!probeOrigin || !browser.preflight_allowed_origins.includes(probeOrigin)) {
      throw new Error("Fingerprint preflight probe origin must be allowlisted");
    }

    runtime.currentActionType = "fingerprint_preflight";
    await runtime.page.goto(probeUrl);
    const rawVerdict = await runtime.page.evaluate(() => {
      return document.body?.innerText ?? document.documentElement?.textContent ?? "";
    });
    const verdict = parseFingerprintPreflightVerdict(rawVerdict);
    runtime.outputs.fingerprint_preflight = sanitizeFingerprintPreflightVerdict(verdict);
    if (!verdict.passed) {
      const mismatchSummary = verdict.mismatches
        .map((mismatch) => `${mismatch.field}: ${mismatch.reason}`)
        .join("; ");
      throw new Error(
        `Fingerprint preflight blocked${mismatchSummary ? `: ${mismatchSummary}` : ""}`,
      );
    }
  }

  private async executeStep(runtime: Runtime, step: CompiledGraphStep) {
    const startedAt = new Date().toISOString();
    try {
      await this.executeAction(runtime, step.config);
      runtime.traces.push({
        node_id: step.node_id,
        label: step.label,
        action_type: step.config.type,
        status: "success",
        mode: actionTraceMode(step.config),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
      });
    } catch (error) {
      runtime.traces.push({
        node_id: step.node_id,
        label: step.label,
        action_type: step.config.type,
        status: isAbortError(error) ? "stopped" : "failed",
        mode: actionTraceMode(step.config),
        started_at: startedAt,
        finished_at: new Date().toISOString(),
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
    });
  }

  private async executeAction(runtime: Runtime, action: ActionConfig): Promise<void> {
    this.throwIfCancelled(runtime.signal);
    switch (action.type) {
      case "navigate": {
        const url = renderTemplate(action.config.url, runtime.outputs);
        await this.enforceNavigationPolicy(runtime, url);
        await runtime.page.goto(url, {
          waitUntil: waitUntil(action.config.wait_until),
          timeout: action.config.timeout_ms ?? undefined,
        });
        return;
      }
      case "wait":
        await this.executeWait(runtime, action);
        return;
      case "random_wait": {
        const waitMs =
          action.config.min_ms +
          Math.floor(this.random() * (action.config.max_ms - action.config.min_ms + 1));
        await this.sleep(waitMs, runtime.signal);
        return;
      }
      case "input_text": {
        const locator = await this.locatorForAction(runtime, action.config);
        if (action.config.clear_before_input) await locator.fill("");
        await locator.fill(renderTemplate(action.config.text, runtime.outputs));
        return;
      }
      case "clear_input":
        await (await this.locatorForAction(runtime, action.config)).fill("");
        return;
      case "click":
        await (await this.locatorForAction(runtime, action.config)).click();
        return;
      case "hover":
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "hover",
          action.type,
        )();
        return;
      case "double_click":
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "dblclick",
          action.type,
        )();
        return;
      case "right_click":
        await rightClickTarget(
          runtime.page,
          await this.locatorForAction(runtime, action.config),
          this.sleep,
          this.random,
          action.config.timeout_ms,
          runtime.signal,
        );
        return;
      case "drag_and_drop":
        await this.executeDragAndDrop(runtime, action);
        return;
      case "scroll":
        await this.executeScroll(runtime, action);
        return;
      case "select_option":
        assertRuntimeEnumValue(
          action.config.match_by,
          ["label", "value"],
          "Match by must be label or value",
        );
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "selectOption",
          action.type,
        )(
          action.config.match_by === "label"
            ? { label: action.config.value }
            : { value: action.config.value },
        );
        return;
      case "check":
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "check",
          action.type,
        )();
        return;
      case "select_radio":
        await selectRadioTarget(await this.locatorForAction(runtime, action.config));
        return;
      case "uncheck":
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "uncheck",
          action.type,
        )();
        return;
      case "toggle_checkbox":
        await (await this.locatorForAction(runtime, action.config)).click();
        return;
      case "press_key":
        await this.pressKeyHuman(runtime.page, action.config.key, runtime.signal);
        return;
      case "hotkey":
        await this.pressHotkeyHuman(runtime.page, action.config.keys, runtime.signal);
        return;
      case "type_sequence":
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "type",
          action.type,
        )(
          renderTemplate(action.config.text, runtime.outputs),
          { delay: action.config.delay_ms ?? 0 },
        );
        return;
      case "set_clipboard":
        runtime.clipboard = action.config.text;
        return;
      case "paste_clipboard":
        await this.executePasteClipboard(runtime, action);
        return;
      case "focus_element":
        await (await this.locatorForAction(runtime, action.config)).click();
        return;
      case "blur_element":
        await runtime.page.keyboard?.press("Tab");
        return;
      case "upload_file":
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "setInputFiles",
          action.type,
        )(
          action.config.files,
        );
        return;
      case "submit_form":
        if (action.config.xpath || action.config.target) {
          await submitFormTarget(await this.locatorForAction(runtime, action.config, "form"));
        } else {
          await this.pressKeyHuman(runtime.page, "Enter", runtime.signal);
        }
        return;
      case "select_custom_option":
        await (await locatorFor(runtime.page, action.config.trigger_target, action.config.trigger_xpath)).click();
        await runtime.page.locator(`text=${action.config.option_text}`).click();
        return;
      case "set_contenteditable":
        await (await this.locatorForAction(runtime, action.config)).fill(
          renderTemplate(action.config.text, runtime.outputs),
        );
        return;
      case "extract_text":
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            await locatorFor(runtime.page, action.config.target, action.config.xpath),
            "textContent",
            action.type,
          )()) ?? "";
        return;
      case "extract_attribute":
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            await locatorFor(runtime.page, action.config.target, action.config.xpath),
            "getAttribute",
            action.type,
          )(
            action.config.attribute,
          )) ?? "";
        return;
      case "extract_input_value":
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            await locatorFor(runtime.page, action.config.target, action.config.xpath),
            "inputValue",
            action.type,
          )()) ?? "";
        return;
      case "extract_list":
        runtime.outputs[action.config.output_name] = await extractListLike(
          await locatorFor(runtime.page, action.config.target, action.config.xpath),
        );
        return;
      case "extract_table":
        runtime.outputs[action.config.output_name] = await extractTable(
          await locatorFor(runtime.page, action.config.target, action.config.xpath),
        );
        return;
      case "take_screenshot": {
        const artifact = resolveEvidenceArtifact({
          evidenceDir: this.appPaths.evidenceDir,
          runId: runtime.runId,
          kind: "screenshots",
          stepNumber: runtime.currentStepNumber,
          nodeId: runtime.currentStepId,
          requestedName: action.config.path,
          fallbackName: "screenshot",
          extension: ".png",
        });
        await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
        const buffer = await runtime.page.screenshot?.({ fullPage: action.config.full_page });
        if (buffer) await fs.writeFile(artifact.absolutePath, buffer);
        this.recordEvidence(runtime, {
          actionType: action.type,
          artifactKind: "screenshot",
          relativePath: artifact.relativePath,
        });
        if (action.config.output_name) runtime.outputs[action.config.output_name] = artifact.relativePath;
        return;
      }
      case "go_back":
        await runtime.page.goBack?.();
        return;
      case "go_forward":
        await runtime.page.goForward?.();
        return;
      case "reload":
        await runtime.page.reload?.();
        return;
      case "open_new_tab":
        runtime.page = await runtime.context.newPage();
        if (action.config.url) {
          const url = renderTemplate(action.config.url, runtime.outputs);
          await this.enforceNavigationPolicy(runtime, url);
          await runtime.page.goto(url);
        }
        return;
      case "switch_tab": {
        const page = runtime.context.pages()[action.config.index];
        if (!page) throw new Error(`Tab index ${action.config.index} does not exist`);
        runtime.page = page;
        await runtime.page.bringToFront?.();
        return;
      }
      case "close_tab": {
        const pageIndex = action.config.index ?? runtime.context.pages().length - 1;
        const page = runtime.context.pages()[pageIndex];
        if (!page) throw new Error(`Tab index ${pageIndex} does not exist`);
        await page.close?.();
        runtime.page = runtime.context.pages()[0] ?? (await runtime.context.newPage());
        return;
      }
      case "accept_dialog":
        this.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
        return;
      case "dismiss_dialog":
        this.registerDialogHandler(runtime, "dismiss");
        return;
      case "wait_for_download": {
        const artifactPath = await this.waitForDownload(runtime, action.config.output_name, action.config.timeout_ms);
        runtime.outputs[action.config.output_name] = artifactPath;
        return;
      }
      case "set_variable":
        setVariables(runtime.outputs, action.config);
        return;
      case "set_json_variables": {
        const parsed = JSON.parse(renderTemplate(action.config.json, runtime.outputs));
        if (!isPlainRecord(parsed)) throw new Error("JSON variables must be an object");
        flattenObject(runtime.outputs, "", parsed);
        return;
      }
      case "assert_element": {
        const locator = await locatorFor(runtime.page, action.config.target, action.config.xpath);
        await assertElementState(locator, action.config.state, action.config.timeout_ms);
        return;
      }
      case "assert_text": {
        assertRuntimeEnumValue(
          action.config.match_mode,
          ["contains", "equals"],
          "Match mode must be contains or equals",
        );
        const text = action.config.xpath || action.config.target
          ? await (await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body")).textContent?.()
          : "";
        if (action.config.match_mode === "equals" && text !== action.config.text) {
          throw new Error(`Text did not equal ${action.config.text}`);
        }
        if (action.config.match_mode === "contains" && !String(text ?? "").includes(action.config.text)) {
          throw new Error(`Text did not contain ${action.config.text}`);
        }
        return;
      }
      case "graph_noop":
        return;
      case "if_condition":
        await this.executeActions(
          runtime,
          await conditionMatches(runtime, action.config.condition)
            ? action.config.then_steps
            : action.config.else_steps,
        );
        return;
      case "router_condition":
        for (const caseValue of action.config.cases) {
          let matched = false;
          try {
            matched = await conditionMatches(runtime, caseValue.condition);
          } catch (error) {
            throw new Error(
              `Router ${runtime.currentStepId ?? "unknown"} case "${caseValue.label}" condition failed: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
          if (matched) {
            await this.executeActions(runtime, caseValue.steps);
            return;
          }
        }
        await this.executeActions(runtime, action.config.default_steps);
        return;
      case "repeat_times":
        for (let index = 0; index < action.config.times; index += 1) {
          const control = await this.executeLoopBody(runtime, action.config.steps);
          if (control === "break") break;
        }
        return;
      case "repeat_for_each": {
        const items = action.config.array_variable
          ? (runtime.outputs[action.config.array_variable] as unknown[])
          : action.config.items;
        if (!Array.isArray(items)) throw new Error("repeat_for_each source is not an array");
        for (const item of items) {
          writeVariableValue(runtime.outputs, action.config.item_name, item);
          const control = await this.executeLoopBody(runtime, action.config.steps);
          if (control === "break") break;
        }
        return;
      }
      case "retry_block":
        await this.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, action.config.steps, action.config.failed_steps ?? []);
        return;
      case "switch_condition": {
        const value = String(runtime.outputs[action.config.expression] ?? action.config.expression);
        const branch = action.config.cases.find((candidate) => candidate.value === value);
        await this.executeActions(runtime, branch?.steps ?? action.config.default_steps);
        return;
      }
      case "while_loop":
        await this.executeLoop(
          runtime,
          action.config.steps,
          action.config.max_attempts ?? 100,
          () => conditionMatches(runtime, action.config.condition),
          action.config.timeout_ms ?? null,
        );
        return;
      case "repeat_until": {
        const result = await this.executeLoop(
          runtime,
          action.config.steps,
          action.config.max_attempts ?? 100,
          async () => !(await conditionMatches(runtime, action.config.condition)),
          action.config.timeout_ms ?? null,
        );
        if (
          (result === "max_attempts" || result === "timeout") &&
          !(await conditionMatches(runtime, action.config.condition))
        ) {
          await this.executeActions(runtime, action.config.timeout_steps);
        }
        return;
      }
      case "try_catch":
        try {
          await this.executeActions(runtime, action.config.try_steps);
          await this.executeActions(runtime, action.config.success_steps);
        } catch (error) {
          if (action.config.error_steps.length === 0) throw error;
          await this.executeActions(runtime, action.config.error_steps);
        } finally {
          await this.executeActions(runtime, action.config.finally_steps);
        }
        return;
      case "fallback_block":
        try {
          await this.executeActions(runtime, action.config.primary_steps);
        } catch (error) {
          if (action.config.fallback_steps.length === 0) throw error;
          await this.executeActions(runtime, action.config.fallback_steps);
        }
        return;
      case "break_loop":
        throw new LoopControl("break");
      case "continue_loop":
        throw new LoopControl("continue");
      case "stop_workflow":
        throw new RunnerStop(
          action.config.status === "success" ? "success" : "failure",
          action.config.reason ?? "Workflow stopped",
          Boolean(action.config.close_browser),
        );
      case "transform_variable":
        runtime.outputs[action.config.target_name] = renderTemplate(action.config.expression, runtime.outputs);
        return;
      case "assert_output": {
        assertRuntimeEnumValue(
          action.config.match_mode,
          ["contains", "equals"],
          "Match mode must be contains or equals",
        );
        const actual = String(runtime.outputs[action.config.name] ?? "");
        if (action.config.match_mode === "equals" && actual !== action.config.value) {
          throw new Error(`Output ${action.config.name} did not equal ${action.config.value}`);
        }
        if (action.config.match_mode === "contains" && !actual.includes(action.config.value)) {
          throw new Error(`Output ${action.config.name} did not contain ${action.config.value}`);
        }
        return;
      }
      case "domain_allowlist": {
        const hostname = await currentPageHostname(runtime);
        if (!hostname || !hostnameAllowed(hostname, action.config.domains)) {
          throw new Error(
            `Current domain ${hostname ?? "unknown"} is not in the allowlist`,
          );
        }
        runtime.outputs.domain_allowlist = action.config.domains;
        return;
      }
      case "set_viewport":
        await runtime.page.setViewportSize?.({
          width: action.config.width,
          height: action.config.height,
        });
        runtime.outputs.last_set_viewport = action.config;
        return;
      case "set_geolocation":
        await runtime.context.setGeolocation?.(action.config);
        runtime.outputs.last_set_geolocation = action.config;
        return;
      case "set_extra_headers":
        await runtime.context.setExtraHTTPHeaders?.(
          Object.fromEntries(
            action.config.headers.map((header) => [header.name, header.value]),
          ),
        );
        runtime.outputs.last_set_extra_headers = action.config;
        return;
      case "grant_permission":
        await runtime.context.grantPermissions?.(
          action.config.permissions,
          action.config.origin ? { origin: action.config.origin } : undefined,
        );
        runtime.outputs.last_grant_permission = action.config;
        return;
      case "set_cookie": {
        const domain = action.config.domain?.trim() || await currentPageHostname(runtime);
        if (!domain) {
          throw new Error("Set cookie requires a current page host when Domain is blank");
        }
        await runtime.context.addCookies?.([
          {
            name: action.config.name,
            value: action.config.value,
            domain,
            path: action.config.path ?? "/",
          },
        ]);
        runtime.outputs.last_set_cookie = { ...action.config, domain };
        return;
      }
      case "clear_cookies":
        await runtime.context.clearCookies?.(
          action.config.domain ? { domain: action.config.domain } : undefined,
        );
        runtime.outputs.last_clear_cookies = action.config;
        return;
      case "execute_js":
        if (action.config.output_name) {
          runtime.outputs[action.config.output_name] = await withActionTimeout(
            runtime.page.evaluate(executableJavaScript(action.config.script)),
            action.config.timeout_ms,
            (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
          );
        } else {
          await withActionTimeout(
            runtime.page.evaluate(executableJavaScript(action.config.script)),
            action.config.timeout_ms,
            (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
          );
        }
        return;
      case "wait_for_request":
        runtime.outputs.last_request_url = (
          await runtime.page.waitForRequest?.(
            (request) => request.url().includes(action.config.url_contains),
            { timeout: action.config.timeout_ms ?? undefined },
          )
        )?.url();
        return;
      case "wait_for_response": {
        const response = await runtime.page.waitForResponse?.(
          (candidate) =>
            candidate.url().includes(action.config.url_contains) &&
            (!action.config.status || candidate.status() === action.config.status),
          { timeout: action.config.timeout_ms ?? undefined },
        );
        runtime.outputs.last_response_url = response?.url();
        return;
      }
      case "block_request":
        for (const pattern of action.config.url_patterns) {
          await runtime.context.route?.(pattern, async (route) => route.abort());
        }
        return;
      case "mock_response":
        await runtime.context.route?.(
          (url) => url.toString().includes(action.config.url_contains),
          async (route) =>
            route.fulfill({
              status: action.config.status,
              body: action.config.body,
              contentType: action.config.content_type ?? "text/plain",
            }),
        );
        return;
      case "set_local_storage":
        await setWebStorage(runtime.page, "local", action.config.key, action.config.value);
        runtime.outputs[action.config.key] = action.config.value;
        return;
      case "set_session_storage":
        await setWebStorage(runtime.page, "session", action.config.key, action.config.value);
        runtime.outputs[action.config.key] = action.config.value;
        return;
    }
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
        stateStepId: runtime.liveState.current_step_id,
      };
      runtime.currentStepId = action.graph_node_id;
      runtime.currentActionType = action.type;
      runtime.liveState.current_step_id = action.graph_node_id;
      this.reportProgress(runtime);
      await this.executeAction(runtime, action);
      if (!runtime.liveState.completed_step_ids.includes(action.graph_node_id)) {
        runtime.liveState.completed_step_ids.push(action.graph_node_id);
      }
      this.reportProgress(runtime);
      runtime.currentStepId = previous.runtimeStepId;
      runtime.currentActionType = previous.runtimeActionType;
      runtime.liveState.current_step_id = previous.stateStepId;
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
          await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body"),
          "visible",
          action.config.timeout_ms,
        );
        return;
      case "element_attached":
        await waitForLocatorState(
          await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body"),
          "attached",
          action.config.timeout_ms,
        );
        return;
      case "element_enabled": {
        const locator = await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body");
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
          await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body"),
          "hidden",
          action.config.timeout_ms,
        );
        return;
      case "element_detached":
        await waitForLocatorState(
          await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body"),
          "detached",
          action.config.timeout_ms,
        );
        return;
      case "element_disabled":
        await this.waitForLocatorEnabled(
          await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body"),
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
    const source = await locatorFor(runtime.page, action.config.source_target, action.config.source_xpath);
    const target = await locatorFor(runtime.page, action.config.target_target, action.config.target_xpath);
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
    if (!source.dragTo) {
      throw new Error("drag_and_drop requires driver dragTo support");
    }
    await source.dragTo(target, { timeout: action.config.timeout_ms ?? undefined });
  }

  private async executeScroll(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "scroll" }>,
  ) {
    const mode = action.config.mode ?? "page";
    if (mode === "page") {
      await humanPageScroll(
        runtime.page,
        action.config.direction ?? "down",
        action.config.pixels ?? 0,
        this.sleep,
        this.random,
        runtime.signal,
      );
      return;
    }

    const locator = await this.locatorForAction(runtime, action.config, "");
    if (mode === "until_visible") {
      await waitForLocatorState(locator, "visible", action.config.timeout_ms);
    }
    await scrollLocatorIntoView(locator, action.config.timeout_ms);
  }

  private async executePasteClipboard(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "paste_clipboard" }>,
  ) {
    await runtime.context.grantPermissions?.(["clipboard-read", "clipboard-write"]).catch(() => undefined);
    await writeBrowserClipboard(runtime.page, runtime.clipboard);
    await (await this.locatorForAction(runtime, action.config)).click();
    await pressKeyboardShortcut(
      runtime.page,
      process.platform === "darwin" ? "Meta+V" : "Control+V",
    );
  }

  private async pressKeyHuman(
    page: BrowserDriverPage,
    key: string,
    signal?: AbortSignal,
  ) {
    const keyboard = page.keyboard;
    if (!keyboard) return;
    if (keyboard.down && keyboard.up) {
      await keyboard.down(key);
      await this.sleep(keyHoldMs(this.random), signal);
      await keyboard.up(key);
      return;
    }
    await keyboard.press(key);
  }

  private async pressHotkeyHuman(
    page: BrowserDriverPage,
    keys: string[],
    signal?: AbortSignal,
  ) {
    const keyboard = page.keyboard;
    if (!keyboard) return;
    if (!keyboard.down || !keyboard.up) {
      await keyboard.press(keys.join("+"));
      return;
    }

    const primaryKey = keys[keys.length - 1];
    const modifiers = keys.slice(0, -1);
    for (const modifier of modifiers) {
      await keyboard.down(modifier);
      await this.sleep(keyGapMs(this.random), signal);
    }
    if (primaryKey) {
      await keyboard.down(primaryKey);
      await this.sleep(keyHoldMs(this.random), signal);
      await keyboard.up(primaryKey);
    }
    for (const modifier of [...modifiers].reverse()) {
      await this.sleep(keyGapMs(this.random), signal);
      await keyboard.up(modifier);
    }
  }

  private registerDialogHandler(
    runtime: Runtime,
    behavior: "accept" | "dismiss",
    promptText?: string,
  ) {
    if (!runtime.page.once) {
      throw new Error(`${behavior}_dialog requires driver dialog event support`);
    }
    runtime.page.once("dialog", async (dialog) => {
      if (behavior === "accept") {
        await dialog.accept(promptText);
      } else {
        await dialog.dismiss();
      }
    });
  }

  private async waitForDownload(
    runtime: Runtime,
    outputName: string,
    timeoutMs: number | null | undefined,
  ) {
    if (!runtime.page.waitForEvent) {
      throw new Error("wait_for_download requires driver download event support");
    }
    const download = await runtime.page.waitForEvent("download", {
      timeout: timeoutMs ?? undefined,
    });
    if (!download.saveAs) {
      throw new Error("wait_for_download requires driver download save support");
    }
    const suggestedName = download.suggestedFilename?.() ?? "download";
    const artifact = resolveEvidenceArtifact({
      evidenceDir: this.appPaths.evidenceDir,
      runId: runtime.runId,
      kind: "downloads",
      stepNumber: runtime.currentStepNumber,
      nodeId: runtime.currentStepId,
      requestedName: suggestedName,
      fallbackName: outputName || "download",
      extension: path.extname(suggestedName) || ".download",
    });
    await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
    await download.saveAs(artifact.absolutePath);
    this.recordEvidence(runtime, {
      actionType: "wait_for_download",
      artifactKind: "download",
      relativePath: artifact.relativePath,
    });
    return artifact.relativePath;
  }

  private async locatorForAction(
    runtime: Runtime,
    config: {
      target?: ElementTarget | null;
      xpath?: string | null;
      iframe_xpath?: string | null;
      wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
      timeout_ms?: number | null;
    },
    fallbackXpath = "body",
  ) {
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
      attempts += 1;
      const control = await this.executeLoopBody(runtime, steps);
      if (control === "break") return "break";
      if (timeoutMs != null && Date.now() - startedAt >= timeoutMs) return "timeout";
    }
    return "predicate_false";
  }

  private async collectOutputs(runtime: Runtime) {
    try {
      const pageOutputs = await runtime.page.evaluate<Record<string, unknown>>(
        "() => globalThis.window?.__wamOutputs ?? {}",
      );
      return { ...pageOutputs, ...runtime.outputs };
    } catch {
      return runtime.outputs;
    }
  }

  private async captureFailureScreenshot(runtime: Runtime) {
    if (!runtime.page.screenshot) return;
    const artifact = resolveEvidenceArtifact({
      evidenceDir: this.appPaths.evidenceDir,
      runId: runtime.runId,
      kind: "screenshots",
      stepNumber: runtime.currentStepNumber,
      nodeId: runtime.currentStepId,
      requestedName: "failure.png",
      fallbackName: "failure",
      extension: ".png",
    });
    await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
    const buffer = await runtime.page.screenshot({ fullPage: true });
    await fs.writeFile(artifact.absolutePath, buffer);
    this.recordEvidence(runtime, {
      actionType: runtime.currentActionType ?? "workflow",
      artifactKind: "screenshot",
      relativePath: artifact.relativePath,
    });
    runtime.outputs.failure_screenshot = artifact.relativePath;
  }

  private recordEvidence(
    runtime: Runtime,
    artifact: {
      actionType: string;
      artifactKind: EvidenceArtifact["artifact_kind"];
      relativePath: string;
    },
  ) {
    runtime.evidence.push({
      run_id: runtime.runId,
      node_id: runtime.currentStepId,
      step_number: runtime.currentStepNumber,
      action_type: artifact.actionType,
      artifact_kind: artifact.artifactKind,
      path: artifact.relativePath,
      created_at: new Date().toISOString(),
    });
  }

  private throwIfCancelled(signal?: AbortSignal) {
    if (signal?.aborted) {
      throw new RunnerStop("stopped", "Run stopped");
    }
  }
}

export function createCloakBrowserDriver(moduleOverride?: CloakBrowserModule): BrowserDriver {
  async function loadModule() {
    return moduleOverride ?? loadCloakBrowserModule();
  }

  return {
    async launch(options) {
      const cloakbrowser = await loadModule();
      return cloakbrowser.launchContext(options);
    },
    async launchPersistent(options) {
      const cloakbrowser = await loadModule();
      return cloakbrowser.launchPersistentContext(options);
    },
  };
}

function assertHeadedDisplayAvailable(settings: WorkflowSettings) {
  if (settings.browser_launch.headless) return;
  if (process.platform !== "linux") return;
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return;
  throw new Error(
    "Headed CloakBrowser runs require DISPLAY or WAYLAND_DISPLAY on Linux. Enable headless mode or run under Xvfb/Wayland before launching a headed identity.",
  );
}

async function loadCloakBrowserModule(): Promise<CloakBrowserModule> {
  return (await import("cloakbrowser")) as unknown as CloakBrowserModule;
}

async function submitFormTarget(locator: BrowserDriverLocator) {
  const failures: unknown[] = [];
  try {
    await locator.click();
    return;
  } catch (error) {
    failures.push(error);
  }

  if (locator.press) {
    try {
      await locator.press("Enter");
      return;
    } catch (error) {
      failures.push(error);
    }
  }

  if (locator.evaluate) {
    await locator.evaluate((element) => {
      const form = element instanceof HTMLFormElement ? element : element.closest("form");
      if (!form) {
        if (element instanceof HTMLElement) element.click();
        return;
      }

      const submitter =
        element instanceof HTMLButtonElement ||
        (element instanceof HTMLInputElement &&
          (element.type === "submit" || element.type === "image"))
          ? element
          : undefined;

      if (form.requestSubmit) {
        form.requestSubmit(submitter);
        return;
      }

      const event = new Event("submit", { bubbles: true, cancelable: true });
      if (form.dispatchEvent(event)) form.submit();
    });
    return;
  }

  throw firstActionFailure(failures, "submit_form could not click, press, or submit the target");
}

async function selectRadioTarget(locator: BrowserDriverLocator) {
  const failures: unknown[] = [];
  if (locator.check) {
    try {
      await locator.check();
      return;
    } catch (error) {
      failures.push(error);
    }
  }

  try {
    await locator.click();
    return;
  } catch (error) {
    failures.push(error);
  }

  if (locator.evaluate) {
    await locator.evaluate((element) => {
      const radio =
        element instanceof HTMLInputElement && element.type === "radio"
          ? element
          : element.querySelector<HTMLInputElement>("input[type='radio']");

      if (!radio) {
        if (element instanceof HTMLElement) element.click();
        return;
      }

      if (radio.checked) return;
      radio.checked = true;
      radio.dispatchEvent(new Event("input", { bubbles: true }));
      radio.dispatchEvent(new Event("change", { bubbles: true }));
    });
    return;
  }

  throw firstActionFailure(failures, "select_radio could not check or click the target");
}

async function humanPageScroll(
  page: BrowserDriverPage,
  direction: Extract<ActionConfig, { type: "scroll" }>["config"]["direction"],
  pixels: number,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
) {
  const deltaX = direction === "left" ? -pixels : direction === "right" ? pixels : 0;
  const deltaY = direction === "up" ? -pixels : direction === "down" ? pixels : 0;
  if (page.mouse?.wheel) {
    const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
    const steps = Math.max(2, Math.min(10, Math.ceil(distance / 180)));
    let remainingX = deltaX;
    let remainingY = deltaY;
    for (let remainingSteps = steps; remainingSteps > 0; remainingSteps -= 1) {
      throwIfAborted(signal);
      const chunkX = nextScrollChunk(remainingX, remainingSteps, random);
      const chunkY = nextScrollChunk(remainingY, remainingSteps, random);
      await page.mouse.wheel(chunkX, chunkY);
      remainingX -= chunkX;
      remainingY -= chunkY;
      if (remainingSteps > 1) {
        await sleepFn(scrollPauseMs(random), signal);
      }
    }
    return;
  }
  await page.evaluate(
    (payload?: { deltaX: number; deltaY: number }) => {
      const { deltaX: x, deltaY: y } = payload ?? { deltaX: 0, deltaY: 0 };
      window.scrollBy({ left: x, top: y, behavior: "instant" });
      window.dispatchEvent(new Event("scroll"));
    },
    { deltaX, deltaY },
  );
}

async function scrollLocatorIntoView(
  locator: BrowserDriverLocator,
  timeoutMs: number | null | undefined,
) {
  if (locator.scrollIntoViewIfNeeded) {
    await locator.scrollIntoViewIfNeeded({ timeout: timeoutMs ?? undefined });
    return;
  }

  if (locator.evaluate) {
    await locator.evaluate(
      (element, arg?: { block: ScrollLogicalPosition; inline: ScrollLogicalPosition }) => {
        element.scrollIntoView({
          block: arg?.block ?? "center",
          inline: arg?.inline ?? "nearest",
          behavior: "smooth",
        });
      },
      { block: "center", inline: "nearest" },
    );
    return;
  }

  throw new Error("scroll requires driver support for locator.scrollIntoViewIfNeeded");
}

async function writeBrowserClipboard(page: BrowserDriverPage, text: string) {
  await page.evaluate(
    async (payload?: { text: string }) => {
      await navigator.clipboard.writeText(payload?.text ?? "");
    },
    { text },
  );
}

async function pressKeyboardShortcut(page: BrowserDriverPage, shortcut: string) {
  if (page.keyboard?.press) {
    await page.keyboard.press(shortcut);
    return;
  }
  throw new Error("paste_clipboard requires driver keyboard shortcut support");
}

async function rightClickTarget(
  page: BrowserDriverPage,
  locator: BrowserDriverLocator,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  timeoutMs: number | null | undefined,
  signal?: AbortSignal,
) {
  await scrollLocatorIntoView(locator, timeoutMs);
  const box = await locator.boundingBox?.();
  if (box && page.mouse?.move && page.mouse.down && page.mouse.up) {
    const targetX = Math.round((box.x ?? 0) + box.width / 2);
    const targetY = Math.round((box.y ?? 0) + box.height / 2);
    await humanMoveToPoint(page, targetX, targetY, sleepFn, random, signal);
    await page.mouse.down({ button: "right" });
    await sleepFn(keyHoldMs(random), signal);
    await page.mouse.up({ button: "right" });
    return;
  }
  await locator.click({ button: "right" });
}

async function humanMoveToPoint(
  page: BrowserDriverPage,
  targetX: number,
  targetY: number,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
) {
  const steps = 3 + Math.floor(random() * 3);
  for (let index = 1; index <= steps; index += 1) {
    throwIfAborted(signal);
    const progress = index / steps;
    const wobble = index === steps ? 0 : (random() - 0.5) * 8;
    await page.mouse?.move?.(
      Math.round(targetX * progress + wobble),
      Math.round(targetY * progress + wobble),
    );
    if (index < steps) {
      await sleepFn(mouseMovePauseMs(random), signal);
    }
  }
}

function nextScrollChunk(total: number, remainingSteps: number, random: () => number) {
  if (remainingSteps <= 1) return total;
  const base = total / remainingSteps;
  const jitter = Math.abs(base) * 0.25 * (random() - 0.5);
  const chunk = Math.round(base + jitter);
  if (chunk !== 0) return chunk;
  return total > 0 ? 1 : total < 0 ? -1 : 0;
}

function scrollPauseMs(random: () => number) {
  return 30 + Math.floor(random() * 90);
}

function keyHoldMs(random: () => number) {
  return 35 + Math.floor(random() * 85);
}

function keyGapMs(random: () => number) {
  return 20 + Math.floor(random() * 50);
}

function mouseMovePauseMs(random: () => number) {
  return 20 + Math.floor(random() * 40);
}

function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) {
    throw new RunnerStop("stopped", "Run stopped");
  }
}

function firstActionFailure(failures: unknown[], fallbackMessage: string) {
  const firstFailure = failures.find((failure) => failure instanceof Error);
  return firstFailure instanceof Error ? firstFailure : new Error(fallbackMessage);
}

function buildLaunchOptions(
  settings: WorkflowSettings,
  appPaths: AppPaths,
): BrowserLaunchOptions {
  const browser = settings.browser_launch;
  const proxy = buildProxyLaunchOptions(browser);
  const viewport = {
    width: browser.viewport_width || 1920,
    height: browser.viewport_height || 1080,
  };
  const args = [
    browser.fingerprint_seed?.trim()
      ? `--fingerprint=${browser.fingerprint_seed.trim()}`
      : null,
    browserBrandLaunchArg(browser.browser_brand),
    browser.fingerprint_platform?.trim()
      ? `--fingerprint-platform=${browser.fingerprint_platform.trim()}`
      : null,
    browser.hardware_concurrency
      ? `--fingerprint-hardware-concurrency=${browser.hardware_concurrency}`
      : null,
    browser.device_memory_gb
      ? `--fingerprint-device-memory=${browser.device_memory_gb}`
      : null,
    browser.fingerprint_fonts_dir?.trim()
      ? `--fingerprint-fonts-dir=${browser.fingerprint_fonts_dir.trim()}`
      : null,
    browser.storage_quota_mb
      ? `--fingerprint-storage-quota=${browser.storage_quota_mb}`
      : null,
    browser.webrtc_policy === "auto_proxy_exit_ip"
      ? "--fingerprint-webrtc-ip=auto"
      : browser.webrtc_policy === "explicit_ip" && browser.webrtc_ip?.trim()
        ? `--fingerprint-webrtc-ip=${browser.webrtc_ip.trim()}`
        : null,
    browser.headless ? null : `--window-size=${viewport.width},${viewport.height}`,
  ].filter((arg): arg is string => Boolean(arg));
  return {
    headless: browser.headless,
    humanize: browser.humanize !== false,
    humanPreset: browser.human_preset === "careful" ? "careful" : "default",
    userAgent: browser.user_agent?.trim() || undefined,
    viewport,
    timezone: browser.timezone?.trim() || undefined,
    locale: browser.locale?.trim() || undefined,
    geoip: Boolean(browser.geoip),
    args,
    proxy,
    contextOptions: {
      acceptDownloads: true,
      downloadsPath: appPaths.downloadsDir,
      deviceScaleFactor: browser.device_scale_factor || 1,
      isMobile: Boolean(browser.mobile),
      hasTouch: Boolean(browser.touch),
    },
  };
}

function buildProxyLaunchOptions(browser: WorkflowSettings["browser_launch"]) {
  if (!browser.proxy_enabled || !browser.proxy_server) return undefined;
  const proxy = {
    server: browser.proxy_server,
    bypass: browser.proxy_bypass ?? undefined,
    username: browser.proxy_username ?? undefined,
    password: browser.proxy_password ?? undefined,
  };
  try {
    const url = new URL(browser.proxy_server);
    const username = url.username ? decodeURIComponent(url.username) : undefined;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    if (username || password) {
      url.username = "";
      url.password = "";
      proxy.server = url.toString();
      proxy.username = proxy.username ?? username;
      proxy.password = proxy.password ?? password;
    }
  } catch {
    return proxy;
  }
  return proxy;
}

function retainedProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return (
    settings.browser_launch.profile_dir?.trim() ||
    settings.browser_launch.profile_name?.trim() ||
    null
  );
}

function retainedSessionKey(workflowId: string | null, profileName: string | null) {
  return `${workflowId ?? ""}\u0000${profileName ?? ""}`;
}

async function browserIdentityEvidence(settings: WorkflowSettings, runId: string) {
  const browser = settings.browser_launch;
  return {
    run_id: runId,
    identity_id: browser.identity_id,
    display_name: browser.display_name,
    profile_dir:
      browser.session_mode === "persistent_profile"
        ? browser.profile_dir
        : "temporary",
    session_mode: browser.session_mode,
    fingerprint_seed_hash: createHash("sha256")
      .update(browser.fingerprint_seed)
      .digest("hex")
      .slice(0, 16),
    proxy_label: browser.proxy_label ?? null,
    proxy_region: browser.proxy_region ?? null,
    proxy_provider: browser.proxy_provider ?? null,
    test_account_binding: browser.test_account_binding ?? null,
    timezone: browser.timezone ?? null,
    timezone_source: browser.timezone ? "explicit" : browser.geoip ? "geoip" : "default",
    locale: browser.locale ?? null,
    locale_source: browser.locale ? "explicit" : browser.geoip ? "geoip" : "default",
    geoip: browser.geoip,
    webrtc_policy: browser.webrtc_policy,
    webrtc_ip: browser.webrtc_policy === "explicit_ip" ? browser.webrtc_ip ?? null : null,
    browser_brand: browser.browser_brand ?? "chrome",
    viewport: {
      width: browser.viewport_width,
      height: browser.viewport_height,
      device_scale_factor: browser.device_scale_factor,
      mobile: browser.mobile,
      touch: browser.touch,
    },
    humanize: browser.humanize !== false,
    human_preset: browser.human_preset === "careful" ? "careful" : "default",
    advanced_overrides: activeAdvancedFingerprintOverrides(browser),
    cloakbrowser: await cloakBrowserRuntimeEvidence(),
  };
}

function browserBrandLaunchArg(brand: WorkflowSettings["browser_launch"]["browser_brand"]) {
  if (brand === "microsoft_edge") return "--fingerprint-brand=Edge";
  return null;
}

function activeAdvancedFingerprintOverrides(browser: WorkflowSettings["browser_launch"]) {
  return [
    browser.fingerprint_platform ? "fingerprint_platform" : null,
    browser.hardware_concurrency ? "hardware_concurrency" : null,
    browser.device_memory_gb ? "device_memory_gb" : null,
    browser.fingerprint_fonts_dir ? "fingerprint_fonts_dir" : null,
    browser.storage_quota_mb ? "storage_quota_mb" : null,
  ].filter((field): field is string => Boolean(field));
}

async function cloakBrowserRuntimeEvidence() {
  const [wrapperVersion, binary] = await Promise.all([
    cloakBrowserWrapperVersion(),
    cloakBrowserBinaryEvidence(),
  ]);
  return {
    wrapper_version: wrapperVersion,
    binary_version: binary.version,
    binary_platform: binary.platform,
    binary_installed: binary.installed,
  };
}

async function cloakBrowserBinaryEvidence() {
  try {
    const moduleValue = await loadCloakBrowserModule();
    const info = moduleValue.binaryInfo?.();
    return {
      version: info?.version ?? null,
      platform: info?.platform ?? null,
      installed: Boolean(info?.installed),
    };
  } catch {
    return {
      version: null,
      platform: process.platform,
      installed: false,
    };
  }
}

async function cloakBrowserWrapperVersion() {
  try {
    const packageJson = await fs.readFile(
      path.join(process.cwd(), "node_modules", "cloakbrowser", "package.json"),
      "utf8",
    );
    const parsed = JSON.parse(packageJson) as { version?: unknown };
    return typeof parsed.version === "string" ? parsed.version : null;
  } catch {
    return null;
  }
}

type FingerprintPreflightVerdict = {
  passed: boolean;
  verdict: string;
  risk_score: number | null;
  run_id: string;
  profile_id: string;
  mismatches: Array<{
    category: string;
    field: string;
    severity: string;
    expected?: string | null;
    observed?: string | null;
    reason: string;
  }>;
  evidence: Record<string, unknown>;
};

function parseFingerprintPreflightVerdict(raw: unknown): FingerprintPreflightVerdict {
  let parsed: unknown;
  try {
    parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
  } catch {
    throw new Error("Fingerprint preflight verdict is malformed");
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Fingerprint preflight verdict is malformed");
  }
  const record = parsed as Record<string, unknown>;
  if (typeof record.passed !== "boolean") {
    throw new Error("Fingerprint preflight verdict is missing passed");
  }
  if (typeof record.verdict !== "string" || !record.verdict.trim()) {
    throw new Error("Fingerprint preflight verdict is missing verdict");
  }
  if (typeof record.run_id !== "string" || !record.run_id.trim()) {
    throw new Error("Fingerprint preflight verdict is missing run_id");
  }
  if (typeof record.profile_id !== "string" || !record.profile_id.trim()) {
    throw new Error("Fingerprint preflight verdict is missing profile_id");
  }
  if (!Array.isArray(record.mismatches)) {
    throw new Error("Fingerprint preflight verdict mismatches must be an array");
  }
  const mismatches = record.mismatches.map((value) => {
    const mismatch = value as Record<string, unknown>;
    return {
      category: String(mismatch.category ?? "other"),
      field: String(mismatch.field ?? "unknown"),
      severity: String(mismatch.severity ?? "medium"),
      expected: optionalString(mismatch.expected),
      observed: optionalString(mismatch.observed),
      reason: String(mismatch.reason ?? "Fingerprint mismatch"),
    };
  });
  return {
    passed: record.passed,
    verdict: record.verdict,
    risk_score: typeof record.risk_score === "number" ? record.risk_score : null,
    run_id: record.run_id,
    profile_id: record.profile_id,
    mismatches,
    evidence:
      record.evidence && typeof record.evidence === "object"
        ? (record.evidence as Record<string, unknown>)
        : {},
  };
}

function sanitizeFingerprintPreflightVerdict(verdict: FingerprintPreflightVerdict) {
  return {
    passed: verdict.passed,
    verdict: verdict.verdict,
    risk_score: verdict.risk_score,
    run_id: verdict.run_id,
    profile_id: verdict.profile_id,
    mismatches: verdict.mismatches,
    evidence: verdict.evidence,
  };
}

function optionalString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function originForUrl(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

async function locatorFor(
  page: BrowserDriverPage,
  target: unknown,
  xpath?: string | null,
  iframeXpath?: string | null,
): Promise<BrowserDriverLocator> {
  const typedTarget = isElementTarget(target) ? target : null;
  const root = typedTarget?.iframe
    ? frameRootForTarget(page, typedTarget.iframe)
    : iframeXpath?.trim()
      ? frameRootForXpath(page, iframeXpath)
    : page;
  const locators = typedTarget?.locators?.length
    ? typedTarget.locators
    : xpath?.trim()
      ? [{ kind: "xpath", value: xpath } satisfies ElementLocator]
      : [];
  const constraints = typedTarget?.constraints ?? null;

  let lastLocator: BrowserDriverLocator | null = null;
  for (const locatorConfig of locators) {
    const candidate = applyIndexConstraint(
      locatorFromConfig(root, locatorConfig),
      constraints?.index,
    );
    lastLocator = candidate;
    if (await locatorSatisfiesConstraints(candidate, constraints)) {
      return candidate;
    }
  }

  if (lastLocator) {
    throw new Error("No element locator satisfied target constraints");
  }
  throw new Error("Element target is required");
}

function frameRootForTarget(page: BrowserDriverPage, iframeTarget: ElementTarget) {
  if (!page.frameLocator) {
    throw new Error("iframe targets require driver support for frameLocator");
  }
  const iframeLocator = iframeTarget.locators[0];
  if (!iframeLocator) {
    throw new Error("iframe target requires a locator");
  }
  return page.frameLocator(selectorFromLocatorConfig(iframeLocator));
}

function frameRootForXpath(page: BrowserDriverPage, iframeXpath: string) {
  if (!page.frameLocator) {
    throw new Error("iframe targets require driver support for frameLocator");
  }
  return page.frameLocator(iframeXpath);
}

function locatorFromConfig(
  root: BrowserDriverPage | BrowserDriverFrameLocator,
  locator: ElementLocator,
) {
  switch (locator.kind) {
    case "test_id":
      if (!root.getByTestId) throw new Error("Locator kind test_id requires driver support for getByTestId");
      return root.getByTestId(locator.value);
    case "role":
      if (!root.getByRole) throw new Error("Locator kind role requires driver support for getByRole");
      return root.getByRole(locator.role ?? locator.value, {
        name: locator.role ? locator.value : undefined,
        exact: locator.exact ?? undefined,
      });
    case "label":
      if (!root.getByLabel) throw new Error("Locator kind label requires driver support for getByLabel");
      return root.getByLabel(locator.value, { exact: locator.exact ?? undefined });
    case "placeholder":
      if (!root.getByPlaceholder) {
        throw new Error("Locator kind placeholder requires driver support for getByPlaceholder");
      }
      return root.getByPlaceholder(locator.value, { exact: locator.exact ?? undefined });
    case "text":
      if (!root.getByText) throw new Error("Locator kind text requires driver support for getByText");
      return root.getByText(locator.value, { exact: locator.exact ?? undefined });
    case "attribute":
      return root.locator(`[${locator.attribute ?? "data-testid"}="${cssAttributeValue(locator.value)}"]`);
    case "css":
    case "xpath":
      return root.locator(locator.value);
  }
}

function selectorFromLocatorConfig(locator: ElementLocator) {
  switch (locator.kind) {
    case "test_id":
      return `[data-testid="${cssAttributeValue(locator.value)}"]`;
    case "text":
      return `text=${locator.value}`;
    case "attribute":
      return `[${locator.attribute ?? "data-testid"}="${cssAttributeValue(locator.value)}"]`;
    case "role":
    case "label":
    case "placeholder":
      return locator.value;
    case "css":
    case "xpath":
      return locator.value;
  }
}

function applyIndexConstraint(
  locator: BrowserDriverLocator,
  index: number | null | undefined,
) {
  if (index == null) return locator;
  if (!locator.nth) throw new Error("Target index constraint requires driver support for locator.nth");
  return locator.nth(index);
}

async function locatorSatisfiesConstraints(
  locator: BrowserDriverLocator,
  constraints: ElementTarget["constraints"] | null,
) {
  if (!constraints) return true;
  if (constraints.visible != null) {
    const visible = await locator.isVisible?.();
    if (visible !== constraints.visible) return false;
  }
  if (constraints.enabled != null) {
    const enabled = await locator.isEnabled?.();
    if (enabled !== constraints.enabled) return false;
  }
  if (constraints.contains_text) {
    const text = await locator.textContent?.();
    if (!String(text ?? "").includes(constraints.contains_text)) return false;
  }
  return true;
}

function isElementTarget(value: unknown): value is ElementTarget {
  return Boolean(
    value &&
      typeof value === "object" &&
      "locators" in value &&
      Array.isArray((value as { locators?: unknown }).locators),
  );
}

function cssAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, "\\\"");
}

function assertRuntimeEnumValue(
  value: unknown,
  allowedValues: readonly string[],
  message: string,
) {
  if (typeof value !== "string" || !allowedValues.includes(value)) {
    throw new Error(message);
  }
}

async function waitForLocatorState(
  locator: BrowserDriverLocator,
  state: "attached" | "detached" | "visible" | "hidden",
  timeoutMs: number | null | undefined,
) {
  if (locator.waitFor) {
    await locator.waitFor({ state, timeout: timeoutMs ?? undefined });
    return;
  }
  if (state === "visible") {
    const visible = await locator.isVisible?.({ timeout: timeoutMs ?? undefined });
    if (!visible) throw new Error("Element is not visible");
  }
}

async function assertElementState(
  locator: BrowserDriverLocator,
  state: "attached" | "visible" | "hidden" | "enabled" | "disabled",
  timeoutMs: number | null | undefined,
) {
  if (state === "attached") {
    await locator.waitFor?.({ state: "attached", timeout: timeoutMs ?? undefined });
    if (!locator.count) throw new Error("Element attached assertion requires locator count support");
    if ((await locator.count()) <= 0) throw new Error("Element is not attached");
    return;
  }

  if (state === "visible" || state === "hidden") {
    await locator.waitFor?.({ state, timeout: timeoutMs ?? undefined });
    if (!locator.isVisible) throw new Error("Element visibility assertion requires locator visibility support");
    const visible = await locator.isVisible({ timeout: timeoutMs ?? undefined });
    if (state === "visible" && !visible) throw new Error("Element is not visible");
    if (state === "hidden" && visible) throw new Error("Element is not hidden");
    return;
  }

  await locator.waitFor?.({ state: "visible", timeout: timeoutMs ?? undefined });
  if (!locator.isEnabled) throw new Error("Element enabled assertion requires locator enabled-state support");
  const enabled = await locator.isEnabled({ timeout: timeoutMs ?? undefined });
  if (state === "enabled" && !enabled) throw new Error("Element is not enabled");
  if (state === "disabled" && enabled) throw new Error("Element is not disabled");
}

function requireLocatorMethod(
  locator: BrowserDriverLocator,
  method: keyof BrowserDriverLocator,
  actionType: string,
): (...args: unknown[]) => Promise<unknown> {
  const methodValue = locator[method];
  if (typeof methodValue !== "function") {
    throw new Error(`${actionType} requires driver support for locator.${String(method)}`);
  }
  return methodValue.bind(locator) as (...args: unknown[]) => Promise<unknown>;
}

async function setWebStorage(
  page: BrowserDriverPage,
  storage: "local" | "session",
  key: string,
  value: string,
) {
  await page.evaluate(
    (entry?: {
      storage: "local" | "session";
      key: string;
      value: string;
    }) => {
      if (!entry) return;
      const target =
        entry.storage === "local" ? window.localStorage : window.sessionStorage;
      target.setItem(entry.key, entry.value);
    },
    { storage, key, value },
  );
}

function waitUntil(value: string | null | undefined) {
  if (value === "dom_content_loaded") return "domcontentloaded";
  if (value === "network_idle") return "networkidle";
  return value ?? "load";
}

function sleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Run stopped", "AbortError"));
      return;
    }
    const timeout = setTimeout(resolve, ms);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(new DOMException("Run stopped", "AbortError"));
      },
      { once: true },
    );
  });
}

function isAbortError(error: unknown) {
  return (
    error instanceof RunnerStop && error.status === "stopped"
  ) || (
    error instanceof DOMException && error.name === "AbortError"
  );
}

function actionTraceMode(action: ActionConfig): ActionTrace["mode"] {
  if (action.type === "graph_noop" || action.type === "router_condition") return "manual";
  if (action.type.startsWith("extract") || action.type.startsWith("assert")) return "observer";
  if (runnerCapabilityForAction(action) === "direct_dom" || action.type === "set_variable") {
    return "direct_dom";
  }
  if (runnerCapabilityForAction(action) === "custom_human") return "assisted_browser";
  return "browser";
}

function runnerCapabilityForAction(action: ActionConfig): RunnerActionCapability | null {
  if (action.type === "scroll") {
    return (action.config.mode ?? "page") === "page" ? "custom_human" : "cloak_native";
  }
  return runnerActionCapabilities[action.type] ?? null;
}

function setVariables(
  outputs: Record<string, unknown>,
  config: Extract<ActionConfig, { type: "set_variable" }>["config"],
) {
  const variables = config.variables ?? [
    {
      name: config.name ?? "",
      value_type: config.value_type ?? "text",
      value: config.value ?? "",
    },
  ];
  for (const variable of variables) {
    if (!variable.name.trim()) continue;
    writeVariableValue(
      outputs,
      variable.name,
      parseVariableValue(variable.value_type, variable.value, outputs),
    );
  }
}

function parseVariableValue(
  valueType: string,
  value: string,
  outputs: Record<string, unknown>,
) {
  const rendered = renderTemplate(value, outputs);
  if (valueType === "json") return JSON.parse(rendered);
  if (valueType === "number") return Number(rendered);
  if (valueType === "boolean") return rendered === "true";
  return rendered;
}

function flattenObject(outputs: Record<string, unknown>, prefix: string, value: unknown) {
  if (!isPlainRecord(value)) {
    if (prefix) outputs[prefix] = value;
    return;
  }
  for (const [key, child] of Object.entries(value)) {
    flattenObject(outputs, prefix ? `${prefix}.${key}` : key, child);
  }
}

function writeVariableValue(
  outputs: Record<string, unknown>,
  name: string,
  value: unknown,
) {
  outputs[name] = value;
  if (isPlainRecord(value)) {
    flattenObject(outputs, name, value);
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

async function conditionMatches(runtime: Runtime, condition: unknown) {
  if (!condition || typeof condition !== "object" || !("kind" in condition)) return false;
  const typed = condition as {
    kind: string;
    name?: string;
    value?: string;
    text?: string;
    target?: unknown;
    xpath?: string | null;
  };
  if (typed.kind === "output_equals") return String(runtime.outputs[typed.name ?? ""]) === typed.value;
  if (typed.kind === "output_contains") {
    return String(runtime.outputs[typed.name ?? ""]).includes(typed.value ?? "");
  }
  if (typed.kind === "url_contains") {
    const href = String(
      (await runtime.page.evaluate<string | null | undefined>("window.location.href")) ?? "",
    );
    return href.includes(typed.value ?? "");
  }
  if (typed.kind === "text_visible") {
    return Boolean(await runtime.page.locator(`text=${typed.text ?? ""}`).isVisible?.());
  }
  if (typed.kind === "element_visible") {
    return Boolean(
      await (await locatorFor(runtime.page, typed.target, typed.xpath ?? "body")).isVisible?.(),
    );
  }
  return false;
}

async function currentPageHostname(runtime: Runtime) {
  const href = await runtime.page.evaluate<string>("window.location.href");
  try {
    return new URL(href).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function hostnameAllowed(hostname: string, domains: string[]) {
  return domains.some((domain) => {
    const normalized = normalizeDomain(domain);
    return hostname === normalized || hostname.endsWith(`.${normalized}`);
  });
}

function normalizeDomain(domain: string) {
  try {
    return new URL(domain).hostname.toLowerCase();
  } catch {
    return domain.trim().toLowerCase().replace(/^\.+|\.+$/g, "");
  }
}

function renderTemplate(value: string, outputs: Record<string, unknown>) {
  return value.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_match, name: string) =>
    String(outputs[name] ?? ""),
  );
}

function executableJavaScript(script: string) {
  return `(() => {\n${script}\n})()`;
}

async function withActionTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | null | undefined,
  message: (timeoutMs: number) => string,
) {
  if (!timeoutMs) return promise;
  return new Promise<T>((resolve, reject) => {
    const handle = setTimeout(() => reject(new Error(message(timeoutMs))), timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(handle);
        resolve(value);
      },
      (error) => {
        clearTimeout(handle);
        reject(error);
      },
    );
  });
}

async function extractListLike(locator: BrowserDriverLocator) {
  const count = (await locator.count?.()) ?? 0;
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await locator.nth?.(index).textContent?.()) ?? "");
  }
  return values;
}

async function extractTable(locator: BrowserDriverLocator) {
  if (locator.evaluate) {
    return locator.evaluate((element) => {
      const table = element instanceof HTMLTableElement ? element : element.closest("table");
      const root = table ?? element;
      return Array.from(root.querySelectorAll("tr")).map((row) =>
        Array.from(row.querySelectorAll("th,td")).map((cell) =>
          cell.textContent?.trim() ?? "",
        ),
      );
    });
  }

  return extractListLike(locator);
}
