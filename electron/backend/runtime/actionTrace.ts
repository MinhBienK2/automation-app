import type {
  ActionConfig,
  ActionType,
  CompiledStepMetadata,
  ElementLocator,
  ElementTarget,
  RunState,
} from "../../../src/types/workflow.js";
import type { EvidenceCategory } from "../evidence/model.js";

export type ActionTrace = {
  node_id: string;
  label: string;
  action_type: string;
  action_summary?: string | null;
  subflow_id?: string | null;
  subflow_name?: string | null;
  subflow_step_number?: number | null;
  subflow_step_count?: number | null;
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
  output_values?: Record<string, unknown>;
  evidence_summary?: Array<{
    artifact_kind: "screenshot" | "download";
    path: string;
  }>;
  evidence_categories?: EvidenceCategory[];
  audit_tags?: string[];
  reason?: string;
};

type RunnerActionCapability = "cloak_native" | "custom_human" | "direct_dom";

type RuntimeDiagnosticSource = {
  currentStepId: string | null;
  currentStepName: string | null;
  currentStepMetadata: CompiledStepMetadata | null;
  currentActionSummary: string | null;
  liveState: Pick<RunState, "current_step_id">;
  failedStepInfo?: {
    step_id: string;
    step_name: string;
    action_type: string;
    action_summary: string | null;
    metadata: CompiledStepMetadata | null;
    parent_step_id?: string | null;
    parent_step_ids?: string[] | null;
  } | null;
};

type TraceEffectSource = {
  outputs: Record<string, unknown>;
  evidence: Array<{ artifact_kind: "screenshot" | "download"; path: string }>;
};

type TraceSink = {
  traces: ActionTrace[];
};

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
  scroll: "custom_human",
  paste_clipboard: "custom_human",
  open_new_tab: "cloak_native",
  switch_tab: "cloak_native",
  close_tab: "cloak_native",
  wait_for_download: "cloak_native",
  take_screenshot: "cloak_native",
  execute_js: "direct_dom",
  get_current_url: "direct_dom",
  set_local_storage: "direct_dom",
  set_session_storage: "direct_dom",
  clear_cookies: "direct_dom",
  set_cookie: "direct_dom",
  set_extra_headers: "direct_dom",
  set_geolocation: "direct_dom",
  set_viewport: "direct_dom",
};

export function runtimeErrorDiagnostics(
  runtime: RuntimeDiagnosticSource,
): NonNullable<RunState["error"]>["diagnostics"] {
  const failedInfo = runtime.failedStepInfo;
  const compiledStepId = failedInfo
    ? failedInfo.step_id
    : (runtime.currentStepId ?? runtime.liveState.current_step_id ?? null);
  const stepParts = compiledStepParts(compiledStepId);
  const labelPath = labelPathFor(failedInfo ? failedInfo.step_name : runtime.currentStepName);
  const subflow = failedInfo
    ? (failedInfo.metadata?.subflow ?? null)
    : (runtime.currentStepMetadata?.subflow ?? null);
  const parentStepId = failedInfo?.parent_step_id ?? stepParts.parentStepId ?? null;
  return {
    compiled_step_id: compiledStepId,
    ...(parentStepId ? { parent_step_id: parentStepId } : {}),
    ...(failedInfo?.parent_step_ids ? { parent_step_ids: failedInfo.parent_step_ids } : {}),
    ...(stepParts.subflowNodeId ? { subflow_node_id: stepParts.subflowNodeId } : {}),
    ...(subflow ? {
      subflow_id: subflow.id,
      subflow_name: subflow.name,
      subflow_step_number: subflow.step_number,
      subflow_step_count: subflow.step_count,
    } : {}),
    ...(labelPath.length ? { label_path: labelPath } : {}),
    action_summary: failedInfo ? failedInfo.action_summary : runtime.currentActionSummary,
  };
}

export function compiledStepParts(stepId: string | null | undefined) {
  if (!stepId) return { parentStepId: null, subflowNodeId: null };
  const separatorIndex = stepId.indexOf("::");
  if (separatorIndex < 0) return { parentStepId: null, subflowNodeId: null };
  return {
    parentStepId: stepId.slice(0, separatorIndex) || null,
    subflowNodeId: stepId.slice(separatorIndex + 2) || null,
  };
}

export function labelPathFor(stepName: string | null | undefined) {
  return (stepName ?? "")
    .split(/\s*>\s*/)
    .map((part) => part.trim())
    .filter(Boolean);
}

export function actionSummaryTraceField(action: ActionConfig): Pick<ActionTrace, "action_summary"> {
  const actionSummary = actionConfigSummary(action);
  return actionSummary ? { action_summary: actionSummary } : {};
}

export function subflowTraceFields(
  metadata: CompiledStepMetadata | null | undefined,
): Pick<ActionTrace, "subflow_id" | "subflow_name" | "subflow_step_number" | "subflow_step_count"> {
  const subflow = metadata?.subflow ?? null;
  if (!subflow) return {};
  return {
    subflow_id: subflow.id,
    subflow_name: subflow.name,
    subflow_step_number: subflow.step_number,
    subflow_step_count: subflow.step_count,
  };
}

export function actionConfigSummary(action: ActionConfig): string | null {
  switch (action.type) {
    case "navigate":
      return compactSummary(`URL ${action.config.url}`);
    case "wait":
      return waitActionSummary(action.config);
    case "random_wait":
      return `Duration ${action.config.min_ms}-${action.config.max_ms} ms`;
    case "click":
    case "double_click":
    case "right_click":
    case "hover":
    case "focus_element":
    case "blur_element":
    case "clear_input":
    case "check":
    case "uncheck":
    case "toggle_checkbox":
    case "select_radio":
    case "paste_clipboard":
    case "submit_form":
      return elementTargetSummary(action.config);
    case "input_text":
    case "set_contenteditable":
    case "type_sequence":
      return elementTargetSummary(action.config);
    case "find_element":
    case "extract_text":
    case "extract_input_value":
    case "extract_table":
    case "extract_list":
    case "count_elements":
      return withSuffix(elementTargetSummary(action.config), `Output ${action.config.output_name}`);
    case "extract_regex_matches":
      return compactSummary(
        `Output ${action.config.source_name} -> ${action.config.output_name} | Pattern ${action.config.pattern}`,
      );
    case "extract_attribute":
      return withSuffix(
        elementTargetSummary(action.config),
        `Attribute ${action.config.attribute} -> ${action.config.output_name}`,
      );
    case "assert_element":
      return withSuffix(elementTargetSummary(action.config), `State ${action.config.state}`);
    case "assert_text":
      return withSuffix(
        elementTargetSummary(action.config),
        `Text ${action.config.match_mode} ${action.config.text}`,
      );
    case "assert_output":
      return compactSummary(
        `Output ${action.config.name} ${action.config.match_mode} ${action.config.value}`,
      );
    case "select_option":
      return compactSummary(
        [elementTargetSummary(action.config), `${action.config.match_by} ${action.config.value}`]
          .filter(Boolean)
          .join(" | "),
      );
    case "upload_file":
      return withSuffix(elementTargetSummary(action.config), `${action.config.files.length} file(s)`);
    case "select_custom_option":
      return withSuffix(
        elementTargetSummary({
          target: action.config.trigger_target,
          xpath: action.config.trigger_xpath,
        }),
        `Option ${action.config.option_text}`,
      );
    case "drag_and_drop": {
      const source = elementTargetSummary({
        target: action.config.source_target,
        xpath: action.config.source_xpath,
      });
      const target = elementTargetSummary({
        target: action.config.target_target,
        xpath: action.config.target_xpath,
      });
      return compactSummary([source && `Source ${source}`, target && `Target ${target}`]
        .filter(Boolean)
        .join(" | "));
    }
    case "scroll":
      return withSuffix(elementTargetSummary(action.config), action.config.mode ?? "page");
    case "press_key":
      return `Key ${action.config.key}`;
    case "hotkey":
      return `Keys ${action.config.keys.join("+")}`;
    case "open_new_tab":
      return action.config.url ? compactSummary(`URL ${action.config.url}`) : "New tab";
    case "switch_tab":
      return `Tab index ${action.config.index}`;
    case "close_tab":
      return `Tab index ${action.config.index ?? "current"}`;
    case "wait_for_request":
    case "wait_for_response":
      return compactSummary(`URL contains ${action.config.url_contains}`);
    case "set_variable":
      return action.config.variables?.length
        ? `${action.config.variables.length} variable(s)`
        : action.config.name
          ? `Variable ${action.config.name}`
          : null;
    case "set_json_variables":
      return "JSON variables";
    case "transform_variable":
      return `Output ${action.config.source_name} -> ${action.config.target_name}`;
    case "domain_allowlist":
      return compactSummary(`Domains ${action.config.domains.join(", ")}`);
    case "take_screenshot":
      return action.config.output_name
        ? `Output ${action.config.output_name}`
        : compactSummary(action.config.path);
    case "write_text_file":
      return compactSummary(
        `Output ${action.config.source_name} -> ${action.config.output_name} | Path ${action.config.path}`,
      );
    case "wait_for_download":
      return `Output ${action.config.output_name}`;
    case "execute_js":
      return action.config.output_name ? `Output ${action.config.output_name}` : "Script";
    case "get_current_url":
      return "System.current_url";
    default:
      return null;
  }
}

function waitActionSummary(
  config: Extract<ActionConfig, { type: "wait" }>["config"],
) {
  switch (config.condition) {
    case "duration":
      return `Duration ${config.duration_ms ?? 1000} ms`;
    case "url_contains":
      return compactSummary(`URL contains ${config.url ?? ""}`);
    case "text_visible":
      return compactSummary(`Text ${config.text ?? ""}`);
    case "page_load":
      return "Page load";
    case "element_visible":
    case "element_hidden":
    case "element_attached":
    case "element_detached":
    case "element_enabled":
    case "element_disabled":
      return withSuffix(elementTargetSummary(config), config.condition.replaceAll("_", " "));
    default:
      return config.condition;
  }
}

function elementTargetSummary(config: {
  target?: ElementTarget | null;
  xpath?: string | null;
  target_ref?: string | null;
}) {
  const targetRef = config.target_ref?.trim();
  if (targetRef) return compactSummary(`Target ref ${targetRef}`);
  const locator = config.target?.locators?.[0];
  if (locator) return locatorSummary(locator);
  const xpath = config.xpath?.trim();
  if (xpath) return compactSummary(`XPath ${xpath}`);
  return null;
}

function locatorSummary(locator: ElementLocator) {
  switch (locator.kind) {
    case "test_id":
      return compactSummary(`Test id ${locator.value}`);
    case "role":
      return compactSummary(`Role ${locator.role ?? locator.value}`);
    case "label":
      return compactSummary(`Label ${locator.value}`);
    case "placeholder":
      return compactSummary(`Placeholder ${locator.value}`);
    case "text":
      return compactSummary(`Text ${locator.value}`);
    case "css":
      return compactSummary(`CSS ${locator.value}`);
    case "xpath":
      return compactSummary(`XPath ${locator.value}`);
    case "attribute":
      return compactSummary(
        locator.attribute ? `Attribute ${locator.attribute}=${locator.value}` : `Attribute ${locator.value}`,
      );
    default:
      return compactSummary(`${locator.kind} ${locator.value}`);
  }
}

function withSuffix(primary: string | null, suffix: string | null | undefined) {
  const compactSuffix = suffix?.trim();
  if (primary && compactSuffix) return compactSummary(`${primary} | ${compactSuffix}`);
  return primary ?? (compactSuffix ? compactSummary(compactSuffix) : null);
}

function compactSummary(value: string, maxLength = 160) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact || null;
  return `${compact.slice(0, maxLength - 3)}...`;
}

export function pushActionTrace(
  runtime: TraceSink,
  trace: Omit<ActionTrace, "trace_sequence"> & { trace_sequence?: number },
) {
  const lastTrace = runtime.traces[runtime.traces.length - 1];
  const lastSequence = lastTrace ? (lastTrace.trace_sequence ?? 0) : -1;
  const sequence = trace.trace_sequence ?? (lastSequence + 1);

  runtime.traces.push({
    ...trace,
    trace_sequence: sequence,
  });

  const maxTraces = 1000;
  if (runtime.traces.length > maxTraces) {
    runtime.traces.shift();
  }
}

export function snapshotOutputs(outputs: Record<string, unknown>) {
  return new Map(Object.entries(outputs));
}

export function summarizeActionEffects(
  runtime: TraceEffectSource,
  outputSnapshot: Map<string, unknown>,
  evidenceStartIndex: number,
): Pick<ActionTrace, "output_summary" | "evidence_summary" | "output_values"> {
  const output_summary = summarizeOutputChanges(outputSnapshot, runtime.outputs);
  const evidence_summary = runtime.evidence
    .slice(evidenceStartIndex)
    .map((artifact) => ({
      artifact_kind: artifact.artifact_kind,
      path: artifact.path,
    }));
  const output_values: Record<string, unknown> = {};
  if (output_summary) {
    for (const key of [...output_summary.added_keys, ...output_summary.changed_keys]) {
      output_values[key] = runtime.outputs[key];
    }
  }
  return {
    ...(output_summary ? { output_summary } : {}),
    ...(Object.keys(output_values).length > 0 ? { output_values } : {}),
    ...(evidence_summary.length > 0 ? { evidence_summary } : {}),
  };
}

export function summarizeOutputChanges(
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

export function actionTraceMode(action: ActionConfig): ActionTrace["mode"] {
  if (action.type === "graph_noop" || action.type === "router_condition") return "manual";
  if (action.type === "write_text_file") return "observer";
  if (action.type === "find_element") return "observer";
  if (action.type.startsWith("extract") || action.type.startsWith("assert")) return "observer";
  if (runnerCapabilityForAction(action) === "direct_dom" || action.type === "set_variable") {
    return "direct_dom";
  }
  if (runnerCapabilityForAction(action) === "custom_human") return "assisted_browser";
  return "browser";
}

export function actionEvidenceModel(
  action: ActionConfig,
): Pick<ActionTrace, "evidence_categories" | "audit_tags"> {
  if (action.type === "execute_js") {
    return {
      evidence_categories: ["operator_input", "page_observation", "sensitive_redacted"],
      audit_tags: ["direct_dom_script", "requires_review"],
    };
  }
  if (action.type === "find_element" || action.type.startsWith("extract") || action.type.startsWith("assert")) {
    return { evidence_categories: ["page_observation"] };
  }
  if (
    action.type === "take_screenshot" ||
    action.type === "write_text_file" ||
    action.type === "wait_for_download"
  ) {
    return { evidence_categories: ["generated_output"] };
  }
  if (action.type === "set_variable" || action.type === "set_json_variables") {
    return { evidence_categories: ["operator_input"] };
  }
  return { evidence_categories: ["action_trace"] };
}

export function runnerCapabilityForAction(action: ActionConfig): RunnerActionCapability | null {
  if (action.type === "scroll") {
    return "custom_human";
  }
  return runnerActionCapabilities[action.type as ActionType] ?? null;
}
