import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type {
  EvidenceDetail,
  EvidenceKind,
  EvidenceListItem,
  EvidencePage,
} from "../../../types/workflow";
import { EvidenceExplorerPage } from "./EvidenceExplorerPage";

describe("EvidenceExplorerPage", () => {
  test("renders loading, empty, filtered empty, and focused unavailable states", () => {
    const { rerender } = renderEvidence({ page: null, loading: true });
    expect(screen.getByRole("heading", { name: "Loading evidence" })).toBeInTheDocument();

    rerender(renderEvidenceElement({ page: evidencePage([]), loading: false }));
    expect(screen.getByRole("heading", { name: "No evidence recorded yet" })).toBeInTheDocument();

    rerender(renderEvidenceElement({
      page: evidencePage([]),
      query: { search: "missing" },
      loading: false,
    }));
    expect(screen.getByRole("heading", { name: "No evidence matches these filters" }))
      .toBeInTheDocument();
    expect(screen.getByText("Search: missing")).toBeInTheDocument();

    rerender(renderEvidenceElement({
      page: evidencePage([]),
      query: { focus_evidence_id: "ev-missing" },
      loading: false,
    }));
    expect(screen.getByRole("heading", { name: "Focused evidence unavailable" }))
      .toBeInTheDocument();
    expect(screen.getByText("Focused evidence: ev-missing")).toBeInTheDocument();
  });

  test("updates search and type filters while resetting cursor", async () => {
    const onQueryChange = vi.fn();
    renderEvidence({
      query: { cursor: "cursor-2", run_id: "run-1" },
      onQueryChange,
    });

    await userEvent.type(screen.getByRole("searchbox", { name: "Search evidence" }), "qa");
    expect(onQueryChange).toHaveBeenLastCalledWith({
      cursor: null,
      run_id: "run-1",
      search: "qa",
    });

    await userEvent.selectOptions(screen.getByLabelText("Evidence type"), "download");
    expect(onQueryChange).toHaveBeenLastCalledWith({
      cursor: null,
      run_id: "run-1",
      types: ["download"],
    });
  });

  test("toggles list and grid result modes", async () => {
    renderEvidence();

    expect(screen.getByRole("list", { name: "Evidence result list" }))
      .toHaveClass("evidence-list");
    await userEvent.click(screen.getByRole("button", { name: "Grid view" }));
    expect(screen.getByRole("list", { name: "Evidence result grid" }))
      .toHaveClass("evidence-grid");
  });

  test("keeps export selection independent from detail selection and prunes missing ids", async () => {
    const onSelectEvidence = vi.fn();
    const onExportSelection = vi.fn();
    const { rerender } = renderEvidence({
      onSelectEvidence,
      onExportSelection,
      page: evidencePage([screenshotItem(), actionTraceItem()]),
    });

    await userEvent.click(screen.getByRole("checkbox", { name: "Select Login screenshot" }));
    expect(onSelectEvidence).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Export 1 item" })).toBeEnabled();
    await userEvent.click(screen.getByRole("button", { name: "Export 1 item" }));
    expect(onExportSelection).toHaveBeenCalledWith(["ev-shot"]);

    await userEvent.click(screen.getByRole("button", { name: /Action trace/ }));
    expect(onSelectEvidence).toHaveBeenCalledWith("ev-trace");

    rerender(renderEvidenceElement({
      page: evidencePage([actionTraceItem()]),
      onSelectEvidence,
      onExportSelection,
    }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Export Selection" })).toBeDisabled();
    });
  });

  test("shows active filters, page warnings, pagination, and bounded export result", () => {
    renderEvidence({
      page: {
        ...evidencePage([screenshotItem()]),
        has_more: true,
        next_cursor: "cursor-next",
        warnings: {
          skipped_artifacts: 1,
          skipped_reports: 1,
          skipped_traces: 1,
          skipped_manifests: 1,
        },
      },
      query: {
        search: "login",
        run_id: "run-1",
        workflow_id: "workflow-1",
        identity_id: "bi_1",
        types: ["screenshot"],
      },
      exportResult: {
        bundle_dir: "/tmp/absolute/path",
        exported_count: 2,
        omitted_file_count: 1,
      },
    });

    expect(screen.getByText("Search: login")).toBeInTheDocument();
    expect(screen.getByText("Run: run-1")).toBeInTheDocument();
    expect(screen.getByText("Skipped malformed evidence: 1 artifact, 1 report, 1 trace, 1 manifest."))
      .toBeInTheDocument();
    expect(screen.getByText("More evidence is available. Refine filters or load the next page when pagination is enabled."))
      .toBeInTheDocument();
    expect(screen.getByText("Evidence bundle exported: 2 items, 1 omitted file."))
      .toBeInTheDocument();
    expect(screen.queryByText("/tmp/absolute/path")).not.toBeInTheDocument();
  });

  test("renders screenshot detail with preview and artifact actions", async () => {
    const onPreviewScreenshot = vi.fn();
    const onRevealArtifact = vi.fn();
    const onNavigate = vi.fn();
    renderEvidence({
      detail: screenshotDetail(),
      preview: {
        evidence_id: "ev-shot",
        mime_type: "image/png",
        base64_data: "cG5n",
        file_state: "available",
      },
      onPreviewScreenshot,
      onRevealArtifact,
      onNavigate,
    });

    const detail = screen.getByRole("region", { name: "Evidence detail" });
    expect(within(detail).getByText("Screenshot")).toBeInTheDocument();
    expect(within(detail).getByText("Available")).toBeInTheDocument();
    expect(within(detail).getByRole("img", { name: "Login screenshot" }))
      .toHaveAttribute("src", "data:image/png;base64,cG5n");

    await userEvent.click(within(detail).getByRole("button", { name: "Preview screenshot" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Reveal in Folder" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Run" }));

    expect(onPreviewScreenshot).toHaveBeenCalledWith("ev-shot");
    expect(onRevealArtifact).toHaveBeenCalledWith("ev-shot");
    expect(onNavigate).toHaveBeenCalledWith({ type: "run", run_id: "run-1" });
  });

  test("renders download detail without previewing arbitrary files", () => {
    renderEvidence({ detail: downloadDetail(), selectedEvidenceId: "ev-download" });

    const detail = screen.getByRole("region", { name: "Evidence detail" });
    expect(within(detail).getByText("Download")).toBeInTheDocument();
    expect(within(detail).getByText("42 KB")).toBeInTheDocument();
    expect(within(detail).getByRole("button", { name: "Reveal in Folder" }))
      .toBeInTheDocument();
    expect(within(detail).queryByRole("button", { name: "Preview screenshot" }))
      .not.toBeInTheDocument();
  });

  test("renders browser identity detail safely and opens historical identity context", async () => {
    const onOpenIdentity = vi.fn();
    renderEvidence({
      detail: browserIdentityDetail(),
      selectedEvidenceId: "ev-identity",
      onOpenIdentity,
    });

    const detail = screen.getByRole("region", { name: "Evidence detail" });
    expect(within(detail).getByText("fingerprint_seed_hash")).toBeInTheDocument();
    expect(within(detail).getByText("safe-hash")).toBeInTheDocument();
    expect(within(detail).queryByText("proxy_password")).not.toBeInTheDocument();
    expect(within(detail).queryByText("super-secret")).not.toBeInTheDocument();

    await userEvent.click(within(detail).getByRole("button", { name: "Open Identity" }));
    expect(onOpenIdentity).toHaveBeenCalledWith({
      type: "historical",
      identity_id: "bi_1",
      workflow_id: "workflow-1",
      run_id: "run-1",
      evidence_id: "ev-identity",
    });
  });

  test("renders action traces and manifests as bounded typed payloads", () => {
    const { rerender } = renderEvidence({
      detail: actionTraceDetail(),
      selectedEvidenceId: "ev-trace",
    });

    const detail = screen.getByRole("region", { name: "Evidence detail" });
    expect(within(detail).getByText("Trace 1")).toBeInTheDocument();
    expect(within(detail).getByText("click / failed")).toBeInTheDocument();
    expect(within(detail).getByText("Showing first trace entries only.")).toBeInTheDocument();
    expect(within(detail).queryByText("raw_cookie")).not.toBeInTheDocument();

    rerender(renderEvidenceElement({
      detail: manifestDetail(),
      selectedEvidenceId: "ev-manifest",
    }));
    expect(screen.getByRole("columnheader", { name: "Output" })).toBeInTheDocument();
    expect(screen.getByText("fingerprint_seed_hash")).toBeInTheDocument();
    expect(screen.getByText("redacted")).toBeInTheDocument();
  });
});

function renderEvidence(overrides: Partial<EvidenceProps> = {}) {
  return render(renderEvidenceElement(overrides));
}

type EvidenceProps = Parameters<typeof EvidenceExplorerPage>[0];

function renderEvidenceElement(overrides: Partial<EvidenceProps> = {}) {
  const detail = overrides.detail ?? screenshotDetail();
  const selectedEvidenceId = overrides.selectedEvidenceId ?? detail?.item.evidence_id ?? "ev-shot";
  const page = overrides.page ?? evidencePage([
    screenshotItem(),
    actionTraceItem(),
  ]);
  return (
    <EvidenceExplorerPage
      page={page}
      detail={detail}
      preview={overrides.preview ?? null}
      loading={overrides.loading ?? false}
      detailLoading={overrides.detailLoading ?? false}
      error={overrides.error ?? ""}
      detailError={overrides.detailError ?? ""}
      query={overrides.query ?? {}}
      selectedEvidenceId={selectedEvidenceId}
      exportResult={overrides.exportResult ?? null}
      onQueryChange={overrides.onQueryChange ?? vi.fn()}
      onRefresh={overrides.onRefresh ?? vi.fn()}
      onSelectEvidence={overrides.onSelectEvidence ?? vi.fn()}
      onPreviewScreenshot={overrides.onPreviewScreenshot ?? vi.fn()}
      onRevealArtifact={overrides.onRevealArtifact ?? vi.fn()}
      onExportSelection={overrides.onExportSelection ?? vi.fn()}
      onNavigate={overrides.onNavigate ?? vi.fn()}
      onOpenIdentity={overrides.onOpenIdentity ?? vi.fn()}
    />
  );
}

function evidencePage(items: EvidenceListItem[]): EvidencePage {
  return {
    generated_at: "2026-05-29T10:00:00.000Z",
    items,
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

function evidenceItem({
  evidence_id = "ev-shot",
  kind = "screenshot",
  label = "Login screenshot",
  relative_path = "runs/run-1/screenshots/001-login.png",
  file_state = "available",
}: {
  evidence_id?: string;
  kind?: EvidenceKind;
  label?: string;
  relative_path?: string | null;
  file_state?: EvidenceListItem["file_state"];
} = {}): EvidenceListItem {
  return {
    evidence_id,
    kind,
    label,
    created_at: "2026-05-29T10:01:00.000Z",
    run: {
      id: "run-1",
      status: "success",
      source: "manual",
      started_at: "2026-05-29T10:00:00.000Z",
      finished_at: "2026-05-29T10:02:00.000Z",
    },
    workflow: { id: "workflow-1", name: "Login flow" },
    identity: { id: "bi_1", display_name: "QA identity" },
    node_id: "node-1",
    step_number: 1,
    relative_path,
    file_state,
    navigation_targets: { run: true, workflow: true },
  };
}

function screenshotItem() {
  return evidenceItem();
}

function actionTraceItem() {
  return evidenceItem({
    evidence_id: "ev-trace",
    kind: "action_trace",
    label: "Action trace",
    relative_path: null,
    file_state: "unchecked",
  });
}

function screenshotDetail(): EvidenceDetail {
  return {
    item: screenshotItem(),
    payload: {
      kind: "screenshot",
      artifact_kind: "screenshot",
      relative_path: "runs/run-1/screenshots/001-login.png",
      file_state: "available",
    },
  };
}

function downloadDetail(): EvidenceDetail {
  const item = evidenceItem({
    evidence_id: "ev-download",
    kind: "download",
    label: "Report download",
    relative_path: "runs/run-1/downloads/report.csv",
  });
  return {
    item,
    payload: {
      kind: "download",
      artifact_kind: "download",
      relative_path: "runs/run-1/downloads/report.csv",
      file_state: "available",
      size_bytes: 42 * 1024,
    },
  };
}

function browserIdentityDetail(): EvidenceDetail {
  const item = evidenceItem({
    evidence_id: "ev-identity",
    kind: "browser_identity",
    label: "Browser identity",
    relative_path: null,
    file_state: "unchecked",
  });
  return {
    item,
    payload: {
      kind: "browser_identity",
      fields: [
        { key: "fingerprint_seed_hash", value: "safe-hash" },
        { key: "timezone_source", value: "geoip" },
        { key: "proxy_password", value: "super-secret" },
      ],
    },
  };
}

function actionTraceDetail(): EvidenceDetail {
  return {
    item: actionTraceItem(),
    payload: {
      kind: "action_trace",
      has_more: true,
      entries: [
        {
          label: "Trace 1",
          node_id: "node-1",
          action_type: "click",
          status: "failed",
          failure_reason: "Element not found",
          raw_cookie: "secret",
        },
      ],
    },
  };
}

function manifestDetail(): EvidenceDetail {
  const item = evidenceItem({
    evidence_id: "ev-manifest",
    kind: "evidence_manifest",
    label: "Evidence manifest",
    relative_path: null,
    file_state: "unchecked",
  });
  return {
    item,
    payload: {
      kind: "evidence_manifest",
      rows: [
        {
          key: "fingerprint_seed_hash",
          category: "browser_identity",
          approximate_bytes: 120,
          redacted: true,
          truncated: false,
        },
      ],
    },
  };
}
