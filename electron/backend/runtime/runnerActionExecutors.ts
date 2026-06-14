import fs from "node:fs/promises";
import path from "node:path";
import type {
  ActionConfig,
  CompiledNestedAction,
  CompiledStepMetadata,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverContext,
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import {
  createActionExecutorMap,
  type ActionExecutorMap,
} from "../actions/execution.js";
import type { AppPaths } from "../persistence/database.js";
import { resolveEvidenceArtifact } from "../evidence/artifacts.js";
import { isPlainRecord } from "../shared/records.js";
import type { ActionTrace } from "./actionTrace.js";
import {
  currentPageHostname,
  hostnameAllowed,
} from "./domainPolicy.js";
import {
  blurElementTarget,
  rightClickTarget,
  selectRadioTarget,
  submitFormTarget,
} from "./interactionActions.js";
import {
  evaluateMathInObject,
  flattenObject,
  parseVariableValue,
  renderTemplate,
  setVariables,
  writeVariableValue,
} from "./variables.js";
import {
  assertElementState,
  assertRuntimeEnumValue,
  executableJavaScript,
  extractListLike,
  extractTable,
  requireLocatorMethod,
  setWebStorage,
  waitUntil,
  weightedRandomChoice,
  withActionTimeout,
} from "./runtimeHelpers.js";
import type { RuntimeElementRef } from "./targetResolver.js";

export type RunnerActionRuntime = {
  runId: string;
  settings: WorkflowSettings;
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  domainPolicy: { allowed_domains: string[] } | null;
  outputs: Record<string, unknown>;
  elementRefs: Map<string, RuntimeElementRef>;
  traces: ActionTrace[];
  evidence: Array<{
    run_id: string;
    node_id: string | null;
    step_number: number | null;
    action_type: string;
    artifact_kind: "screenshot" | "download";
    path: string;
    created_at: string;
  }>;
  clipboard: string;
  currentStepNumber: number | null;
  currentStepId: string | null;
  currentStepName: string | null;
  currentActionType: string | null;
  currentActionSummary: string | null;
  currentStepMetadata: CompiledStepMetadata | null;
  liveState: RunState;
  onProgress?: (state: Partial<RunState>) => void;
  signal?: AbortSignal;
};

export type RunnerActionExecutorDependencies = {
  appPaths: AppPaths;
  random: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  enforceNavigationPolicy: (runtime: RunnerActionRuntime, url: string) => Promise<void>;
  executeWait: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "wait" }>,
  ) => Promise<void>;
  locatorForAction: (
    runtime: RunnerActionRuntime,
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
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "find_element" }>,
  ) => Promise<void>;
  executeDragAndDrop: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  ) => Promise<void>;
  executeScroll: (
    runtime: RunnerActionRuntime,
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
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "paste_clipboard" }>,
  ) => Promise<void>;
  locatorForCustomSelectTrigger: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "select_custom_option" }>,
  ) => Promise<BrowserDriverLocator>;
  registerDialogHandler: (
    runtime: RunnerActionRuntime,
    behavior: "accept" | "dismiss",
    promptText?: string,
  ) => void;
  waitForDownload: (
    runtime: RunnerActionRuntime,
    outputName: string,
    timeoutMs: number | null | undefined,
  ) => Promise<string>;
  executeActions: (
    runtime: RunnerActionRuntime,
    actions: CompiledNestedAction[],
  ) => Promise<void>;
  executeLoopBody: (
    runtime: RunnerActionRuntime,
    steps: CompiledNestedAction[],
  ) => Promise<"completed" | "break" | "continue">;
  executeRetry: (
    runtime: RunnerActionRuntime,
    attempts: number,
    delayMs: number,
    steps: CompiledNestedAction[],
    failedSteps: CompiledNestedAction[],
  ) => Promise<void>;
  executeLoop: (
    runtime: RunnerActionRuntime,
    steps: CompiledNestedAction[],
    maxAttempts: number,
    predicate: () => Promise<boolean>,
    timeoutMs?: number | null,
  ) => Promise<"predicate_false" | "max_attempts" | "timeout" | "break">;
  conditionMatches: (runtime: RunnerActionRuntime, condition: unknown) => Promise<boolean>;
  recordEvidence: (
    runtime: RunnerActionRuntime,
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

export function createRunnerActionExecutors(
  runtime: RunnerActionRuntime,
  deps: RunnerActionExecutorDependencies,
): ActionExecutorMap {
  return createActionExecutorMap({
    navigate: async (action) => {
      const url = renderTemplate(action.config.url, runtime.outputs);
      await deps.enforceNavigationPolicy(runtime, url);
      await runtime.page.goto(url, {
        waitUntil: waitUntil(action.config.wait_until),
        timeout: action.config.timeout_ms ?? undefined,
      });
    },
    wait: async (action) => {
      await deps.executeWait(runtime, action);
    },
    random_wait: async (action) => {
      const waitMs =
        action.config.min_ms +
        Math.floor(deps.random() * (action.config.max_ms - action.config.min_ms + 1));
      await deps.sleep(waitMs, runtime.signal);
    },
    input_text: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      if (action.config.clear_before_input) await locator.fill("");
      await locator.fill(renderTemplate(action.config.text, runtime.outputs));
    },
    clear_input: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill("");
    },
    click: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    find_element: async (action) => {
      await deps.executeFindElement(runtime, action);
    },
    hover: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "hover",
        action.type,
      )();
    },
    double_click: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "dblclick",
        action.type,
      )();
    },
    right_click: async (action) => {
      await rightClickTarget(
        runtime.page,
        await deps.locatorForAction(runtime, action.config),
        deps.sleep,
        deps.random,
        action.config.timeout_ms,
        runtime.signal,
      );
    },
    drag_and_drop: async (action) => {
      await deps.executeDragAndDrop(runtime, action);
    },
    scroll: async (action) => {
      await deps.executeScroll(runtime, action);
    },
    select_option: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_by,
        ["label", "value"],
        "Match by must be label or value",
      );
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
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
        await deps.locatorForAction(runtime, action.config),
        "check",
        action.type,
      )();
    },
    select_radio: async (action) => {
      await selectRadioTarget(await deps.locatorForAction(runtime, action.config));
    },
    uncheck: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "uncheck",
        action.type,
      )();
    },
    toggle_checkbox: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    press_key: async (action) => {
      await deps.pressKeyHuman(runtime.page, action.config.key, runtime.signal);
    },
    hotkey: async (action) => {
      await deps.pressHotkeyHuman(runtime.page, action.config.keys, runtime.signal);
    },
    type_sequence: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
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
      await deps.executePasteClipboard(runtime, action);
    },
    focus_element: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    blur_element: async (action) => {
      await blurElementTarget(await deps.locatorForAction(runtime, action.config));
    },
    upload_file: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "setInputFiles",
        action.type,
      )(
        action.config.files,
      );
    },
    submit_form: async (action) => {
      if (action.config.xpath || action.config.target || action.config.target_ref?.trim()) {
        await submitFormTarget(await deps.locatorForAction(runtime, action.config, "form"));
      } else {
        await deps.pressKeyHuman(runtime.page, "Enter", runtime.signal);
      }
    },
    select_custom_option: async (action) => {
      await (await deps.locatorForCustomSelectTrigger(runtime, action)).click();
      await runtime.page.locator(`text=${action.config.option_text}`).click();
    },
    set_contenteditable: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill(
        renderTemplate(action.config.text, runtime.outputs),
      );
    },
    extract_text: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          await deps.locatorForAction(runtime, action.config),
          "textContent",
          action.type,
        )()) ?? "";
    },
    extract_attribute: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          await deps.locatorForAction(runtime, action.config),
          "getAttribute",
          action.type,
        )(
          action.config.attribute,
        )) ?? "";
    },
    extract_input_value: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          await deps.locatorForAction(runtime, action.config),
          "inputValue",
          action.type,
        )()) ?? "";
    },
    extract_list: async (action) => {
      runtime.outputs[action.config.output_name] = await extractListLike(
        await deps.locatorForAction(runtime, action.config),
      );
    },
    extract_regex_matches: async (action) => {
      const source = outputValueToText(runtime.outputs[action.config.source_name]);
      const regex = regexFromActionConfig(action.config.pattern, action.config.flags);
      const matches = Array.from(source.matchAll(regex), (match) => match[0]).filter(Boolean);
      const existing = action.config.append
        ? outputValueToList(runtime.outputs[action.config.output_name])
        : [];
      const nextValues = [...existing, ...matches];
      runtime.outputs[action.config.output_name] = action.config.dedupe
        ? dedupeStrings(nextValues)
        : nextValues;
    },
    extract_table: async (action) => {
      runtime.outputs[action.config.output_name] = await extractTable(
        await deps.locatorForAction(runtime, action.config),
      );
    },
    take_screenshot: async (action) => {
      const artifact = resolveEvidenceArtifact({
        evidenceDir: deps.appPaths.evidenceDir,
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
      deps.recordEvidence(runtime, {
        actionType: action.type,
        artifactKind: "screenshot",
        relativePath: artifact.relativePath,
      });
      if (action.config.output_name) runtime.outputs[action.config.output_name] = artifact.relativePath;
    },
    write_text_file: async (action) => {
      const text = outputValueToText(
        runtime.outputs[action.config.source_name],
        action.config.separator ?? "\n",
      );
      const content = action.config.include_trailing_newline === false || !text
        ? text
        : `${text}\n`;
      const artifact = resolveEvidenceArtifact({
        evidenceDir: deps.appPaths.evidenceDir,
        runId: runtime.runId,
        kind: "downloads",
        stepNumber: runtime.currentStepNumber,
        nodeId: runtime.currentStepId,
        requestedName: action.config.path,
        fallbackName: "text-output",
        extension: ".txt",
      });
      await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
      await fs.writeFile(artifact.absolutePath, content, "utf8");
      deps.recordEvidence(runtime, {
        actionType: action.type,
        artifactKind: "download",
        relativePath: artifact.relativePath,
      });
      runtime.outputs[action.config.output_name] = artifact.relativePath;
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
        await deps.enforceNavigationPolicy(runtime, url);
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
      deps.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
    },
    dismiss_dialog: async () => {
      deps.registerDialogHandler(runtime, "dismiss");
    },
    wait_for_download: async (action) => {
      const artifactPath = await deps.waitForDownload(runtime, action.config.output_name, action.config.timeout_ms);
      runtime.outputs[action.config.output_name] = artifactPath;
    },
    set_variable: async (action) => {
      setVariables(runtime.outputs, action.config);
    },
    set_json_variables: async (action) => {
      const parsed = JSON.parse(renderTemplate(action.config.json, runtime.outputs));
      if (!isPlainRecord(parsed)) throw new Error("JSON variables must be an object");
      const evaluated = evaluateMathInObject(parsed);
      flattenObject(runtime.outputs, "", evaluated);
    },
    update_variable: async (action) => {
      const { name, operation, value, value_type } = action.config;
      if (!name) return;

      if (operation === "push") {
        const array = Array.isArray(runtime.outputs[name])
          ? (runtime.outputs[name] as unknown[])
          : [];
        const parsedValue = parseVariableValue(
          value_type ?? "text",
          value ?? "",
          runtime.outputs,
        );
        const newArray = [...array, parsedValue];
        writeVariableValue(runtime.outputs, name, newArray);
      } else if (operation === "merge") {
        const existing = runtime.outputs[name];
        const targetObj = isPlainRecord(existing) ? existing : {};
        const rendered = renderTemplate(value ?? "{}", runtime.outputs);
        const parsedValue = JSON.parse(rendered);
        if (!isPlainRecord(parsedValue)) {
          throw new Error("Merged value must be a JSON object");
        }
        const newObj = { ...targetObj, ...parsedValue };
        const evaluated = evaluateMathInObject(newObj);
        writeVariableValue(runtime.outputs, name, evaluated);
      }
    },
    assert_element: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      await assertElementState(locator, action.config.state, action.config.timeout_ms);
    },
    assert_text: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_mode,
        ["contains", "equals"],
        "Match mode must be contains or equals",
      );
      const text = await (await deps.locatorForAction(runtime, action.config, "body")).textContent?.();
      if (action.config.match_mode === "equals" && text !== action.config.text) {
        throw new Error(`Text did not equal ${action.config.text}`);
      }
      if (action.config.match_mode === "contains" && !String(text ?? "").includes(action.config.text)) {
        throw new Error(`Text did not contain ${action.config.text}`);
      }
    },
    graph_noop: async () => undefined,
    if_condition: async (action) => {
      await deps.executeActions(
        runtime,
        await deps.conditionMatches(runtime, action.config.condition)
          ? action.config.then_steps
          : action.config.else_steps,
      );
    },
    router_condition: async (action) => {
      for (const caseValue of action.config.cases) {
        let matched = false;
        try {
          matched = await deps.conditionMatches(runtime, caseValue.condition);
        } catch (error) {
          throw new Error(
            `Router ${runtime.currentStepId ?? "unknown"} case "${caseValue.label}" condition failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        if (matched) {
          await deps.executeActions(runtime, caseValue.steps);
          return;
        }
      }
      await deps.executeActions(runtime, action.config.default_steps);
    },
    random_choice: async (action) => {
      const choice = weightedRandomChoice(action.config.choices, deps.random);
      if (action.config.output_name?.trim()) {
        runtime.outputs[action.config.output_name] = choice.id;
      }
      await deps.executeActions(runtime, choice.steps);
    },
    repeat_times: async (action) => {
      for (let index = 0; index < action.config.times; index += 1) {
        const control = await deps.executeLoopBody(runtime, action.config.steps);
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
        const control = await deps.executeLoopBody(runtime, action.config.steps);
        if (control === "break") break;
      }
    },
    retry_block: async (action) => {
      await deps.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, action.config.steps, action.config.failed_steps ?? []);
    },
    switch_condition: async (action) => {
      const value = String(runtime.outputs[action.config.expression] ?? action.config.expression);
      const branch = action.config.cases.find((candidate) => candidate.value === value);
      await deps.executeActions(runtime, branch?.steps ?? action.config.default_steps);
    },
    while_loop: async (action) => {
      await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        () => deps.conditionMatches(runtime, action.config.condition),
        action.config.timeout_ms ?? null,
      );
    },
    repeat_until: async (action) => {
      const result = await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        async () => !(await deps.conditionMatches(runtime, action.config.condition)),
        action.config.timeout_ms ?? null,
      );
      if (
        (result === "max_attempts" || result === "timeout") &&
        !(await deps.conditionMatches(runtime, action.config.condition))
      ) {
        await deps.executeActions(runtime, action.config.timeout_steps);
      }
    },
    try_catch: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.try_steps);
        await deps.executeActions(runtime, action.config.success_steps);
      } catch (error) {
        if (action.config.error_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.error_steps);
      } finally {
        await deps.executeActions(runtime, action.config.finally_steps);
      }
    },
    fallback_block: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.primary_steps);
      } catch (error) {
        if (action.config.fallback_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.fallback_steps);
      }
    },
    break_loop: async () => {
      throw deps.createLoopControl("break");
    },
    continue_loop: async () => {
      throw deps.createLoopControl("continue");
    },
    stop_workflow: async (action) => {
      throw deps.createRunnerStop(
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
      const hostname = await currentPageHostname(runtime.page);
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
      const domain = action.config.domain?.trim() || await currentPageHostname(runtime.page);
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

function outputValueToText(value: unknown, separator = "\n"): string {
  if (Array.isArray(value)) {
    return value.map((item) => outputValueToText(item, separator)).join(separator);
  }
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function outputValueToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => outputValueToText(item));
  if (value == null || value === "") return [];
  return [outputValueToText(value)];
}

function regexFromActionConfig(pattern: string, flags: string | null | undefined) {
  const normalizedFlags = normalizeRegexFlags(flags);
  try {
    return new RegExp(pattern, normalizedFlags);
  } catch {
    throw new Error("Regex pattern is invalid");
  }
}

function normalizeRegexFlags(flags: string | null | undefined) {
  const raw = flags?.trim() || "g";
  const uniqueFlags = Array.from(new Set(raw.split("")));
  if (!uniqueFlags.includes("g")) uniqueFlags.push("g");
  return uniqueFlags.join("");
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }
  return deduped;
}
