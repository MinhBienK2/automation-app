import { describe, expect, test } from "vitest";
import {
  buildEvidenceFilterSummary,
  buildEvidenceWarningText,
  evidenceSelectionLabel,
  fileStateLabel,
  labelForEvidenceKind,
  runSourceLabel,
  shouldShowEvidenceEmptyAsFiltered,
} from "./evidencePresentation";

describe("evidence presentation helpers", () => {
  test("labels evidence kinds, file states, sources, and selection counts", () => {
    expect(labelForEvidenceKind("browser_identity")).toBe("Browser Identity");
    expect(labelForEvidenceKind("action_trace")).toBe("Action Trace");
    expect(fileStateLabel("unchecked")).toBe("Not checked");
    expect(fileStateLabel("available")).toBe("Available");
    expect(fileStateLabel("unavailable")).toBe("Unavailable");
    expect(runSourceLabel("manual")).toBe("Manual");
    expect(runSourceLabel("schedule")).toBe("Schedule");
    expect(evidenceSelectionLabel(0)).toBe("Export Selection");
    expect(evidenceSelectionLabel(1)).toBe("Export 1 item");
    expect(evidenceSelectionLabel(3)).toBe("Export 3 items");
  });

  test("builds active filter summaries without exposing raw payloads", () => {
    expect(buildEvidenceFilterSummary({
      search: "checkout",
      types: ["screenshot"],
      run_id: "run-1",
      workflow_id: "workflow-1",
      identity_id: "bi_1",
      focus_evidence_id: "ev-1",
    })).toEqual([
      "Search: checkout",
      "Type: Screenshot",
      "Run: run-1",
      "Workflow: workflow-1",
      "Identity: bi_1",
      "Focused evidence: ev-1",
    ]);
  });

  test("combines page warnings and detects filtered empty states", () => {
    expect(buildEvidenceWarningText({
      skipped_artifacts: 1,
      skipped_reports: 2,
      skipped_traces: 0,
      skipped_manifests: 1,
    })).toBe("Skipped malformed evidence: 1 artifact, 2 reports, 1 manifest.");
    expect(shouldShowEvidenceEmptyAsFiltered({ search: "qa" })).toBe(true);
    expect(shouldShowEvidenceEmptyAsFiltered({ types: ["download"] })).toBe(true);
    expect(shouldShowEvidenceEmptyAsFiltered({})).toBe(false);
  });
});
