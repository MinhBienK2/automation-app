import type {
  ActionType,
  CommandError,
  RunState,
  WorkflowStep,
} from "../types/workflow";

export const actionLabels: Record<ActionType, string> = {
  open_url: "Open URL",
  sleep: "Sleep",
  type_text: "Type Text",
  click: "Click",
  scroll: "Scroll",
};

export const actionOptions: ActionType[] = [
  "open_url",
  "sleep",
  "type_text",
  "click",
  "scroll",
];

export const initialRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  error: null,
};

export function stepSummary(step: WorkflowStep) {
  switch (step.config.type) {
    case "open_url":
      return step.config.config.url || "No URL";
    case "sleep":
      return `${step.config.config.seconds}s`;
    case "type_text":
      return step.config.config.xpath || "No XPath";
    case "click":
      return step.config.config.xpath || "No XPath";
    case "scroll":
      return `${step.config.config.direction} ${step.config.config.pixels}px`;
  }
}

export function commandMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as CommandError).message);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

export function normalizeRunState(state: RunState): RunState {
  return {
    status: state.status,
    mode: state.mode ?? "none",
    target_step_id: state.target_step_id ?? null,
    current_step_id: state.current_step_id ?? null,
    current_step_number: state.current_step_number ?? null,
    completed_step_ids: state.completed_step_ids ?? [],
    error: state.error ?? null,
  };
}

export function monitorStepStatus(step: WorkflowStep, state: RunState) {
  if (state.error?.step_id === step.id) return "failed";
  if (state.current_step_id === step.id) return "running";
  if (state.completed_step_ids.includes(step.id)) return "passed";
  return "pending";
}

export function suggestionsFor(reason: string, actionType: string) {
  if (reason.includes("XPath not found")) {
    return [
      "Check the XPath in the Chromium window that remains open.",
      "Add a Sleep step before this step if the element loads slowly.",
      "Prefer XPath based on id, name, placeholder, text, or stable attributes.",
      "Avoid absolute XPath such as /html/body/div[2]/...",
    ];
  }
  if (reason.includes("Element cannot receive text")) {
    return [
      "Make sure the XPath points to an input, textarea, or editable element.",
      "Check whether the XPath points to a label, div, button, or wrapper instead of the field.",
    ];
  }
  if (reason.includes("URL") || actionType === "open_url") {
    return [
      "Use a full URL with http:// or https://.",
      "Check for extra whitespace or missing characters.",
    ];
  }
  if (reason.includes("Seconds")) {
    return [
      "Use a Sleep value greater than 0.",
      "Try 0.5, 1, or 2 seconds depending on page speed.",
    ];
  }
  if (reason.includes("Pixels")) {
    return [
      "Use a Scroll pixels value greater than 0.",
      "Try 300 to 800 pixels for a single scroll.",
    ];
  }
  return [
    "Close old test browsers and try again.",
    "Check that Chrome or Chromium can start on this machine.",
  ];
}
