import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { EvidencePage } from "../../types/workflow";
import { useEvidenceWorkspace } from "./useEvidenceWorkspace";
import {
  exportEvidenceBundle,
  getEvidenceDetail,
  getEvidenceScreenshotPreview,
  listEvidenceItems,
  revealEvidenceArtifact,
} from "../../lib/workflowApi";

vi.mock("../../lib/workflowApi", () => ({
  exportEvidenceBundle: vi.fn(),
  getEvidenceDetail: vi.fn(),
  getEvidenceScreenshotPreview: vi.fn(),
  listEvidenceItems: vi.fn(),
  revealEvidenceArtifact: vi.fn(),
}));

describe("useEvidenceWorkspace", () => {
  beforeEach(() => {
    vi.mocked(exportEvidenceBundle).mockReset();
    vi.mocked(getEvidenceDetail).mockReset();
    vi.mocked(getEvidenceScreenshotPreview).mockReset();
    vi.mocked(listEvidenceItems).mockReset();
    vi.mocked(revealEvidenceArtifact).mockReset();
  });

  test("loads an evidence page, selects the focused evidence, and loads detail", async () => {
    const setAppError = vi.fn();
    vi.mocked(listEvidenceItems).mockResolvedValue(evidencePage());
    vi.mocked(getEvidenceDetail).mockResolvedValue({
      item: evidencePage().items[1],
      payload: { kind: "evidence_manifest", rows: [] },
    });
    const { result } = renderHook(() => useEvidenceWorkspace({ setAppError }));

    await act(async () => {
      await result.current.loadEvidencePage({ focus_evidence_id: "evidence-2" });
    });

    expect(listEvidenceItems).toHaveBeenCalledWith({ focus_evidence_id: "evidence-2" });
    expect(getEvidenceDetail).toHaveBeenCalledWith("evidence-2");
    expect(result.current.page?.items.map((item) => item.evidence_id)).toEqual([
      "evidence-1",
      "evidence-2",
    ]);
    expect(result.current.selectedEvidenceId).toBe("evidence-2");
    expect(result.current.detail?.item.evidence_id).toBe("evidence-2");
    expect(result.current.preview).toBeNull();
    expect(setAppError).toHaveBeenLastCalledWith("");
  });

  test("updates screenshot preview and export result through evidence commands", async () => {
    vi.mocked(listEvidenceItems).mockResolvedValue(evidencePage());
    vi.mocked(getEvidenceDetail).mockResolvedValue({
      item: evidencePage().items[0],
      payload: { kind: "evidence_manifest", rows: [] },
    });
    vi.mocked(getEvidenceScreenshotPreview).mockResolvedValue({
      evidence_id: "evidence-1",
      mime_type: "image/png",
      base64_data: "abc",
      file_state: "available",
    });
    vi.mocked(exportEvidenceBundle).mockResolvedValue({
      bundle_dir: "/tmp/evidence",
      exported_count: 1,
      omitted_file_count: 0,
    });
    const { result } = renderHook(() => useEvidenceWorkspace({ setAppError: vi.fn() }));

    await act(async () => {
      await result.current.loadEvidencePage({});
      await result.current.previewEvidenceScreenshot("evidence-1");
      await result.current.exportSelectedEvidence(["evidence-1"]);
    });

    expect(getEvidenceScreenshotPreview).toHaveBeenCalledWith("evidence-1");
    expect(exportEvidenceBundle).toHaveBeenCalledWith({ evidence_ids: ["evidence-1"] });
    expect(result.current.preview?.base64_data).toBe("abc");
    expect(result.current.exportResult).toEqual({
      bundle_dir: "/tmp/evidence",
      exported_count: 1,
      omitted_file_count: 0,
    });
  });
});

function evidencePage(): EvidencePage {
  return {
    generated_at: "2026-05-27T12:00:00.000Z",
    items: [
      evidenceItem("evidence-1", "run-1"),
      evidenceItem("evidence-2", "run-2"),
    ],
    next_cursor: null,
    has_more: false,
    warnings: {
      skipped_artifacts: 0,
      skipped_reports: 0,
      skipped_traces: 0,
      skipped_manifests: 0,
    },
  };
}

function evidenceItem(evidenceId: string, runId: string): EvidencePage["items"][number] {
  return {
    evidence_id: evidenceId,
    kind: "evidence_manifest",
    label: evidenceId,
    created_at: "2026-05-27T12:00:00.000Z",
    run: {
      id: runId,
      status: "success",
      source: "manual",
      started_at: "2026-05-27T12:00:00.000Z",
      finished_at: "2026-05-27T12:00:01.000Z",
    },
    workflow: { id: "workflow-1", name: "Workflow" },
    identity: null,
    file_state: "available",
    navigation_targets: { workflow: true },
  };
}
