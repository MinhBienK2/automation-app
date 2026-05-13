import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledNestedAction,
  CompiledWorkflowGraph,
  ElementLocator,
  ElementTarget,
  RunMode,
  RunState,
  WorkflowSettings,
} from "../../src/types/workflow.js";
import { unsupportedInRunReason } from "../../src/lib/actionCapabilities.js";
import type { AppPaths } from "./database.js";

type CloakBrowserModule = {
  launchContext: (options?: BrowserLaunchOptions) => Promise<BrowserDriverContext>;
  launchPersistentContext: (
    options: BrowserLaunchOptions & { userDataDir: string },
  ) => Promise<BrowserDriverContext>;
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
    url: string | RegExp,
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
    type(text: string, options?: Record<string, unknown>): Promise<void>;
  };
  mouse?: {
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
  evaluate?<Result>(
    pageFunction: (element: Element) => Result | Promise<Result>,
    arg?: unknown,
  ): Promise<Result>;
  hover?(options?: Record<string, unknown>): Promise<void>;
  dblclick?(options?: Record<string, unknown>): Promise<void>;
  check?(options?: Record<string, unknown>): Promise<void>;
  uncheck?(options?: Record<string, unknown>): Promise<void>;
  selectOption?(value: string | string[] | Record<string, string>): Promise<unknown>;
  setInputFiles?(files: string[]): Promise<void>;
  press?(key: string): Promise<void>;
  textContent?(options?: Record<string, unknown>): Promise<string | null>;
  getAttribute?(attribute: string, options?: Record<string, unknown>): Promise<string | null>;
  inputValue?(options?: Record<string, unknown>): Promise<string>;
  count?(): Promise<number>;
  nth?(index: number): BrowserDriverLocator;
  isVisible?(options?: Record<string, unknown>): Promise<boolean>;
  isEnabled?(options?: Record<string, unknown>): Promise<boolean>;
  waitFor?(options?: Record<string, unknown>): Promise<void>;
  dragTo?(target: BrowserDriverLocator, options?: Record<string, unknown>): Promise<void>;
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
};

export type RunnerRunRequest = {
  runId?: string | null;
  graph: CompiledWorkflowGraph;
  settings: WorkflowSettings;
  mode: RunMode;
  targetStepId?: string | null;
  signal?: AbortSignal;
  onProgress?: (state: Partial<RunState>) => void;
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

type EvidenceArtifact = {
  run_id: string;
  node_id: string | null;
  step_number: number | null;
  action_type: string;
  artifact_kind: "screenshot" | "download" | "checkpoint";
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
  private retainedContext: BrowserDriverContext | null = null;

  constructor(options: RunnerOptions) {
    this.appPaths = options.appPaths;
    this.driver = options.driver ?? createCloakBrowserDriver();
    this.sleep = options.sleep ?? sleep;
    this.random = options.random ?? Math.random;
  }

  async run(request: RunnerRunRequest): Promise<RunState> {
    await this.closeRetainedContext();
    const launch = await this.launch(request.settings);
    const state: RunState = {
      status: "running",
      mode: request.mode,
      target_step_id: request.targetStepId ?? null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs: {},
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

    let closeBrowser = request.settings.run_policy.browser_retention === "close" || launch.temporary;

    try {
      await this.applyEnvironment(runtime, request.settings);
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
        if (request.targetStepId === step.node_id) break;
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
      } else {
        this.retainedContext = runtime.context;
      }
    }

    return state;
  }

  async closeRetainedContext() {
    if (!this.retainedContext) return;
    await this.retainedContext.close();
    this.retainedContext = null;
  }

  private async launch(settings: WorkflowSettings) {
    const options = buildLaunchOptions(settings, this.appPaths);
    const profileName = settings.browser_launch.profile_name?.trim();
    const context = profileName
      ? await this.driver.launchPersistent({
          ...options,
          userDataDir: path.join(this.appPaths.browserProfilesDir, sanitizePathSegment(profileName)),
        })
      : await this.driver.launch(options);
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page, temporary: !profileName };
  }

  private async applyEnvironment(_runtime: Runtime, _settings: WorkflowSettings) {}

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
    const unsupportedReason = unsupportedInRunReason(action.type);
    if (unsupportedReason) {
      throw new Error(
        `${action.type} is not supported as an in-run action: ${unsupportedReason}`,
      );
    }
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
        if (action.config.typing_mode === "type" && locator.type) {
          await locator.type(renderTemplate(action.config.text, runtime.outputs), {
            delay: action.config.delay_ms ?? 0,
          });
        } else {
          await locator.fill(renderTemplate(action.config.text, runtime.outputs));
        }
        return;
      }
      case "clear_input":
        await (await this.locatorForAction(runtime, action.config)).fill("");
        return;
      case "click":
        await (await this.locatorForAction(runtime, action.config)).click({
          button: action.config.button ?? undefined,
          clickCount: action.config.click_count ?? undefined,
        });
        if (action.config.post_click_wait_ms) {
          await this.sleep(action.config.post_click_wait_ms, runtime.signal);
        }
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
        await rightClickTarget(await this.locatorForAction(runtime, action.config));
        return;
      case "drag_and_drop":
        await this.executeDragAndDrop(runtime, action);
        return;
      case "scroll":
        await runtime.page.evaluate(
          (payload?: { deltaX: number; deltaY: number }) => {
            const { deltaX, deltaY } = payload ?? { deltaX: 0, deltaY: 0 };
            window.scrollBy({ left: deltaX, top: deltaY, behavior: "instant" });
            window.dispatchEvent(new Event("scroll"));
          },
          {
            deltaX:
              action.config.direction === "left"
                ? -action.config.pixels
                : action.config.direction === "right"
                  ? action.config.pixels
                  : 0,
            deltaY:
              action.config.direction === "up"
                ? -action.config.pixels
                : action.config.direction === "down"
                  ? action.config.pixels
                  : 0,
          },
        );
        return;
      case "select_option":
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
      case "set_checkbox":
        if (action.config.state === "checked") {
          await requireLocatorMethod(
            await this.locatorForAction(runtime, action.config),
            "check",
            action.type,
          )();
        } else {
          await requireLocatorMethod(
            await this.locatorForAction(runtime, action.config),
            "uncheck",
            action.type,
          )();
        }
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
        await runtime.page.keyboard?.press(action.config.key);
        return;
      case "hotkey":
        await runtime.page.keyboard?.press(action.config.keys.join("+"));
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
        await (await this.locatorForAction(runtime, action.config)).fill(runtime.clipboard);
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
          await runtime.page.keyboard?.press("Enter");
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
        if (page) {
          runtime.page = page;
          await runtime.page.bringToFront?.();
        }
        return;
      }
      case "close_tab": {
        const page = runtime.context.pages()[action.config.index ?? runtime.context.pages().length - 1];
        await page?.close?.();
        runtime.page = runtime.context.pages()[0] ?? (await runtime.context.newPage());
        return;
      }
      case "switch_frame":
        throw new Error("switch_frame is not supported as an in-run action: use per-target iframe locators");
      case "accept_dialog":
        this.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
        return;
      case "dismiss_dialog":
        this.registerDialogHandler(runtime, "dismiss");
        return;
      case "set_download_directory":
        throw new Error(
          "set_download_directory is not supported as an in-run action: configure downloads in Workflow Settings before launch",
        );
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
        const visible = await (await locatorFor(runtime.page, action.config.target, action.config.xpath)).isVisible?.();
        if (action.config.state === "visible" && !visible) throw new Error("Element is not visible");
        return;
      }
      case "assert_text": {
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
      case "if_condition":
        await this.executeActions(
          runtime,
          await conditionMatches(runtime, action.config.condition)
            ? action.config.then_steps
            : action.config.else_steps,
        );
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
        const actual = String(runtime.outputs[action.config.name] ?? "");
        if (action.config.match_mode === "equals" && actual !== action.config.value) {
          throw new Error(`Output ${action.config.name} did not equal ${action.config.value}`);
        }
        if (action.config.match_mode === "contains" && !actual.includes(action.config.value)) {
          throw new Error(`Output ${action.config.name} did not contain ${action.config.value}`);
        }
        return;
      }
      case "run_subworkflow":
        runtime.outputs.last_subworkflow_id = action.config.workflow_id;
        return;
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
      case "set_cookie":
        await runtime.context.addCookies?.([
          {
            name: action.config.name,
            value: action.config.value,
            domain: action.config.domain ?? undefined,
            path: action.config.path ?? "/",
          },
        ]);
        runtime.outputs.last_set_cookie = action.config;
        return;
      case "clear_cookies":
        await runtime.context.clearCookies?.(
          action.config.domain ? { domain: action.config.domain } : undefined,
        );
        runtime.outputs.last_clear_cookies = action.config;
        return;
      case "use_profile":
      case "save_session":
      case "load_session":
      case "set_secret":
      case "use_proxy":
      case "set_user_agent":
        runtime.outputs[`last_${action.type}`] = action.config;
        return;
      case "detect_challenge":
        runtime.outputs[action.config.output_name] = false;
        return;
      case "pause_for_human":
      case "checkpoint":
        return;
      case "resume_when_condition":
        await this.executeResumeWhenCondition(runtime, action);
        return;
      case "fallback_selector":
        runtime.outputs[action.config.output_name] = action.config.xpaths[0] ?? null;
        return;
      case "retry_step":
        await this.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, [action.config.step], []);
        return;
      case "execute_js":
        if (action.config.output_name) {
          runtime.outputs[action.config.output_name] = await runtime.page.evaluate(
            executableJavaScript(action.config.script),
          );
        } else {
          await runtime.page.evaluate(executableJavaScript(action.config.script));
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
        await runtime.context.route?.(action.config.url_contains, async (route) =>
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
      wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
      timeout_ms?: number | null;
      retry_interval_ms?: number | null;
    },
    fallbackXpath = "body",
  ) {
    const locator = await locatorFor(runtime.page, config.target, config.xpath ?? fallbackXpath);
    await this.waitForElementReadiness(
      locator,
      config.wait_until ?? null,
      config.timeout_ms,
      runtime.signal,
      config.retry_interval_ms ?? undefined,
    );
    return locator;
  }

  private async waitForElementReadiness(
    locator: BrowserDriverLocator,
    waitUntil: "attached" | "visible" | "enabled" | "clickable" | null,
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

  private async executeResumeWhenCondition(
    runtime: Runtime,
    action: Extract<ActionConfig, { type: "resume_when_condition" }>,
  ) {
    const timeoutMs = action.config.timeout_ms ?? 30_000;
    const startedAt = Date.now();
    while (!(await conditionMatches(runtime, action.config.condition))) {
      this.throwIfCancelled(runtime.signal);
      const elapsed = Date.now() - startedAt;
      if (elapsed >= timeoutMs || timeoutMs <= 1) {
        throw new Error(`Resume condition timed out after ${timeoutMs} ms`);
      }
      await this.sleep(Math.min(100, Math.max(1, timeoutMs - elapsed)), runtime.signal);
    }
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
    return moduleOverride ?? ((await import("cloakbrowser")) as unknown as CloakBrowserModule);
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

async function submitFormTarget(locator: BrowserDriverLocator) {
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

  await locator.click();
}

async function selectRadioTarget(locator: BrowserDriverLocator) {
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

  await locator.click();
}

async function rightClickTarget(locator: BrowserDriverLocator) {
  if (locator.evaluate) {
    await locator.evaluate((element) => {
      const target = element instanceof HTMLElement ? element : element.parentElement;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      const clientX = rect.left + rect.width / 2;
      const clientY = rect.top + rect.height / 2;
      const eventInit = {
        bubbles: true,
        button: 2,
        buttons: 2,
        cancelable: true,
        clientX,
        clientY,
        view: window,
      };
      target.dispatchEvent(new MouseEvent("mousedown", eventInit));
      target.dispatchEvent(new MouseEvent("mouseup", { ...eventInit, buttons: 0 }));
      target.dispatchEvent(new MouseEvent("contextmenu", eventInit));
    });
    return;
  }

  await locator.click({ button: "right" });
}

function buildLaunchOptions(
  settings: WorkflowSettings,
  appPaths: AppPaths,
): BrowserLaunchOptions {
  const proxy = settings.browser_launch.proxy_enabled && settings.browser_launch.proxy_server
    ? {
        server: settings.browser_launch.proxy_server,
        username: settings.browser_launch.proxy_username ?? undefined,
        password: settings.browser_launch.proxy_password ?? undefined,
      }
    : undefined;
  return {
    headless: settings.browser_launch.headless,
    humanize: true,
    proxy,
    contextOptions: {
      acceptDownloads: true,
      downloadsPath: appPaths.downloadsDir,
    },
  };
}

async function locatorFor(
  page: BrowserDriverPage,
  target: unknown,
  xpath?: string | null,
): Promise<BrowserDriverLocator> {
  const typedTarget = isElementTarget(target) ? target : null;
  const root = typedTarget?.iframe
    ? frameRootForTarget(page, typedTarget.iframe)
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
  if (action.type.startsWith("extract") || action.type.startsWith("assert")) return "observer";
  if (action.type === "execute_js" || action.type.includes("storage") || action.type === "set_variable") {
    return "direct_dom";
  }
  if (action.type === "pause_for_human" || action.type === "checkpoint") return "manual";
  if (action.type === "click" && action.config.mode === "force_dom") return "assisted_browser";
  return "browser";
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

function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "default";
}

function resolveEvidenceArtifact(input: {
  evidenceDir: string;
  runId: string;
  kind: "screenshots" | "downloads" | "checkpoints";
  stepNumber: number | null;
  nodeId: string | null;
  requestedName: string | null | undefined;
  fallbackName: string;
  extension: string;
}) {
  const artifactName = safeArtifactName(input.requestedName, input.fallbackName);
  const stepPart = String(input.stepNumber ?? 0).padStart(3, "0");
  const nodePart = slugifyArtifactPart(input.nodeId ?? "workflow");
  const fileName = `${stepPart}-${nodePart}-${artifactName}${safeArtifactExtension(input.extension)}`;
  const runPart = sanitizePathSegment(input.runId);
  const relativePath = path.posix.join("runs", runPart, input.kind, fileName);
  const absolutePath = path.join(input.evidenceDir, relativePath);
  const relativeToEvidence = path.relative(input.evidenceDir, absolutePath);
  if (
    relativeToEvidence.startsWith("..") ||
    path.isAbsolute(relativeToEvidence)
  ) {
    throw new Error("Evidence path resolved outside the app evidence directory");
  }
  return { relativePath, absolutePath };
}

function safeArtifactExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  return /^\.[a-z0-9]{1,12}$/.test(normalized) ? normalized : ".artifact";
}

function safeArtifactName(value: string | null | undefined, fallbackName: string) {
  const raw = value?.trim() || fallbackName;
  if (
    !raw ||
    /^file:/i.test(raw) ||
    path.isAbsolute(raw) ||
    raw.includes("/") ||
    raw.includes("\\") ||
    raw.split(/[\\/]+/).includes("..")
  ) {
    throw new Error("Screenshot path must be a safe artifact name");
  }
  const parsed = path.parse(raw);
  if (parsed.dir || parsed.base === ".." || parsed.name === "..") {
    throw new Error("Screenshot path must be a safe artifact name");
  }
  const slug = slugifyArtifactPart(parsed.name || fallbackName);
  if (!slug) throw new Error("Screenshot path must be a safe artifact name");
  return slug.endsWith(".png") ? slug.slice(0, -4) : slug;
}

function slugifyArtifactPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artifact";
}
