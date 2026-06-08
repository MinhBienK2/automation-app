import { useState } from "react";
import type {
  EvidenceBundleExportResult,
  EvidenceDetail,
  EvidenceListRequest,
  EvidencePage,
  EvidenceScreenshotPreview,
} from "../../types/workflow";
import {
  exportEvidenceBundle,
  getEvidenceDetail,
  getEvidenceScreenshotPreview,
  listEvidenceItems,
  revealEvidenceArtifact,
} from "../../lib/workflowApi";
import { commandMessage } from "../../lib/workflowUi";

export function useEvidenceWorkspace({
  setAppError,
}: {
  setAppError: (message: string) => void;
}) {
  const [page, setPage] = useState<EvidencePage | null>(null);
  const [query, setQuery] = useState<EvidenceListRequest>({});
  const [loading, setLoading] = useState(false);
  const [selectedEvidenceId, setSelectedEvidenceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EvidenceDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [preview, setPreview] = useState<EvidenceScreenshotPreview | null>(null);
  const [exportResult, setExportResult] = useState<EvidenceBundleExportResult>(null);

  async function loadEvidencePage(nextQuery: EvidenceListRequest = query) {
    setLoading(true);
    try {
      const nextPage = await listEvidenceItems(nextQuery);
      setPage(nextPage);
      setQuery(nextQuery);
      setAppError("");
      const nextSelected =
        nextQuery.focus_evidence_id ??
        (selectedEvidenceId && nextPage.items.some((item) => item.evidence_id === selectedEvidenceId)
          ? selectedEvidenceId
          : nextPage.items[0]?.evidence_id ?? null);
      setSelectedEvidenceId(nextSelected);
      if (nextSelected) {
        await loadEvidenceDetail(nextSelected);
      } else {
        setDetail(null);
        setPreview(null);
      }
    } catch (error) {
      setAppError(commandMessage(error));
    } finally {
      setLoading(false);
    }
  }

  async function loadEvidenceDetail(evidenceId: string) {
    setDetailLoading(true);
    setDetailError("");
    try {
      setDetail(await getEvidenceDetail(evidenceId));
      setPreview(null);
    } catch (error) {
      setDetail(null);
      setDetailError(commandMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }

  function updateEvidenceQuery(nextQuery: EvidenceListRequest) {
    setQuery(nextQuery);
    void loadEvidencePage(nextQuery);
  }

  function selectEvidence(evidenceId: string) {
    setSelectedEvidenceId(evidenceId);
    void loadEvidenceDetail(evidenceId);
  }

  async function previewEvidenceScreenshot(evidenceId: string) {
    setDetailError("");
    try {
      setPreview(await getEvidenceScreenshotPreview(evidenceId));
    } catch (error) {
      setPreview(null);
      setDetailError(commandMessage(error));
    }
  }

  async function revealEvidence(evidenceId: string) {
    setDetailError("");
    try {
      await revealEvidenceArtifact(evidenceId);
    } catch (error) {
      setDetailError(commandMessage(error));
    }
  }

  async function exportSelectedEvidence(evidenceIds: string[]) {
    setDetailError("");
    try {
      setExportResult(await exportEvidenceBundle({ evidence_ids: evidenceIds }));
    } catch (error) {
      setDetailError(commandMessage(error));
    }
  }

  return {
    page,
    query,
    loading,
    selectedEvidenceId,
    detail,
    detailLoading,
    detailError,
    preview,
    exportResult,
    loadEvidencePage,
    loadEvidenceDetail,
    updateEvidenceQuery,
    selectEvidence,
    previewEvidenceScreenshot,
    revealEvidence,
    exportSelectedEvidence,
    setDetailError,
  };
}
