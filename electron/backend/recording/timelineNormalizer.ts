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
  select_option: "Select Option",
  check: "Check",
  uncheck: "Uncheck",
  select_radio: "Select Radio",
  scroll: "Scroll",
  hotkey: "Hotkey",
  press_key: "Press Key",
};

type PendingInput = {
  key: string;
  events: RecordingEvent[];
};

export function normalizeRecordingEvents(events: RecordingEvent[]): ReviewedRecordingStep[] {
  const sortedEvents = [...events].sort((left, right) => left.sequence - right.sequence);
  const steps: ReviewedRecordingStep[] = [];
  let pendingInput: PendingInput | null = null;

  const flushInput = () => {
    if (!pendingInput) return;
    const finalEvent = pendingInput.events[pendingInput.events.length - 1];
    const step = inputStep(finalEvent, pendingInput.events);
    if (step) steps.push(withStepId(step, steps.length + 1));
    pendingInput = null;
  };

  for (const event of sortedEvents) {
    if (isInputEvent(event)) {
      const key = targetKey(event.target);
      if (pendingInput && pendingInput.key === key) {
        pendingInput.events.push(event);
      } else {
        flushInput();
        pendingInput = { key, events: [event] };
      }
      continue;
    }

    flushInput();
    const step = stepFromEvent(event);
    if (step) steps.push(withStepId(step, steps.length + 1));
  }
  flushInput();

  return steps;
}

function stepFromEvent(
  event: RecordingEvent,
): Omit<ReviewedRecordingStep, "id"> | null {
  if (event.kind === "navigation") {
    const url = event.page_url ?? event.frame_url;
    if (!url) return null;
    return recordingStep([event], {
      type: "navigate",
      config: {
        url,
        wait_until: "load",
      },
    });
  }
  if (event.kind === "click") {
    const locator = generateElementTarget(event.target);
    return recordingStep([event], {
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
    return recordingStep([event], {
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
    return recordingStep([event], {
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
    return recordingStep([event], {
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
    return recordingStep([event], {
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
  if (event.kind === "keyboard") {
    if (event.value?.keys?.length && event.value.keys.length > 1) {
      return recordingStep([event], {
        type: "hotkey",
        config: { keys: event.value.keys },
      });
    }
    const key = event.value?.key ?? event.value?.keys?.[0];
    if (!key) return null;
    return recordingStep([event], {
      type: "press_key",
      config: { key },
    });
  }
  return null;
}

function inputStep(
  finalEvent: RecordingEvent,
  sourceEvents: RecordingEvent[],
): Omit<ReviewedRecordingStep, "id"> | null {
  const text = finalEvent.value?.text;
  if (text == null) return null;
  const locator = generateElementTarget(finalEvent.target);
  return recordingStep(sourceEvents, {
    type: "input_text",
    config: {
      target: locator.target,
      text,
      clear_before_input: true,
      wait_until: "visible",
      timeout_ms: 60000,
    },
  }, locator);
}

function recordingStep(
  sourceEvents: RecordingEvent[],
  action: ActionConfig,
  locator?: LocatorGenerationResult,
): Omit<ReviewedRecordingStep, "id"> {
  return {
    source_event_ids: sourceEvents.map((event) => event.id),
    action,
    label: recordingActionLabels[action.type] ?? action.type,
    included: true,
    locator_confidence: locator?.confidence ?? null,
    warnings: [
      ...sourceEvents.flatMap((event) => event.warnings),
      ...(locator?.warnings ?? []),
    ],
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
