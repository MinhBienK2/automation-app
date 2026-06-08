import type { ActionConfig, ReviewedRecordingStep } from "../../../src/types/workflow.js";

export function reconcileReviewedRecordingSteps(
  draftSteps: ReviewedRecordingStep[],
  reviewedInput: unknown,
): ReviewedRecordingStep[] {
  const reviewedById = new Map(
    reviewedStepRecords(reviewedInput).map((step) => [step.id, step]),
  );
  return draftSteps.map((draftStep) => {
    const reviewed = reviewedById.get(draftStep.id);
    if (!reviewed) return draftStep;
    return {
      ...draftStep,
      label: typeof reviewed.label === "string" ? reviewed.label : draftStep.label,
      included:
        typeof reviewed.included === "boolean"
          ? reviewed.included
          : draftStep.included,
      action: mergeReviewedRecordingAction(draftStep.action, reviewed.action),
    };
  });
}

function mergeReviewedRecordingAction(
  draftAction: ActionConfig,
  reviewedActionInput: unknown,
): ActionConfig {
  const reviewedAction = actionConfigOrNull(reviewedActionInput);
  if (!reviewedAction) return draftAction;
  if (draftAction.type !== reviewedAction.type) return draftAction;
  switch (draftAction.type) {
    case "navigate":
      if (reviewedAction.type !== "navigate") return draftAction;
      return {
        type: "navigate",
        config: {
          ...draftAction.config,
          url: stringReviewValue(reviewedAction.config.url, draftAction.config.url),
        },
      };
    case "input_text":
      if (reviewedAction.type !== "input_text") return draftAction;
      return {
        type: "input_text",
        config: {
          ...draftAction.config,
          text: stringReviewValue(reviewedAction.config.text, draftAction.config.text),
        },
      };
    case "select_option":
      if (reviewedAction.type !== "select_option") return draftAction;
      return {
        type: "select_option",
        config: {
          ...draftAction.config,
          value: stringReviewValue(reviewedAction.config.value, draftAction.config.value),
        },
      };
    case "scroll":
      if (reviewedAction.type !== "scroll") return draftAction;
      return {
        type: "scroll",
        config: {
          ...draftAction.config,
          pixels: finiteReviewNumber(reviewedAction.config.pixels, draftAction.config.pixels),
        },
      };
    case "upload_file":
      if (reviewedAction.type !== "upload_file") return draftAction;
      return {
        type: "upload_file",
        config: {
          ...draftAction.config,
          files: stringArrayReviewValue(reviewedAction.config.files),
        },
      };
    case "set_clipboard":
      if (reviewedAction.type !== "set_clipboard") return draftAction;
      return {
        type: "set_clipboard",
        config: {
          ...draftAction.config,
          text: stringReviewValue(reviewedAction.config.text, draftAction.config.text),
        },
      };
    default:
      return draftAction;
  }
}

function stringReviewValue(value: unknown, fallback: string) {
  return typeof value === "string" ? value : fallback;
}

function finiteReviewNumber(value: unknown, fallback: number | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function stringArrayReviewValue(value: unknown) {
  return Array.isArray(value)
    ? value.filter((entry): entry is string =>
        typeof entry === "string" && entry.trim().length > 0
      )
    : [];
}

function reviewedStepRecords(value: unknown): ReviewedRecordingStep[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is ReviewedRecordingStep =>
    Boolean(
      entry &&
        typeof entry === "object" &&
        typeof (entry as { id?: unknown }).id === "string",
    )
  );
}

function actionConfigOrNull(value: unknown): ActionConfig | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { type?: unknown; config?: unknown };
  return typeof candidate.type === "string" && "config" in candidate
    ? value as ActionConfig
    : null;
}
