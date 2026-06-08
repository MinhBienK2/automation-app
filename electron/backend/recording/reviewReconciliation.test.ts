// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig, ReviewedRecordingStep } from "../../../src/types/workflow";
import { reconcileReviewedRecordingSteps } from "./reviewReconciliation";

describe("reconcileReviewedRecordingSteps", () => {
  test("keeps the backend draft step set and rejects reviewed action type changes", () => {
    const draftSteps = [
      reviewedStep("visit", "Visit form", {
        type: "navigate",
        config: { url: "https://fixture.owned.test/form", timeout_ms: 1000 },
      }),
      reviewedStep("click-save", "Click Save", {
        type: "click",
        config: {
          target: { locators: [{ kind: "role", value: "button", name: "Save" }] },
          wait_until: "visible",
        },
      }),
    ];

    const reconciled = reconcileReviewedRecordingSteps(draftSteps, [
      {
        ...draftSteps[0],
        label: "Open reviewed form",
        included: false,
        action: {
          type: "navigate",
          config: {
            url: "https://fixture.owned.test/reviewed",
            timeout_ms: 1,
          },
        },
      },
      {
        ...draftSteps[1],
        label: "Reviewed click",
        action: {
          type: "execute_js",
          config: { script: "return document.cookie", output_name: "cookie" },
        } as ActionConfig,
      },
      {
        id: "injected-step",
        label: "Injected",
        included: true,
        action: {
          type: "execute_js",
          config: { script: "return document.cookie", output_name: "cookie" },
        } as ActionConfig,
      },
    ]);

    expect(reconciled).toHaveLength(2);
    expect(reconciled[0]).toMatchObject({
      id: "visit",
      label: "Open reviewed form",
      included: false,
      action: {
        type: "navigate",
        config: {
          url: "https://fixture.owned.test/reviewed",
          timeout_ms: 1000,
        },
      },
    });
    expect(reconciled[1]).toMatchObject({
      id: "click-save",
      label: "Reviewed click",
      action: { type: "click" },
    });
    expect(JSON.stringify(reconciled)).not.toContain("execute_js");
    expect(JSON.stringify(reconciled)).not.toContain("document.cookie");
  });

  test("accepts only supported editable action values", () => {
    const draftSteps = [
      reviewedStep("field", "Fill Field", {
        type: "input_text",
        config: {
          target: { locators: [{ kind: "test_id", value: "email" }] },
          text: "recorded@example.test",
          clear_before_input: true,
        },
      }),
      reviewedStep("scroll", "Scroll", {
        type: "scroll",
        config: {
          direction: "down",
          pixels: 500,
          target: { locators: [{ kind: "css", value: "main" }] },
        },
      }),
      reviewedStep("upload", "Upload File", {
        type: "upload_file",
        config: {
          target: { locators: [{ kind: "test_id", value: "file" }] },
          files: ["/tmp/recorded.txt"],
        },
      }),
      reviewedStep("clipboard", "Set Clipboard", {
        type: "set_clipboard",
        config: { text: "recorded clipboard" },
      }),
    ];

    const reconciled = reconcileReviewedRecordingSteps(draftSteps, [
      {
        ...draftSteps[0],
        action: { type: "input_text", config: { text: "reviewed@example.test" } },
      },
      {
        ...draftSteps[1],
        action: { type: "scroll", config: { pixels: Number.NaN } },
      },
      {
        ...draftSteps[2],
        action: {
          type: "upload_file",
          config: { files: ["/tmp/reviewed.txt", "", null] },
        },
      },
      {
        ...draftSteps[3],
        action: { type: "set_clipboard", config: { text: "reviewed clipboard" } },
      },
    ]);

    expect(reconciled.map((step) => step.action)).toEqual([
      {
        type: "input_text",
        config: {
          target: { locators: [{ kind: "test_id", value: "email" }] },
          text: "reviewed@example.test",
          clear_before_input: true,
        },
      },
      {
        type: "scroll",
        config: {
          direction: "down",
          pixels: 500,
          target: { locators: [{ kind: "css", value: "main" }] },
        },
      },
      {
        type: "upload_file",
        config: {
          target: { locators: [{ kind: "test_id", value: "file" }] },
          files: ["/tmp/reviewed.txt"],
        },
      },
      {
        type: "set_clipboard",
        config: { text: "reviewed clipboard" },
      },
    ]);
  });
});

function reviewedStep(
  id: string,
  label: string,
  action: ActionConfig,
): ReviewedRecordingStep {
  return {
    id,
    source_event_ids: [id],
    action,
    label,
    included: true,
    timing: null,
    locator_confidence: null,
    warnings: [],
  };
}
