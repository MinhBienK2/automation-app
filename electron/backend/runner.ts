import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type {
  ActionConfig,
  CompiledGraphStep,
  CompiledWorkflowGraph,
  RunMode,
  RunState,
  WorkflowSettings,
} from "../../src/types/workflow.js";
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

export type BrowserDriverLocator = {
  fill(value: string, options?: Record<string, unknown>): Promise<void>;
  type?(value: string, options?: Record<string, unknown>): Promise<void>;
  click(options?: Record<string, unknown>): Promise<void>;
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
  graph: CompiledWorkflowGraph;
  settings: WorkflowSettings;
  mode: RunMode;
  targetStepId?: string | null;
  signal?: AbortSignal;
  onProgress?: (state: Partial<RunState>) => void;
};

type Runtime = {
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  outputs: Record<string, unknown>;
  traces: ActionTrace[];
  clipboard: string;
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
    const runtime: Runtime = {
      context: launch.context,
      page: launch.page,
      outputs: {},
      traces: [],
      clipboard: "",
      signal: request.signal,
    };

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

    let closeBrowser = request.settings.execution.browser_retention === "close" || launch.temporary;

    try {
      await this.applyEnvironment(runtime, request.settings);
      let stepNumber = 0;
      for (const step of request.graph.steps) {
        stepNumber += 1;
        this.throwIfCancelled(runtime.signal);
        state.current_step_id = step.node_id;
        state.current_step_number = stepNumber;
        request.onProgress?.({
          current_step_id: step.node_id,
          current_step_number: stepNumber,
          completed_step_ids: [...state.completed_step_ids],
        });
        await this.executeStep(runtime, step);
        state.completed_step_ids.push(step.node_id);
        request.onProgress?.({
          current_step_id: step.node_id,
          current_step_number: stepNumber,
          completed_step_ids: [...state.completed_step_ids],
        });
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
          action_type: "unknown",
          reason: error instanceof Error ? error.message : String(error),
        };
        await this.captureFailureScreenshot(runtime, state.current_step_id);
      }
    } finally {
      runtime.outputs.__action_traces = runtime.traces;
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
    const profileName = settings.browser.profile_name?.trim();
    const context = profileName
      ? await this.driver.launchPersistent({
          ...options,
          userDataDir: path.join(this.appPaths.browserProfilesDir, sanitizePathSegment(profileName)),
        })
      : await this.driver.launch(options);
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page, temporary: !profileName };
  }

  private async applyEnvironment(runtime: Runtime, settings: WorkflowSettings) {
    if (settings.environment.extra_http_headers.length > 0) {
      const headers = Object.fromEntries(
        settings.environment.extra_http_headers.map((header) => [header.name, header.value]),
      );
      await runtime.context.setExtraHTTPHeaders?.(headers);
    }
    if (settings.environment.permissions.length > 0) {
      await runtime.context.grantPermissions?.(settings.environment.permissions);
    }
    if (settings.environment.cookies.length > 0) {
      await runtime.context.addCookies?.(
        settings.environment.cookies.map((cookie) => ({
          name: cookie.name,
          value: cookie.value,
          domain: cookie.domain ?? undefined,
          path: cookie.path ?? "/",
        })),
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

  private async executeAction(runtime: Runtime, action: ActionConfig): Promise<void> {
    this.throwIfCancelled(runtime.signal);
    switch (action.type) {
      case "navigate":
        await runtime.page.goto(renderTemplate(action.config.url, runtime.outputs), {
          waitUntil: waitUntil(action.config.wait_until),
          timeout: action.config.timeout_ms ?? undefined,
        });
        return;
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
        const locator = locatorFor(runtime.page, action.config.target, action.config.xpath);
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
        await locatorFor(runtime.page, action.config.target, action.config.xpath).fill("");
        return;
      case "click":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).click({
          button: action.config.button ?? undefined,
          clickCount: action.config.click_count ?? undefined,
        });
        if (action.config.post_click_wait_ms) {
          await this.sleep(action.config.post_click_wait_ms, runtime.signal);
        }
        return;
      case "hover":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).hover?.();
        return;
      case "double_click":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).dblclick?.();
        return;
      case "right_click":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).click({
          button: "right",
        });
        return;
      case "drag_and_drop":
        await locatorFor(runtime.page, action.config.source_target, action.config.source_xpath).hover?.();
        await locatorFor(runtime.page, action.config.target_target, action.config.target_xpath).hover?.();
        return;
      case "scroll":
        await runtime.page.mouse?.wheel(
          action.config.direction === "left" ? -action.config.pixels : action.config.direction === "right" ? action.config.pixels : 0,
          action.config.direction === "up" ? -action.config.pixels : action.config.direction === "down" ? action.config.pixels : 0,
        );
        return;
      case "select_option":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).selectOption?.(
          action.config.match_by === "label"
            ? { label: action.config.value }
            : { value: action.config.value },
        );
        return;
      case "set_checkbox":
        if (action.config.state === "checked") {
          await locatorFor(runtime.page, action.config.target, action.config.xpath).check?.();
        } else {
          await locatorFor(runtime.page, action.config.target, action.config.xpath).uncheck?.();
        }
        return;
      case "check":
      case "select_radio":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).check?.();
        return;
      case "uncheck":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).uncheck?.();
        return;
      case "toggle_checkbox":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).click();
        return;
      case "press_key":
        await runtime.page.keyboard?.press(action.config.key);
        return;
      case "hotkey":
        await runtime.page.keyboard?.press(action.config.keys.join("+"));
        return;
      case "type_sequence":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).type?.(
          renderTemplate(action.config.text, runtime.outputs),
          { delay: action.config.delay_ms ?? 0 },
        );
        return;
      case "set_clipboard":
        runtime.clipboard = action.config.text;
        return;
      case "paste_clipboard":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).fill(runtime.clipboard);
        return;
      case "focus_element":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).click();
        return;
      case "blur_element":
        await runtime.page.keyboard?.press("Tab");
        return;
      case "upload_file":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).setInputFiles?.(
          action.config.files,
        );
        return;
      case "submit_form":
        if (action.config.xpath || action.config.target) {
          await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "form").press?.(
            "Enter",
          );
        } else {
          await runtime.page.keyboard?.press("Enter");
        }
        return;
      case "select_custom_option":
        await locatorFor(runtime.page, action.config.trigger_target, action.config.trigger_xpath).click();
        await runtime.page.locator(`text=${action.config.option_text}`).click();
        return;
      case "set_contenteditable":
        await locatorFor(runtime.page, action.config.target, action.config.xpath).fill(
          renderTemplate(action.config.text, runtime.outputs),
        );
        return;
      case "extract_text":
        runtime.outputs[action.config.output_name] =
          (await locatorFor(runtime.page, action.config.target, action.config.xpath).textContent?.()) ?? "";
        return;
      case "extract_attribute":
        runtime.outputs[action.config.output_name] =
          (await locatorFor(runtime.page, action.config.target, action.config.xpath).getAttribute?.(
            action.config.attribute,
          )) ?? "";
        return;
      case "extract_input_value":
        runtime.outputs[action.config.output_name] =
          (await locatorFor(runtime.page, action.config.target, action.config.xpath).inputValue?.()) ?? "";
        return;
      case "extract_table":
      case "extract_list":
        runtime.outputs[action.config.output_name] = await extractListLike(
          locatorFor(runtime.page, action.config.target, action.config.xpath),
        );
        return;
      case "take_screenshot": {
        const screenshotPath = resolveEvidencePath(this.appPaths.screenshotsDir, action.config.path);
        await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
        const buffer = await runtime.page.screenshot?.({ fullPage: action.config.full_page });
        if (buffer) await fs.writeFile(screenshotPath, buffer);
        if (action.config.output_name) runtime.outputs[action.config.output_name] = screenshotPath;
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
        if (action.config.url) await runtime.page.goto(renderTemplate(action.config.url, runtime.outputs));
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
        return;
      case "accept_dialog":
      case "dismiss_dialog":
        return;
      case "set_download_directory":
        runtime.outputs.download_directory = action.config.path;
        return;
      case "wait_for_download":
        runtime.outputs[action.config.output_name] = this.appPaths.downloadsDir;
        return;
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
        const visible = await locatorFor(runtime.page, action.config.target, action.config.xpath).isVisible?.();
        if (action.config.state === "visible" && !visible) throw new Error("Element is not visible");
        return;
      }
      case "assert_text": {
        const text = action.config.xpath || action.config.target
          ? await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body").textContent?.()
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
        );
        return;
      case "repeat_until": {
        const result = await this.executeLoop(
          runtime,
          action.config.steps,
          action.config.max_attempts ?? 100,
          async () => !(await conditionMatches(runtime, action.config.condition)),
        );
        if (
          result === "max_attempts" &&
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
        await this.executeLoop(
          runtime,
          [],
          1,
          async () => !(await conditionMatches(runtime, action.config.condition)),
        );
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
            action.config.script,
          );
        } else {
          await runtime.page.evaluate(action.config.script);
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
      case "set_session_storage":
        runtime.outputs[action.config.key] = action.config.value;
        return;
    }
  }

  private async executeActions(runtime: Runtime, actions: ActionConfig[]) {
    for (const action of actions) {
      this.throwIfCancelled(runtime.signal);
      await this.executeAction(runtime, action);
    }
  }

  private async executeLoopBody(
    runtime: Runtime,
    steps: ActionConfig[],
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
      case "element_attached":
      case "element_enabled":
        await locatorFor(runtime.page, action.config.target, action.config.xpath ?? "body").isVisible?.({
          timeout: action.config.timeout_ms ?? undefined,
        });
        return;
      case "text_visible":
        await runtime.page.locator(`text=${action.config.text ?? ""}`).isVisible?.({
          timeout: action.config.timeout_ms ?? undefined,
        });
        return;
      case "element_hidden":
      case "element_detached":
      case "element_disabled":
        return;
    }
  }

  private async executeRetry(
    runtime: Runtime,
    attempts: number,
    delayMs: number,
    steps: ActionConfig[],
    failedSteps: ActionConfig[],
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
    steps: ActionConfig[],
    maxAttempts: number,
    predicate: () => Promise<boolean>,
  ): Promise<"predicate_false" | "max_attempts" | "break"> {
    let attempts = 0;
    while (await predicate()) {
      if (attempts >= maxAttempts) return "max_attempts";
      attempts += 1;
      const control = await this.executeLoopBody(runtime, steps);
      if (control === "break") return "break";
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

  private async captureFailureScreenshot(runtime: Runtime, stepId: string | null) {
    if (!runtime.page.screenshot) return;
    const screenshotPath = path.join(
      this.appPaths.screenshotsDir,
      `${stepId ?? "workflow"}-failure.png`,
    );
    await fs.mkdir(path.dirname(screenshotPath), { recursive: true });
    const buffer = await runtime.page.screenshot({ fullPage: true });
    await fs.writeFile(screenshotPath, buffer);
    runtime.outputs.failure_screenshot = screenshotPath;
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

function buildLaunchOptions(
  settings: WorkflowSettings,
  appPaths: AppPaths,
): BrowserLaunchOptions {
  const proxy = settings.browser.proxy_enabled && settings.browser.proxy_server
    ? {
        server: settings.browser.proxy_server,
        username: settings.browser.proxy_username ?? undefined,
        password: settings.browser.proxy_password ?? undefined,
      }
    : undefined;
  const headers = Object.fromEntries(
    settings.environment.extra_http_headers.map((header) => [header.name, header.value]),
  );
  return {
    headless: settings.browser.headless,
    humanize: true,
    proxy,
    userAgent: settings.browser.user_agent ?? undefined,
    viewport:
      settings.browser.viewport_width && settings.browser.viewport_height
        ? {
            width: settings.browser.viewport_width,
            height: settings.browser.viewport_height,
          }
        : undefined,
    locale: settings.environment.locale ?? undefined,
    timezone: settings.environment.timezone ?? undefined,
    contextOptions: {
      isMobile: settings.browser.mobile,
      hasTouch: settings.browser.touch,
      geolocation: settings.environment.geolocation ?? undefined,
      permissions: settings.environment.permissions,
      extraHTTPHeaders: headers,
      acceptDownloads: true,
      downloadsPath: settings.environment.download_directory ?? appPaths.downloadsDir,
    },
  };
}

function locatorFor(page: BrowserDriverPage, target: unknown, xpath: string) {
  return page.locator(selectorFromTarget(target, xpath));
}

function selectorFromTarget(target: unknown, xpath: string) {
  if (target && typeof target === "object" && "locators" in target) {
    const locators = (target as { locators?: Array<{ kind: string; value: string }> }).locators;
    const locator = locators?.[0];
    if (locator?.kind === "css") return locator.value;
    if (locator?.kind === "text") return `text=${locator.value}`;
    if (locator?.kind === "test_id") return `[data-testid="${locator.value}"]`;
    if (locator?.kind === "xpath") return locator.value;
  }
  return xpath.startsWith("xpath=") ? xpath : xpath;
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
    const href = await runtime.page.evaluate<string>("() => window.location.href");
    return href.includes(typed.value ?? "");
  }
  if (typed.kind === "text_visible") {
    return Boolean(await runtime.page.locator(`text=${typed.text ?? ""}`).isVisible?.());
  }
  if (typed.kind === "element_visible") {
    return Boolean(
      await locatorFor(runtime.page, typed.target, typed.xpath ?? "body").isVisible?.(),
    );
  }
  return false;
}

async function currentPageHostname(runtime: Runtime) {
  const href = await runtime.page.evaluate<string>("() => window.location.href");
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

async function extractListLike(locator: BrowserDriverLocator) {
  const count = (await locator.count?.()) ?? 0;
  const values: string[] = [];
  for (let index = 0; index < count; index += 1) {
    values.push((await locator.nth?.(index).textContent?.()) ?? "");
  }
  return values;
}

function resolveEvidencePath(root: string, requestedPath: string) {
  if (path.isAbsolute(requestedPath)) return requestedPath;
  if (requestedPath.startsWith("file:")) return fileURLToPath(requestedPath);
  return path.join(root, requestedPath);
}

function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "default";
}
