// @vitest-environment jsdom

import { describe, expect, test, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import { RevisionHistoryDrawer } from "./RevisionHistoryDrawer";
import { workflowBridgeMock } from "../../../tests/mocks/electron";
import type { RevisionSummary, RevisionDetail } from "../../../types/workflow";

vi.mock("../../../lib/workflowApi", () => ({
  listWorkflowRevisions: (...args: unknown[]) => (workflowBridgeMock.listWorkflowRevisions as (...a: unknown[]) => unknown)(...args),
  listSubflowRevisions: (...args: unknown[]) => (workflowBridgeMock.listSubflowRevisions as (...a: unknown[]) => unknown)(...args),
  getWorkflowRevision: (...args: unknown[]) => (workflowBridgeMock.getWorkflowRevision as (...a: unknown[]) => unknown)(...args),
  getSubflowRevision: (...args: unknown[]) => (workflowBridgeMock.getSubflowRevision as (...a: unknown[]) => unknown)(...args),
  restoreWorkflowRevision: (...args: unknown[]) => (workflowBridgeMock.restoreWorkflowRevision as (...a: unknown[]) => unknown)(...args),
  restoreSubflowRevision: (...args: unknown[]) => (workflowBridgeMock.restoreSubflowRevision as (...a: unknown[]) => unknown)(...args),
  tagWorkflowRevision: (...args: unknown[]) => (workflowBridgeMock.tagWorkflowRevision as (...a: unknown[]) => unknown)(...args),
  tagSubflowRevision: (...args: unknown[]) => (workflowBridgeMock.tagSubflowRevision as (...a: unknown[]) => unknown)(...args),
  untagWorkflowRevision: (...args: unknown[]) => (workflowBridgeMock.untagWorkflowRevision as (...a: unknown[]) => unknown)(...args),
  untagSubflowRevision: (...args: unknown[]) => (workflowBridgeMock.untagSubflowRevision as (...a: unknown[]) => unknown)(...args),
  getWorkflowGraph: (...args: unknown[]) => (workflowBridgeMock.getWorkflowGraph as (...a: unknown[]) => unknown)(...args),
  getSubflowGraph: (...args: unknown[]) => (workflowBridgeMock.getSubflowGraph as (...a: unknown[]) => unknown)(...args),
}));

const sampleRevisions: RevisionSummary[] = [
  {
    id: "rev-3",
    revision_number: 3,
    created_at: "2025-06-29T10:00:00Z",
    created_by: null,
    comment: "Latest save",
    tag: null,
    size_bytes: 1024,
  },
  {
    id: "rev-2",
    revision_number: 2,
    created_at: "2025-06-28T10:00:00Z",
    created_by: "tester",
    comment: "Tagged release",
    tag: "release",
    size_bytes: 2048,
  },
  {
    id: "rev-1",
    revision_number: 1,
    created_at: "2025-06-27T10:00:00Z",
    created_by: null,
    comment: null,
    tag: null,
    size_bytes: 512,
  },
];

const sampleRevisionDetail: RevisionDetail = {
  ...sampleRevisions[1],
  graph_snapshot_json: JSON.stringify({ version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
  settings_snapshot_json: null,
};

const sampleGraph = { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } };

describe("RevisionHistoryDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    workflowBridgeMock.listWorkflowRevisions.mockResolvedValue(sampleRevisions);
    workflowBridgeMock.listSubflowRevisions.mockResolvedValue(sampleRevisions);
    workflowBridgeMock.getWorkflowRevision.mockResolvedValue(sampleRevisionDetail);
    workflowBridgeMock.getSubflowRevision.mockResolvedValue(sampleRevisionDetail);
    workflowBridgeMock.restoreWorkflowRevision.mockResolvedValue({
      restoredRevisionNumber: 2,
      capturedRevisionNumber: 4,
    });
    workflowBridgeMock.restoreSubflowRevision.mockResolvedValue({
      restoredRevisionNumber: 2,
      capturedRevisionNumber: 4,
    });
    workflowBridgeMock.tagWorkflowRevision.mockResolvedValue(undefined);
    workflowBridgeMock.tagSubflowRevision.mockResolvedValue(undefined);
    workflowBridgeMock.untagWorkflowRevision.mockResolvedValue(undefined);
    workflowBridgeMock.untagSubflowRevision.mockResolvedValue(undefined);
    workflowBridgeMock.getWorkflowGraph.mockResolvedValue(sampleGraph);
    workflowBridgeMock.getSubflowGraph.mockResolvedValue(sampleGraph);
  });

  test("does not render when closed", () => {
    render(
      <RevisionHistoryDrawer
        open={false}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );
    expect(screen.queryByLabelText("Revision history drawer")).toBeNull();
  });

  test("loads and displays revisions when open", async () => {
    render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("#3")).toBeTruthy();
    });
    expect(screen.getByText("#2")).toBeTruthy();
    expect(screen.getByText("#1")).toBeTruthy();
    expect(screen.getByText("Tagged release")).toBeTruthy();
    expect(screen.getByText("release")).toBeTruthy();
  });

  test("shows empty state when no revisions exist", async () => {
    workflowBridgeMock.listWorkflowRevisions.mockResolvedValue([]);

    render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText(/No backups yet/)).toBeTruthy();
    });
  });

  test("shows error when loading fails", async () => {
    workflowBridgeMock.listWorkflowRevisions.mockRejectedValue(new Error("DB error"));

    render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("DB error")).toBeTruthy();
    });
  });

  test("opens restore confirmation dialog when Restore clicked", async () => {
    render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("#2")).toBeTruthy();
    });

    const restoreButtons = screen.getAllByRole("button", { name: /Restore/ });
    fireEvent.click(restoreButtons[0]);

    await waitFor(() => {
      expect(screen.getByText(/Restore Revision #/)).toBeTruthy();
    });
  });

  test("confirms restore and calls onRestore with the graph", async () => {
    const onRestore = vi.fn();

    const { container } = render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={onRestore}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("#3")).toBeTruthy();
    });

    const restoreButtons = container.querySelectorAll(".revision-actions button");
    const restoreBtn = Array.from(restoreButtons).find(
      (btn) => {
        const el = btn as HTMLButtonElement;
        return el.textContent?.includes("Restore") && !el.disabled;
      },
    ) as HTMLButtonElement | undefined;
    expect(restoreBtn).toBeTruthy();
    fireEvent.click(restoreBtn!);

    await waitFor(() => {
      expect(screen.getByText(/Restore Revision #/)).toBeTruthy();
    });

    const dialog = screen.getByText(/Restore Revision #/).closest("[role='dialog']") ?? document.body;
    const confirmButtons = within(dialog as HTMLElement).getAllByRole("button", { name: "Restore" });
    const confirmBtn = confirmButtons.find((b) => !(b as HTMLButtonElement).disabled);
    expect(confirmBtn).toBeTruthy();
    fireEvent.click(confirmBtn!);

    await waitFor(() => {
      expect(workflowBridgeMock.restoreWorkflowRevision).toHaveBeenCalledWith(
        "wf-1",
        "rev-3",
        expect.objectContaining({ comment: expect.stringContaining("Restored revision") }),
      );
    });

    await waitFor(() => {
      expect(onRestore).toHaveBeenCalledWith(sampleGraph);
    });
  });

  test("tags a revision", async () => {
    const { container } = render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("#3")).toBeTruthy();
    });

    const tagInputs = container.querySelectorAll(".revision-tag-input input");
    expect(tagInputs.length).toBeGreaterThan(0);
    fireEvent.change(tagInputs[0], { target: { value: "milestone" } });

    const tagButtons = container.querySelectorAll(".revision-tag-input button");
    fireEvent.click(tagButtons[0]);

    await waitFor(() => {
      expect(workflowBridgeMock.tagWorkflowRevision).toHaveBeenCalledWith("rev-3", "milestone");
    });
  });

  test("untags a tagged revision", async () => {
    const { container } = render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="wf-1"
        ownerKind="workflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("release")).toBeTruthy();
    });

    const untagButtons = Array.from(container.querySelectorAll("button")).filter(
      (btn) => btn.textContent?.includes("Untag"),
    );
    expect(untagButtons.length).toBeGreaterThan(0);
    fireEvent.click(untagButtons[0]);

    await waitFor(() => {
      expect(workflowBridgeMock.untagWorkflowRevision).toHaveBeenCalledWith("rev-2");
    });
  });

  test("uses subflow API when ownerKind is subflow", async () => {
    render(
      <RevisionHistoryDrawer
        open={true}
        ownerId="sf-1"
        ownerKind="subflow"
        onClose={vi.fn()}
        onRestore={vi.fn()}
      />,
    );

    await waitFor(() => {
      expect(workflowBridgeMock.listSubflowRevisions).toHaveBeenCalledWith("sf-1", { limit: 100, onlyBackups: true });
    });
  });
});
