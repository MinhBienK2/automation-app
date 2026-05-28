import type {
  ActionConfig,
  RecordingEvent,
  RecordingTarget,
  ReviewedRecordingStep,
} from "../../../src/types/workflow.js";
import { generateElementTarget, type LocatorGenerationResult } from "./locatorGenerator.js";

const recordingActionLabels: Partial<Record<ActionConfig["type"], string>> = {
  navigate: "Navigate",
  input_text: "Fill Field",
  click: "Click",
  double_click: "Double Click",
  right_click: "Right Click",
  select_option: "Select Option",
  check: "Check",
  uncheck: "Uncheck",
  select_radio: "Select Radio",
  scroll: "Scroll",
  hotkey: "Hotkey",
  press_key: "Press Key",
  upload_file: "Upload File",
  switch_tab: "Switch Tab",
  open_new_tab: "Open New Tab",
  wait_for_download: "Wait For Download",
  accept_dialog: "Accept Dialog",
  dismiss_dialog: "Dismiss Dialog",
  wait: "Wait",
  take_screenshot: "Take Screenshot",
};

type PendingInput = {
  key: string;
  events: RecordingEvent[];
};

type PendingDedupedEvent = {
  kind: "select" | "checkbox" | "radio" | "click" | "upload";
  key: string;
  events: RecordingEvent[];
};

export function normalizeRecordingEvents(events: RecordingEvent[]): ReviewedRecordingStep[] {
  const sortedEvents = [...events].sort((left, right) => left.sequence - right.sequence);
  const steps: ReviewedRecordingStep[] = [];
  let pendingInput: PendingInput | null = null;
  let pendingDedupedEvent: PendingDedupedEvent | null = null;
  let previousScrollPosition = { x: 0, y: 0 };

  const flushInput = () => {
    if (!pendingInput) return;
    const finalEvent = pendingInput.events[pendingInput.events.length - 1];
    const step = inputStep(finalEvent, pendingInput.events);
    if (step) steps.push(withStepId(step, steps.length + 1));
    pendingInput = null;
  };

  const flushDedupedEvent = () => {
    if (!pendingDedupedEvent) return;
    const finalEvent = pendingDedupedEvent.events[pendingDedupedEvent.events.length - 1];
    const step = stepFromEvent(finalEvent, pendingDedupedEvent.events);
    if (step) steps.push(withStepId(step, steps.length + 1));
    pendingDedupedEvent = null;
  };

  const flushPending = () => {
    flushInput();
    flushDedupedEvent();
  };

  for (const event of sortedEvents) {
    if (isInputEvent(event)) {
      flushDedupedEvent();
      const key = targetKey(event.target);
      if (pendingInput && pendingInput.key === key) {
        pendingInput.events.push(event);
      } else {
        flushInput();
        pendingInput = { key, events: [event] };
      }
      continue;
    }

    if (isIgnorableKeyboardEvent(event)) {
      continue;
    }

    if (event.kind === "scroll") {
      flushPending();
      const scrollDelta = scrollEventWithDelta(event, previousScrollPosition);
      if (!scrollDelta) continue;
      previousScrollPosition = scrollDelta.position;
      const step = stepFromEvent(scrollDelta.event, [event]);
      if (step) steps.push(withStepId(step, steps.length + 1));
      continue;
    }

    const dedupedKind = dedupedEventKind(event);
    if (dedupedKind) {
      flushInput();
      const key = dedupedEventKey(dedupedKind, event);
      if (
        pendingDedupedEvent &&
        canMergeDedupedEvent(pendingDedupedEvent, dedupedKind, key, event)
      ) {
        pendingDedupedEvent.events.push(event);
      } else {
        flushDedupedEvent();
        pendingDedupedEvent = { kind: dedupedKind, key, events: [event] };
      }
      continue;
    }

    flushPending();
    if (event.kind === "navigation") {
      previousScrollPosition = { x: 0, y: 0 };
    }
    const step = stepFromEvent(event);
    if (step) steps.push(withStepId(step, steps.length + 1));
  }
  flushPending();

  return steps;
}

function stepFromEvent(
  event: RecordingEvent,
  sourceEvents: RecordingEvent[] = [event],
): Omit<ReviewedRecordingStep, "id"> | null {
  if (event.kind === "navigation") {
    const url = event.page_url ?? event.frame_url;
    if (!url) return null;
    return recordingStep(sourceEvents, {
      type: "navigate",
      config: {
        url,
        wait_until: "load",
      },
    });
  }
  if (event.kind === "click") {
    const locator = generateElementTarget(event.target);
    const clickType = stringValue(event.raw.click_type);
    if (clickType === "double" || numberValue(event.raw.detail) >= 2) {
      return recordingStep(sourceEvents, {
        type: "double_click",
        config: {
          target: locator.target,
          wait_until: "clickable",
          timeout_ms: 60000,
        },
      }, locator);
    }
    if (clickType === "right" || numberValue(event.raw.button) === 2) {
      return recordingStep(sourceEvents, {
        type: "right_click",
        config: {
          target: locator.target,
          wait_until: "clickable",
          timeout_ms: 60000,
        },
      }, locator);
    }
    return recordingStep(sourceEvents, {
      type: "click",
      config: {
        target: locator.target,
        wait_until: "clickable",
        timeout_ms: 60000,
      },
    }, locator);
  }
  if (event.kind === "select") {
    const locator = generateElementTarget(event.target);
    const selectedValue = event.value?.selected_value?.trim();
    const selectedLabel = event.value?.selected_label?.trim();
    return recordingStep(sourceEvents, {
      type: "select_option",
      config: {
        target: locator.target,
        match_by: selectedValue ? "value" : "label",
        value: selectedValue || selectedLabel || "",
        wait_until: "visible",
        timeout_ms: 60000,
      },
    }, locator);
  }
  if (event.kind === "checkbox") {
    const locator = generateElementTarget(event.target);
    return recordingStep(sourceEvents, {
      type: event.value?.checked === false ? "uncheck" : "check",
      config: {
        target: locator.target,
        wait_until: "visible",
        timeout_ms: 60000,
      },
    } as ActionConfig, locator);
  }
  if (event.kind === "radio") {
    if (event.value?.checked === false) return null;
    const locator = generateElementTarget(event.target);
    return recordingStep(sourceEvents, {
      type: "select_radio",
      config: {
        target: locator.target,
        wait_until: "visible",
        timeout_ms: 60000,
      },
    }, locator);
  }
  if (event.kind === "scroll") {
    const scroll = event.value?.scroll;
    if (!scroll) return null;
    const horizontal = Math.abs(scroll.x) > Math.abs(scroll.y);
    const amount = Math.max(1, Math.round(Math.abs(horizontal ? scroll.x : scroll.y)));
    return recordingStep(sourceEvents, {
      type: "scroll",
      config: {
        mode: "page",
        direction: horizontal
          ? scroll.x >= 0 ? "right" : "left"
          : scroll.y >= 0 ? "down" : "up",
        pixels: amount,
      },
    });
  }
  if ((event.kind === "input" || event.kind === "change") && event.value?.file_names) {
    return uploadStep(event, sourceEvents);
  }
  if (event.kind === "keyboard") {
    if (event.value?.keys?.length && event.value.keys.length > 1) {
      return recordingStep(sourceEvents, {
        type: "hotkey",
        config: { keys: event.value.keys },
      });
    }
    const key = event.value?.key ?? event.value?.keys?.[0];
    if (!key) return null;
    return recordingStep(sourceEvents, {
      type: "press_key",
      config: { key },
    });
  }
  if (event.kind === "tab") {
    const action = stringValue(event.raw.action);
    if (action === "open") {
      return recordingStep(sourceEvents, {
        type: "open_new_tab",
        config: { url: stringValue(event.raw.url) },
      });
    }
    const index = numberValue(event.raw.index);
    return recordingStep(sourceEvents, {
      type: "switch_tab",
      config: { index: Number.isFinite(index) ? Math.max(0, Math.trunc(index)) : 0 },
    });
  }
  if (event.kind === "download") {
    return recordingStep(sourceEvents, {
      type: "wait_for_download",
      config: {
        output_name: outputNameForDownload(event),
        timeout_ms: numberOrNull(event.raw.timeout_ms),
      },
    });
  }
  if (event.kind === "dialog") {
    const action = stringValue(event.raw.action);
    if (action === "accept") {
      return recordingStep(sourceEvents, {
        type: "accept_dialog",
        config: { prompt_text: stringValue(event.raw.prompt_text) },
      });
    }
    return recordingStep(sourceEvents, {
      type: "dismiss_dialog",
      config: {},
    });
  }
  if (event.kind === "wait_marker") {
    const action = stringValue(event.raw.action);
    if (action === "screenshot") {
      return recordingStep(sourceEvents, {
        type: "take_screenshot",
        config: {
          path: stringValue(event.raw.path) || `recorded-step-${event.sequence}.png`,
          output_name: stringValue(event.raw.output_name),
          full_page: booleanValue(event.raw.full_page) ?? false,
        },
      });
    }
    if (action === "submit") {
      const locator = generateElementTarget(event.target);
      return recordingStep(sourceEvents, {
        type: "submit_form",
        config: {
          target: locator.target,
          wait_until: "visible",
          timeout_ms: 60000,
        },
      }, locator);
    }
    if (action === "wait") {
      return recordingStep(sourceEvents, {
        type: "wait",
        config: {
          condition: waitCondition(event.raw.condition),
          duration_ms: numberOrNull(event.raw.duration_ms),
          timeout_ms: numberOrNull(event.raw.timeout_ms),
          text: stringValue(event.raw.text),
          url: stringValue(event.raw.url),
        },
      });
    }
  }
  return null;
}

function uploadStep(
  event: RecordingEvent,
  sourceEvents: RecordingEvent[] = [event],
): Omit<ReviewedRecordingStep, "id"> | null {
  const locator = generateElementTarget(event.target);
  const files = stringArray(event.raw.reviewed_file_paths);
  const warnings = files.length > 0
    ? []
    : [{
        code: "upload_requires_reviewed_file_path",
        message:
          "Native file chooser paths are not captured; review and enter local upload file paths before replay.",
        event_id: event.id,
        severity: "warning" as const,
      }];
  return recordingStep(sourceEvents, {
    type: "upload_file",
    config: {
      target: locator.target,
      files,
      wait_until: "visible",
      timeout_ms: 60000,
    },
  }, locator, {
    included: files.length > 0,
    warnings,
  });
}

function inputStep(
  finalEvent: RecordingEvent,
  sourceEvents: RecordingEvent[],
): Omit<ReviewedRecordingStep, "id"> | null {
  const text = finalEvent.value?.text;
  if (text == null) return null;
  const locator = generateElementTarget(finalEvent.target);
  const sensitiveRedacted = sourceEvents.some((event) =>
    event.warnings.some((warning) => warning.code === "sensitive_input_redacted") ||
    event.raw.value_redacted === true
  );
  return recordingStep(sourceEvents, {
    type: "input_text",
    config: {
      target: locator.target,
      text,
      clear_before_input: true,
      wait_until: "visible",
      timeout_ms: 60000,
    },
  }, locator, {
    included: !sensitiveRedacted,
  });
}

function recordingStep(
  sourceEvents: RecordingEvent[],
  action: ActionConfig,
  locator?: LocatorGenerationResult,
  options: {
    included?: boolean;
    warnings?: ReviewedRecordingStep["warnings"];
  } = {},
): Omit<ReviewedRecordingStep, "id"> {
  return {
    source_event_ids: sourceEvents.map((event) => event.id),
    action,
    label: recordingActionLabels[action.type] ?? action.type,
    included: options.included ?? true,
    timing: recordingStepTiming(sourceEvents),
    locator_confidence: locator?.confidence ?? null,
    warnings: [
      ...sourceEvents.flatMap((event) => event.warnings),
      ...(locator?.warnings ?? []),
      ...(options.warnings ?? []),
    ],
  };
}

function recordingStepTiming(
  sourceEvents: RecordingEvent[],
): ReviewedRecordingStep["timing"] {
  const timestamps = sourceEvents
    .map((event) => Date.parse(event.timestamp))
    .filter((timestamp) => Number.isFinite(timestamp));
  if (timestamps.length === 0) return null;

  return {
    first_event_at: new Date(Math.min(...timestamps)).toISOString(),
    last_event_at: new Date(Math.max(...timestamps)).toISOString(),
  };
}

function withStepId(
  step: Omit<ReviewedRecordingStep, "id">,
  index: number,
): ReviewedRecordingStep {
  return {
    id: `recording-step-${index}`,
    ...step,
  };
}

function isInputEvent(event: RecordingEvent) {
  return (
    (event.kind === "input" || event.kind === "change") &&
    event.value?.text != null
  );
}

const IGNORED_TEXT_COMPOSITION_KEYS = new Set(["Process", "Dead", "Unidentified"]);
const MODIFIER_ONLY_KEYS = new Set(["Alt", "AltGraph", "Control", "Meta", "Shift"]);

function isIgnorableKeyboardEvent(event: RecordingEvent) {
  if (event.kind !== "keyboard") return false;
  const keys = event.value?.keys;
  if (keys?.length) {
    const replayKeys = keys.filter((key) => !MODIFIER_ONLY_KEYS.has(key));
    return replayKeys.length === 0 ||
      replayKeys.every((key) => IGNORED_TEXT_COMPOSITION_KEYS.has(key));
  }
  const key = event.value?.key;
  return !key ||
    MODIFIER_ONLY_KEYS.has(key) ||
    IGNORED_TEXT_COMPOSITION_KEYS.has(key);
}

function dedupedEventKind(event: RecordingEvent): PendingDedupedEvent["kind"] | null {
  if ((event.kind === "input" || event.kind === "change") && event.value?.file_names) {
    return "upload";
  }
  if (
    event.kind === "select" ||
    event.kind === "checkbox" ||
    event.kind === "radio" ||
    event.kind === "click"
  ) {
    return event.kind;
  }
  return null;
}

function dedupedEventKey(
  kind: PendingDedupedEvent["kind"],
  event: RecordingEvent,
) {
  return `${kind}:${targetKey(event.target)}:${dedupedValueKey(kind, event)}`;
}

function dedupedValueKey(
  kind: PendingDedupedEvent["kind"],
  event: RecordingEvent,
) {
  if (kind === "select") {
    return `${event.value?.selected_value ?? ""}\u0000${event.value?.selected_label ?? ""}`;
  }
  if (kind === "checkbox" || kind === "radio") {
    return String(event.value?.checked ?? "");
  }
  if (kind === "upload") {
    return event.value?.file_names?.join("\u0000") ?? "";
  }
  return "";
}

function canMergeDedupedEvent(
  pending: PendingDedupedEvent,
  kind: PendingDedupedEvent["kind"],
  key: string,
  event: RecordingEvent,
) {
  if (pending.kind !== kind || pending.key !== key) return false;
  if (kind === "click") {
    return (
      pending.events.length === 1 &&
      isSingleClickEvent(pending.events[0]) &&
      isDoubleClickEvent(event)
    );
  }
  return true;
}

function isSingleClickEvent(event: RecordingEvent) {
  const clickType = stringValue(event.raw.click_type);
  return (
    event.kind === "click" &&
    clickType !== "double" &&
    clickType !== "right" &&
    numberValue(event.raw.button) !== 2 &&
    (clickType === "single" || numberValue(event.raw.detail) < 2)
  );
}

function isDoubleClickEvent(event: RecordingEvent) {
  const clickType = stringValue(event.raw.click_type);
  return (
    event.kind === "click" &&
    (clickType === "double" || numberValue(event.raw.detail) >= 2)
  );
}

function scrollEventWithDelta(
  event: RecordingEvent,
  previousPosition: { x: number; y: number },
) {
  const scroll = event.value?.scroll;
  if (!scroll) return null;
  const position = { x: scroll.x, y: scroll.y };
  const delta = {
    x: position.x - previousPosition.x,
    y: position.y - previousPosition.y,
  };
  if (delta.x === 0 && delta.y === 0) return null;
  return {
    event: {
      ...event,
      value: {
        ...event.value,
        scroll: delta,
      },
    },
    position,
  };
}

function targetKey(target: RecordingTarget | null) {
  if (!target) return "target:none";
  const firstLocator = target.locators[0];
  if (firstLocator) {
    return `${firstLocator.kind}:${firstLocator.value}`;
  }
  return [
    target.tag_name,
    target.input_type ?? "",
    target.accessible_name ?? "",
    target.text_sample ?? "",
  ].join("\u0000");
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : Number.NaN;
}

function numberOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function booleanValue(value: unknown) {
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    : [];
}

function outputNameForDownload(event: RecordingEvent) {
  const explicit = stringValue(event.raw.output_name);
  if (explicit) return explicit;
  const filename = stringValue(event.raw.suggested_filename) ?? event.value?.file_names?.[0] ?? "download";
  const normalized = filename
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return normalized || "download";
}

function waitCondition(value: unknown): Extract<
  ActionConfig,
  { type: "wait" }
>["config"]["condition"] {
  return value === "element_visible" ||
    value === "element_hidden" ||
    value === "element_attached" ||
    value === "element_detached" ||
    value === "text_visible" ||
    value === "url_contains" ||
    value === "page_load" ||
    value === "element_enabled" ||
    value === "element_disabled"
    ? value
    : "duration";
}
