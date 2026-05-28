import { describe, expect, test } from "vitest";
import type { ReviewedRecordingStep, RecordingWorkflowDraft } from "../../../types/workflow";
import { workflowDetailScenario } from "../../../tests/mocks/workflowScenarios";
import { linearGraphFromSteps } from "./workflowGraph";
import {
  filterRecordingSteps,
  findFirstBlockedRecordingStepId,
  getEditableRecordingValueField,
  getRecordingSaveBlockers,
  getRecordingStepBadges,
  isRedactedInputStep,
  isUploadPathMissing,
  recordingActionLabel,
  recordingStepNeedsAttention,
  safeRecordingValueSummary,
  summarizeRecordingDraft,
} from "./recordingReview";

describe("recordingReview helpers", () => {
  test("summarizes draft counts and classifies attention states", () => {
    const draft = recordingDraft([
      navigateStep(),
      inputStep({
        included: true,
        text: "",
        warnings: [{
          code: "sensitive_input_redacted",
          message: "Sensitive input was redacted.",
          severity: "warning",
        }],
      }),
      uploadStep({ included: true, files: [] }),
      clickStep({ included: true, locatorConfidence: "low" }),
      clickStep({ id: "excluded-click", included: false }),
    ]);

    expect(summarizeRecordingDraft(draft)).toEqual({
      totalSteps: 5,
      includedSteps: 4,
      excludedSteps: 1,
      warningCount: 3,
      needsAttentionCount: 3,
      redactedMissingCount: 1,
      uploadRequiredCount: 1,
      weakLocatorCount: 1,
    });
    expect(recordingStepNeedsAttention(draft.steps[1])).toBe(true);
    expect(getRecordingStepBadges(draft.steps[2]).map((badge) => badge.label))
      .toContain("Upload required");
    expect(isRedactedInputStep(draft.steps[1])).toBe(true);
    expect(isUploadPathMissing(draft.steps[2])).toBe(true);
  });

  test("detects save blockers and the first blocked step", () => {
    const draft = recordingDraft([
      navigateStep({ url: "" }),
      uploadStep({ files: [] }),
      inputStep({
        id: "redacted",
        text: "",
        warnings: [{
          code: "sensitive_input_redacted",
          message: "Sensitive input was redacted.",
          severity: "warning",
        }],
      }),
    ]);

    const blockers = getRecordingSaveBlockers({
      draft,
      workflowName: " ",
      busy: false,
    });

    expect(blockers.map((blocker) => blocker.message)).toEqual([
      "Workflow name is required.",
      "Navigate URL is required.",
      "Upload file paths are required.",
      "Redacted input needs a reviewed safe value or must stay excluded.",
    ]);
    expect(findFirstBlockedRecordingStepId(blockers)).toBe("navigate");
  });

  test("filters steps and exposes safe labels and editable fields", () => {
    const steps = [
      navigateStep(),
      uploadStep({ included: false }),
      clickStep({ locatorConfidence: "low" }),
    ];

    expect(filterRecordingSteps(steps, "included").map((step) => step.id))
      .toEqual(["navigate", "click"]);
    expect(filterRecordingSteps(steps, "excluded").map((step) => step.id))
      .toEqual(["upload"]);
    expect(filterRecordingSteps(steps, "warnings").map((step) => step.id))
      .toEqual(["upload", "click"]);
    expect(filterRecordingSteps(steps, "needs_attention").map((step) => step.id))
      .toEqual(["click"]);
    expect(recordingActionLabel(steps[0].action)).toBe("Navigate");
    expect(safeRecordingValueSummary(steps[0])).toBe("https://fixture.owned.test");
    expect(getEditableRecordingValueField(steps[0])).toBe("url");
    expect(getEditableRecordingValueField(steps[1])).toBe("upload_files");
  });
});

function recordingDraft(steps: ReviewedRecordingStep[]): RecordingWorkflowDraft {
  return {
    id: "draft-1",
    session_id: "session-1",
    workflow_id: null,
    mode: "new_workflow",
    status: "draft",
    generated_at: "2026-05-29T10:00:00.000Z",
    workflow_settings_snapshot: workflowDetailScenario([]).get_workflow_settings,
    steps,
    graph: linearGraphFromSteps([]),
    validation_issues: [],
    warnings: [],
  };
}

function navigateStep(input: Partial<{ url: string }> = {}): ReviewedRecordingStep {
  return {
    id: "navigate",
    source_event_ids: ["event-navigation"],
    action: {
      type: "navigate",
      config: { url: input.url ?? "https://fixture.owned.test" },
    },
    label: "Navigate",
    included: true,
    locator_confidence: null,
    warnings: [],
  };
}

function inputStep(
  input: Partial<{
    id: string;
    included: boolean;
    text: string;
    warnings: ReviewedRecordingStep["warnings"];
  }> = {},
): ReviewedRecordingStep {
  return {
    id: input.id ?? "input",
    source_event_ids: ["event-input"],
    action: {
      type: "input_text",
      config: {
        target: { locators: [{ kind: "label", value: "Email" }] },
        text: input.text ?? "qa@example.test",
        clear_before_input: true,
      },
    },
    label: "Fill Field",
    included: input.included ?? true,
    locator_confidence: "high",
    warnings: input.warnings ?? [],
  };
}

function uploadStep(
  input: Partial<{ included: boolean; files: string[] }> = {},
): ReviewedRecordingStep {
  return {
    id: "upload",
    source_event_ids: ["event-upload"],
    action: {
      type: "upload_file",
      config: {
        target: { locators: [{ kind: "label", value: "Avatar" }] },
        files: input.files ?? ["/tmp/avatar.png"],
        wait_until: "visible",
      },
    },
    label: "Upload File",
    included: input.included ?? true,
    locator_confidence: "high",
    warnings: [{
      code: "upload_requires_reviewed_file_path",
      message: "Native file chooser paths are not captured.",
      severity: "warning",
    }],
  };
}

function clickStep(
  input: Partial<{
    id: string;
    included: boolean;
    locatorConfidence: ReviewedRecordingStep["locator_confidence"];
  }> = {},
): ReviewedRecordingStep {
  return {
    id: input.id ?? "click",
    source_event_ids: ["event-click"],
    action: {
      type: "click",
      config: { target: { locators: [{ kind: "text", value: "Continue" }] } },
    },
    label: "Click",
    included: input.included ?? true,
    locator_confidence: input.locatorConfidence ?? "high",
    warnings: input.locatorConfidence === "low"
      ? [{
          code: "weak_locator",
          message: "Locator confidence is low.",
          severity: "warning",
        }]
      : [],
  };
}
