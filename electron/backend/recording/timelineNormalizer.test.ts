// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { RecordingEvent } from "../../../src/types/workflow";
import { normalizeRecordingEvents } from "./timelineNormalizer";

describe("normalizeRecordingEvents", () => {
  test("collapses noisy input events into one final Fill Field step", () => {
    const steps = normalizeRecordingEvents([
      recordingEvent("event-1", 1, "navigation", {
        page_url: "https://fixture.owned.test/form",
        frame_url: "https://fixture.owned.test/form",
        target: null,
        value: null,
      }),
      recordingEvent("event-2", 2, "input", {
        target: fieldTarget(),
        value: { text: "qa" },
      }),
      recordingEvent("event-3", 3, "input", {
        target: fieldTarget(),
        value: { text: "qa@example.test" },
      }),
      recordingEvent("event-4", 4, "click", {
        target: buttonTarget(),
        value: null,
      }),
    ]);

    expect(steps).toHaveLength(3);
    expect(steps.map((step) => step.action.type)).toEqual([
      "navigate",
      "input_text",
      "click",
    ]);
    expect(steps[1]).toMatchObject({
      id: "recording-step-2",
      source_event_ids: ["event-2", "event-3"],
      label: "Fill Field",
      included: true,
      locator_confidence: "high",
      action: {
        type: "input_text",
        config: {
          text: "qa@example.test",
          clear_before_input: true,
          target: {
            locators: [{ kind: "test_id", value: "email" }],
          },
        },
      },
    });
  });

  test("maps select, checkbox, radio, and scroll events to existing actions", () => {
    const steps = normalizeRecordingEvents([
      recordingEvent("select-1", 1, "select", {
        target: selectTarget(),
        value: { selected_value: "pro", selected_label: "Pro" },
      }),
      recordingEvent("check-1", 2, "checkbox", {
        target: checkboxTarget(),
        value: { checked: false },
      }),
      recordingEvent("radio-1", 3, "radio", {
        target: radioTarget(),
        value: { checked: true },
      }),
      recordingEvent("scroll-1", 4, "scroll", {
        target: null,
        value: { scroll: { x: 0, y: 420 } },
      }),
    ]);

    expect(steps.map((step) => step.action)).toMatchObject([
      {
        type: "select_option",
        config: {
          match_by: "value",
          value: "pro",
        },
      },
      { type: "uncheck" },
      { type: "select_radio" },
      {
        type: "scroll",
        config: {
          mode: "page",
          direction: "down",
          pixels: 420,
        },
      },
    ]);
  });

  test("maps keyboard and click variant events to existing actions", () => {
    const steps = normalizeRecordingEvents([
      recordingEvent("key-1", 1, "keyboard", {
        value: { key: "Enter" },
      }),
      recordingEvent("hotkey-1", 2, "keyboard", {
        value: { keys: ["Control", "S"] },
      }),
      recordingEvent("double-1", 3, "click", {
        target: buttonTarget(),
        raw: { click_type: "double" },
      }),
      recordingEvent("right-1", 4, "click", {
        target: buttonTarget(),
        raw: { click_type: "right", button: 2 },
      }),
    ]);

    expect(steps.map((step) => step.action)).toMatchObject([
      { type: "press_key", config: { key: "Enter" } },
      { type: "hotkey", config: { keys: ["Control", "S"] } },
      { type: "double_click" },
      { type: "right_click" },
    ]);
  });

  test("maps tab, download, dialog, wait, and screenshot markers", () => {
    const steps = normalizeRecordingEvents([
      recordingEvent("tab-1", 1, "tab", {
        raw: { action: "switch", index: 1 },
      }),
      recordingEvent("download-1", 2, "download", {
        value: { file_names: ["Owned Report.csv"] },
        raw: { suggested_filename: "Owned Report.csv" },
      }),
      recordingEvent("dialog-1", 3, "dialog", {
        raw: { action: "dismiss", dialog_type: "confirm", message: "Continue?" },
      }),
      recordingEvent("wait-1", 4, "wait_marker", {
        raw: { action: "wait", condition: "page_load", timeout_ms: 30000 },
      }),
      recordingEvent("screenshot-1", 5, "wait_marker", {
        raw: {
          action: "screenshot",
          path: "recorded-confirmation.png",
          output_name: "confirmation_image",
          full_page: true,
        },
      }),
      recordingEvent("submit-1", 6, "wait_marker", {
        target: {
          tag_name: "form",
          accessible_name: "Checkout",
          locators: [
            { kind: "test_id", value: "checkout-form", score: 1, reason: "Stable test id" },
          ],
        },
        raw: { action: "submit" },
      }),
    ]);

    expect(steps.map((step) => step.action)).toMatchObject([
      { type: "switch_tab", config: { index: 1 } },
      {
        type: "wait_for_download",
        config: { output_name: "owned_report_csv" },
      },
      { type: "dismiss_dialog", config: {} },
      { type: "wait", config: { condition: "page_load", timeout_ms: 30000 } },
      {
        type: "take_screenshot",
        config: {
          path: "recorded-confirmation.png",
          output_name: "confirmation_image",
          full_page: true,
        },
      },
      {
        type: "submit_form",
        config: {
          target: { locators: [{ kind: "test_id", value: "checkout-form" }] },
        },
      },
    ]);
  });

  test("keeps file chooser uploads excluded until reviewed local paths exist", () => {
    const steps = normalizeRecordingEvents([
      recordingEvent("file-chooser-1", 1, "change", {
        target: fileTarget(),
        value: { file_names: ["avatar.png"] },
      }),
      recordingEvent("reviewed-upload-1", 2, "change", {
        target: fileTarget(),
        value: { file_names: ["fixture-upload.txt"] },
        raw: { reviewed_file_paths: ["/tmp/automation-app-fixtures/fixture-upload.txt"] },
      }),
    ]);

    expect(steps).toMatchObject([
      {
        included: false,
        action: {
          type: "upload_file",
          config: { files: [] },
        },
        warnings: [
          expect.objectContaining({
            code: "upload_requires_reviewed_file_path",
          }),
        ],
      },
      {
        included: true,
        action: {
          type: "upload_file",
          config: { files: ["/tmp/automation-app-fixtures/fixture-upload.txt"] },
        },
      },
    ]);
  });

  test("surfaces weak locator warnings on generated steps", () => {
    const steps = normalizeRecordingEvents([
      recordingEvent("click-weak", 1, "click", {
        target: {
          tag_name: "div",
          text_sample: "Unstable generated panel",
          locators: [],
        },
        value: null,
      }),
    ]);

    expect(steps[0]).toMatchObject({
      locator_confidence: "low",
      warnings: [
        expect.objectContaining({
          code: "weak_locator",
        }),
      ],
    });
  });
});

function recordingEvent(
  id: string,
  sequence: number,
  kind: RecordingEvent["kind"],
  overrides: Partial<RecordingEvent>,
): RecordingEvent {
  return {
    id,
    session_id: "rec_1",
    sequence,
    timestamp: "2026-05-27T10:00:00.000Z",
    kind,
    frame_url: "https://fixture.owned.test/form",
    page_url: "https://fixture.owned.test/form",
    target: null,
    value: null,
    raw: {},
    confidence: "high",
    warnings: [],
    ...overrides,
  };
}

function fieldTarget(): RecordingEvent["target"] {
  return {
    tag_name: "input",
    input_type: "email",
    accessible_name: "Email",
    locators: [
      { kind: "test_id", value: "email", score: 1, reason: "Stable test id" },
    ],
  };
}

function buttonTarget(): RecordingEvent["target"] {
  return {
    tag_name: "button",
    accessible_name: "Submit",
    role: "button",
    locators: [
      {
        kind: "role",
        value: "button",
        name: "Submit",
        score: 0.8,
        reason: "Accessible role",
      },
    ],
  };
}

function selectTarget(): RecordingEvent["target"] {
  return {
    tag_name: "select",
    accessible_name: "Plan",
    locators: [
      { kind: "label", value: "Plan", score: 0.9, reason: "Field label" },
    ],
  };
}

function checkboxTarget(): RecordingEvent["target"] {
  return {
    tag_name: "input",
    input_type: "checkbox",
    accessible_name: "Newsletter",
    locators: [
      { kind: "label", value: "Newsletter", score: 0.9, reason: "Field label" },
    ],
  };
}

function radioTarget(): RecordingEvent["target"] {
  return {
    tag_name: "input",
    input_type: "radio",
    accessible_name: "Business",
    locators: [
      { kind: "label", value: "Business", score: 0.9, reason: "Field label" },
    ],
  };
}

function fileTarget(): RecordingEvent["target"] {
  return {
    tag_name: "input",
    input_type: "file",
    accessible_name: "Avatar",
    locators: [
      { kind: "label", value: "Avatar", score: 0.9, reason: "Field label" },
    ],
  };
}
