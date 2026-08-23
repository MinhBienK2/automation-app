import { renderHook, act } from "@testing-library/react";
import { describe, expect, test, vi, beforeEach } from "vitest";
import { useWorkflowGraphState } from "./useWorkflowGraphState";
import type { WorkflowGraphStateDeps } from "./useWorkflowGraphState";
import { saveWorkflowGraph } from "../../../lib/api/workflowApi";

vi.mock("../../../lib/api/workflowApi", () => ({
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
      getDetail: () => detail,
      graphAutosaveEnabled: false,
      setGraphAutosaveEnabled: vi.fn(),
      setAppError: vi.fn(),
      loadWorkflows: vi.fn(),
    };

    const { result } = renderHook(() => useWorkflowGraphState(deps));

    act(() => {
      result.current.setWorkflowGraph(graph);
    });

    await act(async () => {
      await result.current.saveGraph({ comment: "Manual backup 1" });
    });

    expect(mockSave).toHaveBeenCalledWith("wf-1", graph, { comment: "Manual backup 1" });
  });
});
