import type {
  ActionConfig,
  ElementTarget,
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
} from "../../../types/workflow";

export type RecordingStepFilter =
  | "all"
  | "included"
  | "excluded"
  | "warnings"
  | "needs_attention";

export type EditableRecordingValueField =
  | "url"
  | "text"
  | "select_value"
  | "scroll_pixels"
  | "upload_files"
  | "clipboard_text"
  | null;

export type RecordingStepBadge = {
  label: string;
  tone: "neutral" | "muted" | "active" | "success" | "warning" | "danger";
};

export type RecordingDraftSummary = {
  totalSteps: number;
  includedSteps: number;
  excludedSteps: number;
  warningCount: number;
  needsAttentionCount: number;
  redactedMissingCount: number;
  uploadRequiredCount: number;
  weakLocatorCount: number;
};

export type RecordingSaveBlocker = {
  message: string;
  stepId?: string;
};

export function summarizeRecordingDraft(
  draft: RecordingWorkflowDraft,
): RecordingDraftSummary {
  const includedSteps = draft.steps.filter((step) => step.included);
  const redactedMissingCount = includedSteps.filter(isRedactedInputStep).length;
  const uploadRequiredCount = includedSteps.filter(isUploadPathMissing).length;
  const weakLocatorCount = includedSteps.filter(isWeakLocatorStep).length;

  return {
    totalSteps: draft.steps.length,
    includedSteps: includedSteps.length,
    excludedSteps: draft.steps.length - includedSteps.length,
    warningCount: draft.warnings.length +
      draft.steps.reduce((count, step) => count + step.warnings.length, 0),
    needsAttentionCount: draft.steps.filter(recordingStepNeedsAttention).length,
    redactedMissingCount,
    uploadRequiredCount,
    weakLocatorCount,
  };
}

export function filterRecordingSteps(
  steps: ReviewedRecordingStep[],
  filter: RecordingStepFilter,
) {
  switch (filter) {
    case "included":
      return steps.filter((step) => step.included);
    case "excluded":
      return steps.filter((step) => !step.included);
    case "warnings":
      return steps.filter((step) => step.warnings.length > 0);
    case "needs_attention":
      return steps.filter(recordingStepNeedsAttention);
    case "all":
    default:
      return steps;
  }
}

export function recordingStepNeedsAttention(step: ReviewedRecordingStep) {
  if (!step.included) return false;
  return isRedactedInputStep(step) || isUploadPathMissing(step) || isWeakLocatorStep(step) ||
    step.warnings.some((warning) => warning.severity === "error");
}

export function isRedactedInputStep(step: ReviewedRecordingStep) {
  if (!step.included) return false;
  if (step.action.type !== "input_text" && step.action.type !== "set_contenteditable") {
    return false;
  }
  if (getTextActionValue(step.action).trim() !== "") return false;
  return step.warnings.some((warning) => isSensitiveWarning(warning.code, warning.message));
}

export function isUploadPathMissing(step: ReviewedRecordingStep) {
  return step.included &&
    step.action.type === "upload_file" &&
    step.action.config.files.every((filePath) => filePath.trim() === "");
}

export function getRecordingStepBadges(step: ReviewedRecordingStep): RecordingStepBadge[] {
  const badges: RecordingStepBadge[] = [
    step.included
      ? { label: "Included", tone: "active" }
      : { label: "Excluded", tone: "muted" },
  ];

  if (isRedactedInputStep(step)) {
    badges.push({ label: "Redacted value", tone: "warning" });
  }
  if (isUploadPathMissing(step)) {
    badges.push({ label: "Upload required", tone: "warning" });
  }
  if (isWeakLocatorStep(step)) {
    badges.push({ label: "Weak locator", tone: "warning" });
  } else if (step.locator_confidence) {
    badges.push({
      label: `${capitalize(step.locator_confidence)} locator`,
      tone: step.locator_confidence === "high" ? "success" : "neutral",
    });
  }
  if (step.warnings.some((warning) => warning.severity === "error")) {
    badges.push({ label: "Error", tone: "danger" });
  } else if (
    step.warnings.length > 0 &&
    !isRedactedInputStep(step) &&
    !isUploadPathMissing(step) &&
    !isWeakLocatorStep(step)
  ) {
    badges.push({ label: "Warning", tone: "warning" });
  }

  return badges;
}

export function getRecordingSaveBlockers({
  draft,
  workflowName,
}: {
  draft: RecordingWorkflowDraft | null;
  workflowName: string;
  busy: boolean;
}): RecordingSaveBlocker[] {
  const blockers: RecordingSaveBlocker[] = [];

  if (workflowName.trim() === "") {
    blockers.push({ message: "Workflow name is required." });
  }
  if (!draft) return blockers;

  for (const step of draft.steps) {
    if (!step.included) continue;
    if (step.action.type === "navigate" && step.action.config.url.trim() === "") {
      blockers.push({ message: "Navigate URL is required.", stepId: step.id });
    }
    if (isUploadPathMissing(step)) {
      blockers.push({
        message: "Upload file paths are required.",
        stepId: step.id,
      });
    }
    if (isRedactedInputStep(step)) {
      blockers.push({
        message: "Redacted input needs a reviewed safe value or must stay excluded.",
        stepId: step.id,
      });
    }
  }

  return blockers;
}

export function findFirstBlockedRecordingStepId(blockers: RecordingSaveBlocker[]) {
  return blockers.find((blocker) => blocker.stepId)?.stepId ?? null;
}

export function recordingActionLabel(action: ActionConfig) {
  switch (action.type) {
    case "navigate":
      return "Navigate";
    case "wait":
      return "Wait";
    case "random_wait":
      return "Random Wait";
    case "input_text":
      return "Input";
    case "clear_input":
      return "Clear Input";
    case "click":
      return "Click";
    case "scroll":
      return "Scroll";
    case "select_option":
      return "Select";
    case "press_key":
      return "Key";
    case "hotkey":
      return "Hotkey";
    case "hover":
      return "Hover";
    case "double_click":
      return "Double Click";
    case "right_click":
      return "Right Click";
    case "drag_and_drop":
      return "Drag and Drop";
    case "focus_element":
      return "Focus";
    case "blur_element":
      return "Blur";
    case "type_sequence":
      return "Type";
    case "set_clipboard":
      return "Set Clipboard";
    case "paste_clipboard":
      return "Paste";
    case "check":
      return "Check";
    case "uncheck":
      return "Uncheck";
    case "toggle_checkbox":
      return "Toggle";
    case "select_radio":
      return "Radio";
    case "upload_file":
      return "Upload";
    case "submit_form":
      return "Submit";
    case "select_custom_option":
      return "Custom Select";
    case "set_contenteditable":
      return "Edit Content";
    case "extract_text":
      return "Extract Text";
    case "extract_attribute":
      return "Extract Attribute";
    case "extract_input_value":
      return "Extract Input";
    case "extract_table":
      return "Extract Table";
    case "extract_list":
      return "Extract List";
    case "take_screenshot":
      return "Screenshot";
    case "go_back":
      return "Go Back";
    case "go_forward":
      return "Go Forward";
    case "reload":
      return "Reload";
    case "open_new_tab":
      return "Open Tab";
    case "switch_tab":
      return "Switch Tab";
    case "close_tab":
      return "Close Tab";
    case "accept_dialog":
      return "Accept Dialog";
    case "dismiss_dialog":
      return "Dismiss Dialog";
    case "wait_for_download":
      return "Download";
    case "set_variable":
      return "Set Variable";
    case "set_json_variables":
      return "Set JSON";
    case "assert_element":
      return "Assert Element";
    case "assert_text":
      return "Assert Text";
    case "graph_noop":
      return "Graph Merge";
    case "if_condition":
      return "If";
    case "router_condition":
      return "Router";
    case "repeat_times":
      return "Repeat";
    case "repeat_for_each":
      return "For Each";
    case "retry_block":
      return "Retry";
    case "switch_condition":
      return "Switch";
    case "while_loop":
      return "While";
    case "repeat_until":
      return "Repeat Until";
    case "try_catch":
      return "Try/Catch";
    case "fallback_block":
      return "Fallback";
    case "break_loop":
      return "Break";
    case "continue_loop":
      return "Continue";
    case "stop_workflow":
      return "Stop Workflow";
    case "transform_variable":
      return "Transform";
    case "assert_output":
      return "Assert Output";
    case "domain_allowlist":
      return "Allowlist";
    case "set_cookie":
      return "Set Cookie";
    case "clear_cookies":
      return "Clear Cookies";
    case "set_viewport":
      return "Viewport";
    case "set_geolocation":
      return "Geolocation";
    case "set_extra_headers":
      return "Headers";
    case "grant_permission":
      return "Permissions";
    case "execute_js":
      return "JavaScript";
    case "wait_for_request":
      return "Wait Request";
    case "wait_for_response":
      return "Wait Response";
    case "block_request":
      return "Block Request";
    case "mock_response":
      return "Mock Response";
    case "set_local_storage":
      return "Set Local Storage";
    case "set_session_storage":
      return "Set Session Storage";
    default:
      return (action as { type: string }).type;
  }
}

export function safeRecordingValueSummary(step: ReviewedRecordingStep) {
  const action = step.action;

  switch (action.type) {
    case "navigate":
      return action.config.url || "URL required";
    case "input_text":
    case "set_contenteditable":
    case "type_sequence":
      return isRedactedInputStep(step)
        ? "Value redacted"
        : getTextActionValue(action) || "Empty text";
    case "select_option":
      return action.config.value || "Select value required";
    case "scroll":
      return `${action.config.pixels ?? 0} px`;
    case "press_key":
      return action.config.key;
    case "hotkey":
      return action.config.keys.join(" + ");
    case "set_clipboard":
      return action.config.text || "Empty clipboard";
    case "upload_file":
      return action.config.files.length > 0
        ? action.config.files.join(", ")
        : "Upload paths required";
    case "switch_tab":
      return `Tab ${action.config.index}`;
    case "open_new_tab":
      return action.config.url ?? "Blank tab";
    case "wait_for_download":
      return action.config.output_name || "Download";
    case "accept_dialog":
      return action.config.prompt_text ? "Prompt response reviewed" : "Accept dialog";
    default:
      return null;
  }
}

export function getEditableRecordingValueField(
  step: ReviewedRecordingStep,
): EditableRecordingValueField {
  switch (step.action.type) {
    case "navigate":
      return "url";
    case "input_text":
    case "set_contenteditable":
    case "type_sequence":
      return "text";
    case "select_option":
      return "select_value";
    case "scroll":
      return "scroll_pixels";
    case "upload_file":
      return "upload_files";
    case "set_clipboard":
      return "clipboard_text";
    default:
      return null;
  }
}

export function formatRecordingDuration(session: RecordingSession | null) {
  if (!session) return "0s";
  const started = Date.parse(session.started_at);
  const ended = session.stopped_at ? Date.parse(session.stopped_at) : Date.now();
  if (!Number.isFinite(started) || !Number.isFinite(ended) || ended <= started) {
    return "0s";
  }
  const seconds = Math.round((ended - started) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder === 0 ? `${minutes}m` : `${minutes}m ${remainder}s`;
}

export function formatRecordingStartedAt(session: RecordingSession | null) {
  if (!session) return "Started unknown";
  const date = new Date(session.started_at);
  if (Number.isNaN(date.getTime())) return "Started unknown";
  return `Started ${date.toLocaleString()}`;
}

export function splitFilePathInput(value: string) {
  return value
    .split(/[\n,]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function formatLocatorSummary(target: ElementTarget | null | undefined) {
  const locator = target?.locators?.[0];
  if (!locator) return "No locator";
  if (locator.kind === "attribute" && locator.attribute) {
    return `${locator.attribute}=${locator.value}`;
  }
  return `${locator.kind}: ${locator.value}`;
}

export function getActionTarget(action: ActionConfig): ElementTarget | null {
  if ("target" in action.config) return action.config.target ?? null;
  if ("source_target" in action.config && action.config.source_target) {
    return action.config.source_target;
  }
  if ("trigger_target" in action.config && action.config.trigger_target) {
    return action.config.trigger_target;
  }
  return null;
}

function isWeakLocatorStep(step: ReviewedRecordingStep) {
  return step.included && step.locator_confidence === "low";
}

function isSensitiveWarning(code: string, message: string) {
  const value = `${code} ${message}`.toLowerCase();
  return value.includes("sensitive") || value.includes("redact") ||
    value.includes("secret") || value.includes("password");
}

function getTextActionValue(action: ActionConfig) {
  if (
    action.type === "input_text" ||
    action.type === "set_contenteditable" ||
    action.type === "type_sequence"
  ) {
    return action.config.text;
  }
  return "";
}

function capitalize(value: string) {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
