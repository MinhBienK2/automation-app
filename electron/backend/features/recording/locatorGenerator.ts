import type {
  ElementLocator,
  ElementTarget,
  RecordingLocatorCandidate,
  RecordingTarget,
  RecordingWarning,
} from "../../../../src/types/workflow.js";

export type LocatorGenerationResult = {
  target: ElementTarget;
  confidence: "high" | "medium" | "low";
  warnings: RecordingWarning[];
};

const LOCATOR_KIND_PRIORITY: Record<RecordingLocatorCandidate["kind"], number> = {
  test_id: 0,
  role: 1,
  label: 2,
  placeholder: 3,
  text: 4,
  attribute: 5,
  css: 6,
  xpath: 7,
};

export function generateElementTarget(
  recordingTarget: RecordingTarget | null,
): LocatorGenerationResult {
  const candidates = orderedCandidates(recordingTarget);
  const locators = candidates.map((candidate) =>
    locatorFromCandidate(candidate, recordingTarget),
  );
  const fallbackUsed = locators.length === 0;
  const target: ElementTarget = {
    locators: fallbackUsed
      ? [{ kind: "css", value: recordingTarget?.tag_name || "body" }]
      : locators,
    constraints: { visible: true, enabled: true },
    iframe: recordingTarget?.iframe
      ? generateElementTarget(recordingTarget.iframe).target
      : null,
  };
  const confidence = locatorConfidence(candidates, fallbackUsed);
  const warnings = confidence === "low"
    ? [{
        code: "weak_locator",
        message: "Generated locator is low confidence and should be reviewed before replay.",
        severity: "warning" as const,
      }]
    : [];
  return { target, confidence, warnings };
}

function orderedCandidates(recordingTarget: RecordingTarget | null) {
  return [...(recordingTarget?.locators ?? [])]
    .filter((candidate) => candidate.value.trim())
    .sort((left, right) => {
      const priority = LOCATOR_KIND_PRIORITY[left.kind] - LOCATOR_KIND_PRIORITY[right.kind];
      if (priority !== 0) return priority;
      return right.score - left.score;
    })
    .slice(0, 8);
}

function locatorFromCandidate(
  candidate: RecordingLocatorCandidate,
  recordingTarget: RecordingTarget | null,
): ElementLocator {
  if (candidate.kind === "role") {
    return {
      kind: "role",
      value:
        candidate.name ??
        recordingTarget?.accessible_name ??
        recordingTarget?.text_sample ??
        candidate.value,
      role: candidate.role ?? candidate.value,
      exact: true,
    };
  }
  if (
    candidate.kind === "label" ||
    candidate.kind === "placeholder" ||
    candidate.kind === "text"
  ) {
    return {
      kind: candidate.kind,
      value: candidate.value,
      exact: true,
    };
  }
  if (candidate.kind === "attribute") {
    return {
      kind: "attribute",
      value: candidate.value,
      attribute: candidate.attribute ?? "data-testid",
    };
  }
  return {
    kind: candidate.kind,
    value: candidate.value,
  };
}

function locatorConfidence(
  candidates: RecordingLocatorCandidate[],
  fallbackUsed: boolean,
): "high" | "medium" | "low" {
  if (fallbackUsed || !candidates.length) return "low";
  const first = candidates[0];
  if (first.score < 0.5 || first.kind === "css" || first.kind === "xpath") {
    return "low";
  }
  if (
    first.kind === "test_id" ||
    first.kind === "role" ||
    first.kind === "label" ||
    first.kind === "placeholder"
  ) {
    return "high";
  }
  return "medium";
}
