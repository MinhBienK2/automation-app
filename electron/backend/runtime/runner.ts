import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
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
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../persistence/database.js";
import {
  BrowserSessionManager,
  browserIdentityEvidence,
  retainedProfileKey,
  type BrowserDriver,
  type BrowserDriverContext,
  type BrowserDriverFrameLocator,
  type BrowserDriverLocator,
  type BrowserDriverPage,
  type RetainedSession,
} from "../browser/sessionManager.js";
import {
  createActionExecutorMap,
  executeRegisteredAction,
  type ActionExecutorMap,
} from "../actions/execution.js";
import {
  resolveEvidenceArtifact,
} from "../evidence/artifacts.js";
import { finalizeEvidenceOutputs, type EvidenceCategory } from "../evidence/model.js";

export {
  createCloakBrowserDriver,
  type BrowserDriver,
  type BrowserDriverContext,
  type BrowserDriverFrameLocator,
  type BrowserDriverLocator,
  type BrowserDriverPage,
  type BrowserLaunchOptions,
} from "../browser/sessionManager.js";

type RunnerOptions = {
  appPaths: AppPaths;
  driver?: BrowserDriver;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
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
  parent_node_id?: string | null;
  trace_sequence?: number;
  status: "success" | "failed" | "stopped";
  mode: "browser" | "assisted_browser" | "direct_dom" | "observer" | "manual";
  started_at: string;
  finished_at: string;
  output_summary?: {
    added_keys: string[];
    changed_keys: string[];
    removed_keys: string[];
  };
  evidence_summary?: Array<{
    artifact_kind: EvidenceArtifact["artifact_kind"];
    path: string;
  }>;
  evidence_categories?: EvidenceCategory[];
  audit_tags?: string[];
  reason?: string;
};

type RunnerActionCapability = "cloak_native" | "custom_human" | "direct_dom";

type ScrollViewport = {
  width: number;
  height: number;
};

type ScrollBox = {
  x?: number;
  y?: number;
  width: number;
  height: number;
};

type HumanScrollProfile = {
  closeMinChunk: number;
  closeMaxChunk: number;
  minChunk: number;
  maxChunk: number;
  farDistance: number;
  gesturePauseMinMs: number;
  gesturePauseMaxMs: number;
  farGesturePauseMinMs: number;
  farGesturePauseMaxMs: number;
  pulsePauseMinMs: number;
  pulsePauseMaxMs: number;
};

const PAGE_SCROLL_TARGET_CHUNK_PX = 240;
const PAGE_SCROLL_MAX_STEPS = 18;
const PAGE_SCROLL_PULSE_PAUSE_MIN_MS = 18;
const PAGE_SCROLL_PULSE_PAUSE_MAX_MS = 55;
const PAGE_SCROLL_GESTURE_PAUSE_MIN_MS = 170;
const PAGE_SCROLL_GESTURE_PAUSE_MAX_MS = 310;

const SCROLL_TARGET_DEFAULT_TIMEOUT_MS = 60000;

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
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  private readonly random: () => number;
  private readonly sessionManager: BrowserSessionManager;

  constructor(options: RunnerOptions) {
    this.appPaths = options.appPaths;
    this.sleep = options.sleep ?? sleep;
    this.random = options.random ?? Math.random;
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
    const state: RunState = {
      status: "running",
      mode: request.mode,
      target_step_id: request.targetStepId ?? null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs: {},
      retained_session: this.sessionManager.getRetainedSessionState(retainedWorkflowId, retainedProfileName),
      error: null,
    };
    const runtime: Runtime = {
      runId: request.runId ?? randomUUID(),
      settings: request.settings,
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
    });
  }

  private async executeAction(runtime: Runtime, action: ActionConfig): Promise<void> {
    this.throwIfCancelled(runtime.signal);
    await executeRegisteredAction(this.runnerActionExecutors(runtime), action);
  }

  private runnerActionExecutors(runtime: Runtime): ActionExecutorMap {
    return createActionExecutorMap({
      navigate: async (action) => {
        const url = renderTemplate(action.config.url, runtime.outputs);
        await this.enforceNavigationPolicy(runtime, url);
        await runtime.page.goto(url, {
          waitUntil: waitUntil(action.config.wait_until),
          timeout: action.config.timeout_ms ?? undefined,
        });
      },
      wait: async (action) => {
        await this.executeWait(runtime, action);
      },
      random_wait: async (action) => {
        const waitMs =
          action.config.min_ms +
          Math.floor(this.random() * (action.config.max_ms - action.config.min_ms + 1));
        await this.sleep(waitMs, runtime.signal);
      },
      input_text: async (action) => {
        const locator = await this.locatorForAction(runtime, action.config);
        if (action.config.clear_before_input) await locator.fill("");
        await locator.fill(renderTemplate(action.config.text, runtime.outputs));
      },
      clear_input: async (action) => {
        await (await this.locatorForAction(runtime, action.config)).fill("");
      },
      click: async (action) => {
        await (await this.locatorForAction(runtime, action.config)).click();
      },
      hover: async (action) => {
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "hover",
          action.type,
        )();
      },
      double_click: async (action) => {
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "dblclick",
          action.type,
        )();
      },
      right_click: async (action) => {
        await rightClickTarget(
          runtime.page,
          await this.locatorForAction(runtime, action.config),
          this.sleep,
          this.random,
          action.config.timeout_ms,
          runtime.signal,
        );
      },
      drag_and_drop: async (action) => {
        await this.executeDragAndDrop(runtime, action);
      },
      scroll: async (action) => {
        await this.executeScroll(runtime, action);
      },
      select_option: async (action) => {
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
      },
      check: async (action) => {
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "check",
          action.type,
        )();
      },
      select_radio: async (action) => {
        await selectRadioTarget(await this.locatorForAction(runtime, action.config));
      },
      uncheck: async (action) => {
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "uncheck",
          action.type,
        )();
      },
      toggle_checkbox: async (action) => {
        await (await this.locatorForAction(runtime, action.config)).click();
      },
      press_key: async (action) => {
        await this.pressKeyHuman(runtime.page, action.config.key, runtime.signal);
      },
      hotkey: async (action) => {
        await this.pressHotkeyHuman(runtime.page, action.config.keys, runtime.signal);
      },
      type_sequence: async (action) => {
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "type",
          action.type,
        )(
          renderTemplate(action.config.text, runtime.outputs),
          { delay: action.config.delay_ms ?? 0 },
        );
      },
      set_clipboard: async (action) => {
        runtime.clipboard = action.config.text;
      },
      paste_clipboard: async (action) => {
        await this.executePasteClipboard(runtime, action);
      },
      focus_element: async (action) => {
        await (await this.locatorForAction(runtime, action.config)).click();
      },
      blur_element: async () => {
        await runtime.page.keyboard?.press("Tab");
      },
      upload_file: async (action) => {
        await requireLocatorMethod(
          await this.locatorForAction(runtime, action.config),
          "setInputFiles",
          action.type,
        )(
          action.config.files,
        );
      },
      submit_form: async (action) => {
        if (action.config.xpath || action.config.target) {
          await submitFormTarget(await this.locatorForAction(runtime, action.config, "form"));
        } else {
          await this.pressKeyHuman(runtime.page, "Enter", runtime.signal);
        }
      },
      select_custom_option: async (action) => {
        await (await locatorFor(runtime.page, action.config.trigger_target, action.config.trigger_xpath)).click();
        await runtime.page.locator(`text=${action.config.option_text}`).click();
      },
      set_contenteditable: async (action) => {
        await (await this.locatorForAction(runtime, action.config)).fill(
          renderTemplate(action.config.text, runtime.outputs),
        );
      },
      extract_text: async (action) => {
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            await locatorFor(runtime.page, action.config.target, action.config.xpath),
            "textContent",
            action.type,
          )()) ?? "";
      },
      extract_attribute: async (action) => {
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            await locatorFor(runtime.page, action.config.target, action.config.xpath),
            "getAttribute",
            action.type,
          )(
            action.config.attribute,
          )) ?? "";
      },
      extract_input_value: async (action) => {
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            await locatorFor(runtime.page, action.config.target, action.config.xpath),
            "inputValue",
            action.type,
          )()) ?? "";
      },
      extract_list: async (action) => {
        runtime.outputs[action.config.output_name] = await extractListLike(
          await locatorFor(runtime.page, action.config.target, action.config.xpath),
        );
      },
      extract_table: async (action) => {
        runtime.outputs[action.config.output_name] = await extractTable(
          await locatorFor(runtime.page, action.config.target, action.config.xpath),
        );
      },
      take_screenshot: async (action) => {
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
      },
      go_back: async () => {
        await runtime.page.goBack?.();
      },
      go_forward: async () => {
        await runtime.page.goForward?.();
      },
      reload: async () => {
        await runtime.page.reload?.();
      },
      open_new_tab: async (action) => {
        runtime.page = await runtime.context.newPage();
        if (action.config.url) {
          const url = renderTemplate(action.config.url, runtime.outputs);
          await this.enforceNavigationPolicy(runtime, url);
          await runtime.page.goto(url);
        }
      },
      switch_tab: async (action) => {
        const page = runtime.context.pages()[action.config.index];
        if (!page) throw new Error(`Tab index ${action.config.index} does not exist`);
        runtime.page = page;
        await runtime.page.bringToFront?.();
      },
      close_tab: async (action) => {
        const pageIndex = action.config.index ?? runtime.context.pages().length - 1;
        const page = runtime.context.pages()[pageIndex];
        if (!page) throw new Error(`Tab index ${pageIndex} does not exist`);
        await page.close?.();
        runtime.page = runtime.context.pages()[0] ?? (await runtime.context.newPage());
      },
      accept_dialog: async (action) => {
        this.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
      },
      dismiss_dialog: async () => {
        this.registerDialogHandler(runtime, "dismiss");
      },
      wait_for_download: async (action) => {
        const artifactPath = await this.waitForDownload(runtime, action.config.output_name, action.config.timeout_ms);
        runtime.outputs[action.config.output_name] = artifactPath;
      },
      set_variable: async (action) => {
        setVariables(runtime.outputs, action.config);
      },
      set_json_variables: async (action) => {
        const parsed = JSON.parse(renderTemplate(action.config.json, runtime.outputs));
        if (!isPlainRecord(parsed)) throw new Error("JSON variables must be an object");
        flattenObject(runtime.outputs, "", parsed);
      },
      assert_element: async (action) => {
        const locator = await locatorFor(runtime.page, action.config.target, action.config.xpath);
        await assertElementState(locator, action.config.state, action.config.timeout_ms);
      },
      assert_text: async (action) => {
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
      },
      graph_noop: async () => undefined,
      if_condition: async (action) => {
        await this.executeActions(
          runtime,
          await conditionMatches(runtime, action.config.condition)
            ? action.config.then_steps
            : action.config.else_steps,
        );
      },
      router_condition: async (action) => {
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
      },
      repeat_times: async (action) => {
        for (let index = 0; index < action.config.times; index += 1) {
          const control = await this.executeLoopBody(runtime, action.config.steps);
          if (control === "break") break;
        }
      },
      repeat_for_each: async (action) => {
        const items = action.config.array_variable
          ? (runtime.outputs[action.config.array_variable] as unknown[])
          : action.config.items;
        if (!Array.isArray(items)) throw new Error("repeat_for_each source is not an array");
        for (const item of items) {
          writeVariableValue(runtime.outputs, action.config.item_name, item);
          const control = await this.executeLoopBody(runtime, action.config.steps);
          if (control === "break") break;
        }
      },
      retry_block: async (action) => {
        await this.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, action.config.steps, action.config.failed_steps ?? []);
      },
      switch_condition: async (action) => {
        const value = String(runtime.outputs[action.config.expression] ?? action.config.expression);
        const branch = action.config.cases.find((candidate) => candidate.value === value);
        await this.executeActions(runtime, branch?.steps ?? action.config.default_steps);
      },
      while_loop: async (action) => {
        await this.executeLoop(
          runtime,
          action.config.steps,
          action.config.max_attempts ?? 100,
          () => conditionMatches(runtime, action.config.condition),
          action.config.timeout_ms ?? null,
        );
      },
      repeat_until: async (action) => {
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
      },
      try_catch: async (action) => {
        try {
          await this.executeActions(runtime, action.config.try_steps);
          await this.executeActions(runtime, action.config.success_steps);
        } catch (error) {
          if (action.config.error_steps.length === 0) throw error;
          await this.executeActions(runtime, action.config.error_steps);
        } finally {
          await this.executeActions(runtime, action.config.finally_steps);
        }
      },
      fallback_block: async (action) => {
        try {
          await this.executeActions(runtime, action.config.primary_steps);
        } catch (error) {
          if (action.config.fallback_steps.length === 0) throw error;
          await this.executeActions(runtime, action.config.fallback_steps);
        }
      },
      break_loop: async () => {
        throw new LoopControl("break");
      },
      continue_loop: async () => {
        throw new LoopControl("continue");
      },
      stop_workflow: async (action) => {
        throw new RunnerStop(
          action.config.status === "success" ? "success" : "failure",
          action.config.reason ?? "Workflow stopped",
          Boolean(action.config.close_browser),
        );
      },
      transform_variable: async (action) => {
        runtime.outputs[action.config.target_name] = renderTemplate(action.config.expression, runtime.outputs);
      },
      assert_output: async (action) => {
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
      },
      domain_allowlist: async (action) => {
        const hostname = await currentPageHostname(runtime);
        if (!hostname || !hostnameAllowed(hostname, action.config.domains)) {
          throw new Error(
            `Current domain ${hostname ?? "unknown"} is not in the allowlist`,
          );
        }
        runtime.outputs.domain_allowlist = action.config.domains;
      },
      set_viewport: async (action) => {
        await runtime.page.setViewportSize?.({
          width: action.config.width,
          height: action.config.height,
        });
        runtime.outputs.last_set_viewport = action.config;
      },
      set_geolocation: async (action) => {
        await runtime.context.setGeolocation?.(action.config);
        runtime.outputs.last_set_geolocation = action.config;
      },
      set_extra_headers: async (action) => {
        await runtime.context.setExtraHTTPHeaders?.(
          Object.fromEntries(
            action.config.headers.map((header) => [header.name, header.value]),
          ),
        );
        runtime.outputs.last_set_extra_headers = action.config;
      },
      grant_permission: async (action) => {
        await runtime.context.grantPermissions?.(
          action.config.permissions,
          action.config.origin ? { origin: action.config.origin } : undefined,
        );
        runtime.outputs.last_grant_permission = action.config;
      },
      set_cookie: async (action) => {
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
      },
      clear_cookies: async (action) => {
        await runtime.context.clearCookies?.(
          action.config.domain ? { domain: action.config.domain } : undefined,
        );
        runtime.outputs.last_clear_cookies = action.config;
      },
      execute_js: async (action) => {
        if (runtime.settings.run_policy.execute_js_enabled === false) {
          throw new Error("Execute JavaScript is disabled by Run Policy");
        }
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
      },
      wait_for_request: async (action) => {
        runtime.outputs.last_request_url = (
          await runtime.page.waitForRequest?.(
            (request) => request.url().includes(action.config.url_contains),
            { timeout: action.config.timeout_ms ?? undefined },
          )
        )?.url();
      },
      wait_for_response: async (action) => {
        const response = await runtime.page.waitForResponse?.(
          (candidate) =>
            candidate.url().includes(action.config.url_contains) &&
            (!action.config.status || candidate.status() === action.config.status),
          { timeout: action.config.timeout_ms ?? undefined },
        );
        runtime.outputs.last_response_url = response?.url();
      },
      block_request: async (action) => {
        for (const pattern of action.config.url_patterns) {
          await runtime.context.route?.(pattern, async (route) => route.abort());
        }
      },
      mock_response: async (action) => {
        await runtime.context.route?.(
          (url) => url.toString().includes(action.config.url_contains),
          async (route) =>
            route.fulfill({
              status: action.config.status,
              body: action.config.body,
              contentType: action.config.content_type ?? "text/plain",
            }),
        );
      },
      set_local_storage: async (action) => {
        await setWebStorage(runtime.page, "local", action.config.key, action.config.value);
        runtime.outputs[action.config.key] = action.config.value;
      },
      set_session_storage: async (action) => {
        await setWebStorage(runtime.page, "session", action.config.key, action.config.value);
        runtime.outputs[action.config.key] = action.config.value;
      },
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
        stateStepId: runtime.liveState.current_step_id,
      };
      runtime.currentStepId = action.graph_node_id;
      runtime.currentActionType = action.type;
      runtime.liveState.current_step_id = action.graph_node_id;
      try {
        this.reportProgress(runtime);
        await this.executeNestedAction(runtime, action, previous.runtimeStepId);
        if (!runtime.liveState.completed_step_ids.includes(action.graph_node_id)) {
          runtime.liveState.completed_step_ids.push(action.graph_node_id);
        }
        this.reportProgress(runtime);
      } finally {
        runtime.currentStepId = previous.runtimeStepId;
        runtime.currentActionType = previous.runtimeActionType;
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
    await humanScrollLocatorIntoView(
      runtime.page,
      locator,
      action.config.timeout_ms,
      this.sleep,
      this.random,
      runtime.signal,
      runtime.settings.browser_launch.human_preset,
    );
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
      return finalizeEvidenceOutputs({ ...pageOutputs, ...runtime.outputs });
    } catch {
      return finalizeEvidenceOutputs(runtime.outputs);
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
    const steps = decisivePageScrollSteps(distance);
    let remainingX = deltaX;
    let remainingY = deltaY;
    for (let remainingSteps = steps; remainingSteps > 0; remainingSteps -= 1) {
      throwIfAborted(signal);
      const chunkX = nextScrollChunk(remainingX, remainingSteps, random);
      const chunkY = nextScrollChunk(remainingY, remainingSteps, random);
      await humanScrollGesture(
        page,
        chunkX,
        chunkY,
        sleepFn,
        random,
        signal,
        {
          pulsePauseMinMs: PAGE_SCROLL_PULSE_PAUSE_MIN_MS,
          pulsePauseMaxMs: PAGE_SCROLL_PULSE_PAUSE_MAX_MS,
        },
      );
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

async function humanScrollLocatorIntoView(
  page: BrowserDriverPage,
  locator: BrowserDriverLocator,
  timeoutMs: number | null | undefined,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal?: AbortSignal,
  preset?: string | null,
) {
  if (!locator.boundingBox) {
    throw new Error("Scroll To Element requires driver support for locator.boundingBox");
  }
  const profile = humanScrollProfile(preset);
  const timeoutBudgetMs = timeoutMs ?? SCROLL_TARGET_DEFAULT_TIMEOUT_MS;
  const maxAttempts = Math.max(20, Math.min(600, Math.ceil(timeoutBudgetMs / 70)));
  const startedAt = Date.now();
  let lastDistance = Number.POSITIVE_INFINITY;
  let stalledAttempts = 0;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    throwIfAborted(signal);
    if (Date.now() - startedAt > timeoutBudgetMs) {
      throw new Error(`Scroll target did not enter the viewport within ${timeoutBudgetMs} ms`);
    }

    const viewport = await viewportSizeFor(page);
    const box = await locator.boundingBox();
    if (!box) {
      await sleepFn(humanScrollPauseMs(profile, random, profile.farDistance), signal);
      continue;
    }

    const plan = scrollPlanForBox(box, viewport);
    if (plan.done) return;

    if (plan.distance >= lastDistance - 2) {
      stalledAttempts += 1;
    } else {
      stalledAttempts = 0;
    }
    lastDistance = plan.distance;
    if (stalledAttempts >= 5) {
      throw new Error("Scroll target did not move closer to the viewport");
    }

    const chunk = humanTargetScrollChunk(plan, profile, random);
    await humanScrollGesture(
      page,
      chunk.deltaX,
      chunk.deltaY,
      sleepFn,
      random,
      signal,
      {
        pulsePauseMinMs: profile.pulsePauseMinMs,
        pulsePauseMaxMs: profile.pulsePauseMaxMs,
      },
    );

    await sleepFn(humanScrollPauseMs(profile, random, plan.distance), signal);
  }

  throw new Error("Scroll target did not enter the viewport before max attempts");
}

async function viewportSizeFor(page: BrowserDriverPage): Promise<ScrollViewport> {
  try {
    const viewport = await page.evaluate<Partial<ScrollViewport>>(() => ({
      width: window.innerWidth || document.documentElement.clientWidth || 1280,
      height: window.innerHeight || document.documentElement.clientHeight || 720,
    }));
    const width = typeof viewport?.width === "number" && viewport.width > 0 ? viewport.width : 1280;
    const height = typeof viewport?.height === "number" && viewport.height > 0 ? viewport.height : 720;
    return { width, height };
  } catch {
    return { width: 1280, height: 720 };
  }
}

function scrollPlanForBox(box: ScrollBox, viewport: ScrollViewport) {
  const x = box.x ?? 0;
  const y = box.y ?? 0;
  const marginX = Math.max(16, Math.round(viewport.width * 0.06));
  const marginY = Math.max(16, Math.round(viewport.height * 0.08));
  const targetLeft = marginX;
  const targetRight = viewport.width - marginX;
  const targetTop = marginY;
  const targetBottom = viewport.height - marginY;
  const visibleWidth = Math.max(0, Math.min(x + box.width, viewport.width) - Math.max(x, 0));
  const visibleHeight = Math.max(0, Math.min(y + box.height, viewport.height) - Math.max(y, 0));
  const visibleRatio = (visibleWidth * visibleHeight) / Math.max(1, box.width * box.height);
  if (visibleRatio >= 0.9) {
    return { done: true as const, deltaX: 0, deltaY: 0, distance: 0 };
  }

  let deltaX = 0;
  let deltaY = 0;
  if (x < targetLeft) {
    deltaX = x - targetLeft;
  } else if (x + box.width > targetRight) {
    deltaX = x + box.width - targetRight;
  }
  if (y < targetTop) {
    deltaY = y - targetTop;
  } else if (y + box.height > targetBottom) {
    deltaY = y + box.height - targetBottom;
  }

  return {
    done: false as const,
    deltaX,
    deltaY,
    distance: Math.max(Math.abs(deltaX), Math.abs(deltaY)),
  };
}

function humanTargetScrollChunk(
  plan: { deltaX: number; deltaY: number; distance: number },
  profile: HumanScrollProfile,
  random: () => number,
) {
  const axisDistance = Math.max(Math.abs(plan.deltaX), Math.abs(plan.deltaY));
  const magnitude = decisiveTargetScrollChunk(axisDistance, profile, random);
  const scale = axisDistance > 0 ? magnitude / axisDistance : 0;
  return {
    deltaX: Math.round(Math.sign(plan.deltaX) * Math.abs(plan.deltaX) * scale),
    deltaY: Math.round(Math.sign(plan.deltaY) * Math.abs(plan.deltaY) * scale),
  };
}

function humanScrollProfile(preset?: string | null): HumanScrollProfile {
  if (preset === "careful") {
    return {
      closeMinChunk: 90,
      closeMaxChunk: 170,
      minChunk: 150,
      maxChunk: 260,
      farDistance: 1000,
      gesturePauseMinMs: 140,
      gesturePauseMaxMs: 220,
      farGesturePauseMinMs: 210,
      farGesturePauseMaxMs: 360,
      pulsePauseMinMs: 22,
      pulsePauseMaxMs: 58,
    };
  }
  return {
    closeMinChunk: 110,
    closeMaxChunk: 200,
    minChunk: 190,
    maxChunk: 320,
    farDistance: 1200,
    gesturePauseMinMs: 130,
    gesturePauseMaxMs: 210,
    farGesturePauseMinMs: 200,
    farGesturePauseMaxMs: 340,
    pulsePauseMinMs: 18,
    pulsePauseMaxMs: 55,
  };
}

function humanScrollPauseMs(profile: HumanScrollProfile, random: () => number, distance: number) {
  const distanceScale = clampRatio(distance / profile.farDistance);
  const pauseMinMs = interpolate(profile.gesturePauseMinMs, profile.farGesturePauseMinMs, distanceScale);
  const pauseMaxMs = interpolate(profile.gesturePauseMaxMs, profile.farGesturePauseMaxMs, distanceScale);
  return pauseMinMs + Math.floor(random() * (pauseMaxMs - pauseMinMs));
}

async function humanScrollGesture(
  page: BrowserDriverPage,
  deltaX: number,
  deltaY: number,
  sleepFn: (ms: number, signal?: AbortSignal) => Promise<void>,
  random: () => number,
  signal: AbortSignal | undefined,
  timing: { pulsePauseMinMs: number; pulsePauseMaxMs: number },
) {
  const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
  const pulseCount = scrollGesturePulseCount(distance, random);
  const pulsesX = scrollGesturePulses(deltaX, pulseCount, random);
  const pulsesY = scrollGesturePulses(deltaY, pulseCount, random);

  for (let index = 0; index < pulseCount; index += 1) {
    throwIfAborted(signal);
    await wheelOrScrollBy(page, pulsesX[index] ?? 0, pulsesY[index] ?? 0);
    if (index < pulseCount - 1) {
      await sleepFn(scrollPulsePauseMs(timing, random), signal);
    }
  }
}

async function wheelOrScrollBy(page: BrowserDriverPage, deltaX: number, deltaY: number) {
  if (page.mouse?.wheel) {
    await page.mouse.wheel(deltaX, deltaY);
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

async function nativePointerLocatorIntoView(
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

  throw new Error("pointer action requires driver support for locator scroll into view");
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
  await nativePointerLocatorIntoView(locator, timeoutMs);
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

function decisivePageScrollSteps(distance: number) {
  if (distance <= 0) return 0;
  return Math.max(1, Math.min(PAGE_SCROLL_MAX_STEPS, Math.ceil(distance / PAGE_SCROLL_TARGET_CHUNK_PX)));
}

function decisiveTargetScrollChunk(distance: number, profile: HumanScrollProfile, random: () => number) {
  if (distance <= 0) return 0;
  const distanceScale = clampRatio(distance / profile.farDistance);
  const minChunk = interpolate(profile.closeMinChunk, profile.minChunk, distanceScale);
  const maxChunk = interpolate(profile.closeMaxChunk, profile.maxChunk, distanceScale);
  if (distance <= maxChunk) return distance;

  const preferredChunk = minChunk + Math.floor(random() * (maxChunk - minChunk));
  const remainingSteps = Math.max(1, Math.ceil(distance / preferredChunk));
  const chunk = Math.abs(nextScrollChunk(distance, remainingSteps, random));
  return Math.max(minChunk, Math.min(maxChunk, chunk));
}

function scrollGesturePulseCount(distance: number, random: () => number) {
  if (distance <= 0) return 1;
  if (distance < 120) return 2;
  if (distance < 260) return random() > 0.75 ? 4 : 3;
  return random() > 0.65 ? 5 : 4;
}

function scrollGesturePulses(total: number, pulseCount: number, random: () => number) {
  const weights = scrollGestureWeights(pulseCount);
  const pulses: number[] = [];
  let remaining = total;
  let remainingWeight = weights.reduce((sum, weight) => sum + weight, 0);

  for (let index = 0; index < pulseCount; index += 1) {
    if (index === pulseCount - 1) {
      pulses.push(remaining);
      break;
    }

    const share = weights[index] / remainingWeight;
    const base = remaining * share;
    const jitter = Math.abs(base) * 0.18 * (random() - 0.5);
    let pulse = Math.round(base + jitter);
    if (pulse === 0 && remaining !== 0) pulse = Math.sign(remaining);
    if (Math.sign(pulse) !== Math.sign(remaining)) pulse = Math.sign(remaining);

    pulses.push(pulse);
    remaining -= pulse;
    remainingWeight -= weights[index];
  }

  return pulses;
}

function scrollGestureWeights(pulseCount: number) {
  if (pulseCount <= 2) return [0.46, 0.54];
  if (pulseCount === 3) return [0.24, 0.42, 0.34];
  if (pulseCount === 4) return [0.16, 0.28, 0.34, 0.22];
  return [0.12, 0.21, 0.28, 0.24, 0.15];
}

function scrollPulsePauseMs(
  timing: { pulsePauseMinMs: number; pulsePauseMaxMs: number },
  random: () => number,
) {
  return timing.pulsePauseMinMs + Math.floor(random() * (timing.pulsePauseMaxMs - timing.pulsePauseMinMs));
}

function clampRatio(value: number) {
  return Math.max(0, Math.min(1, value));
}

function interpolate(from: number, to: number, ratio: number) {
  return Math.round(from + (to - from) * ratio);
}

function scrollPauseMs(random: () => number) {
  return (
    PAGE_SCROLL_GESTURE_PAUSE_MIN_MS +
    Math.floor(random() * (PAGE_SCROLL_GESTURE_PAUSE_MAX_MS - PAGE_SCROLL_GESTURE_PAUSE_MIN_MS))
  );
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

function pushActionTrace(
  runtime: Runtime,
  trace: Omit<ActionTrace, "trace_sequence"> & { trace_sequence?: number },
) {
  runtime.traces.push({
    ...trace,
    trace_sequence: trace.trace_sequence ?? runtime.traces.length,
  });
}

function snapshotOutputs(outputs: Record<string, unknown>) {
  return new Map(Object.entries(outputs));
}

function summarizeActionEffects(
  runtime: Runtime,
  outputSnapshot: Map<string, unknown>,
  evidenceStartIndex: number,
): Pick<ActionTrace, "output_summary" | "evidence_summary"> {
  const output_summary = summarizeOutputChanges(outputSnapshot, runtime.outputs);
  const evidence_summary = runtime.evidence
    .slice(evidenceStartIndex)
    .map((artifact) => ({
      artifact_kind: artifact.artifact_kind,
      path: artifact.path,
    }));
  return {
    ...(output_summary ? { output_summary } : {}),
    ...(evidence_summary.length > 0 ? { evidence_summary } : {}),
  };
}

function summarizeOutputChanges(
  before: Map<string, unknown>,
  after: Record<string, unknown>,
): ActionTrace["output_summary"] | undefined {
  const added_keys: string[] = [];
  const changed_keys: string[] = [];
  const removed_keys: string[] = [];
  for (const [key, value] of Object.entries(after)) {
    if (!before.has(key)) {
      added_keys.push(key);
    } else if (!Object.is(before.get(key), value)) {
      changed_keys.push(key);
    }
  }
  for (const key of before.keys()) {
    if (!(key in after)) removed_keys.push(key);
  }
  if (
    added_keys.length === 0 &&
    changed_keys.length === 0 &&
    removed_keys.length === 0
  ) {
    return undefined;
  }
  return { added_keys, changed_keys, removed_keys };
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

function actionEvidenceModel(
  action: ActionConfig,
): Pick<ActionTrace, "evidence_categories" | "audit_tags"> {
  if (action.type === "execute_js") {
    return {
      evidence_categories: ["operator_input", "page_observation", "sensitive_redacted"],
      audit_tags: ["direct_dom_script", "requires_review"],
    };
  }
  if (action.type.startsWith("extract") || action.type.startsWith("assert")) {
    return { evidence_categories: ["page_observation"] };
  }
  if (action.type === "take_screenshot" || action.type === "wait_for_download") {
    return { evidence_categories: ["generated_output"] };
  }
  if (action.type === "set_variable" || action.type === "set_json_variables") {
    return { evidence_categories: ["operator_input"] };
  }
  return { evidence_categories: ["action_trace"] };
}

function runnerCapabilityForAction(action: ActionConfig): RunnerActionCapability | null {
  if (action.type === "scroll") {
    return "custom_human";
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
  if (!condition || typeof condition !== "object" || !("kind" in condition)) {
    throw new Error("Condition kind is required");
  }
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
  throw new Error(`Unsupported condition kind: ${typed.kind || "unknown"}`);
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
