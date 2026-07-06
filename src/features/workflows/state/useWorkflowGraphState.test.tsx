import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useWorkflowGraphState } from "./useWorkflowGraphState";
import type { WorkflowGraphStateDeps } from "./useWorkflowGraphState";
import { saveWorkflowGraph } from "../../../lib/workflowApi";

vi.mock("../../../lib/workflowApi", () => ({
  saveWorkflowGraph: vi.fn(),
  validateWorkflowGraph: vi.fn(),
}));

describe("useWorkflowGraphState", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("saveGraph saves and creates a revision even if graph is not modified, when backup options (comment/tag) are provided", async () => {
    const mockSave = saveWorkflowGraph as any;
    mockSave.mockResolvedValue(true);

    const detail = {
      workflow: { id: "wf-1", name: "My Workflow" },
    } as any;
    const graph = { nodes: [], edges: [], version: 2 } as any;

    const deps: WorkflowGraphStateDeps = {
      detail,
      workflowGraph: graph,
      setWorkflowGraph: vi.fn(),
      graphAutosaveEnabled: false,
      setGraphAutosaveEnabled: vi.fn(),
      graphSaveStatus: "saved",
      setGraphSaveStatus: vi.fn(),
      graphRevision: 1,
      setGraphRevision: vi.fn(),
      savedGraphRevision: 1,
      setSavedGraphRevision: vi.fn(),
      graphIssues: [],
      setGraphIssues: vi.fn(),
      selectedGraphNodeId: null,
      setSelectedGraphNodeId: vi.fn(),
      setAppError: vi.fn(),
      loadWorkflows: vi.fn(),
      graphIssuesNeedRecheck: false,
      setGraphIssuesNeedRecheck: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowGraphState(deps));

    await act(async () => {
      await result.current.saveGraph({ comment: "Manual backup 1" });
    });

    expect(mockSave).toHaveBeenCalledWith("wf-1", graph, { comment: "Manual backup 1" });
  });
});
