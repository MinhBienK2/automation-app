import { act, renderHook } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { useGraphExitNavigation } from "./useGraphExitNavigation";

describe("useGraphExitNavigation", () => {
  test("runs clean navigation immediately without opening the confirmation dialog", async () => {
    const navigation = vi.fn();
    const { result } = renderHook(() =>
      useGraphExitNavigation({
        workflow: workflowExitState({ active: false }),
        subflow: subflowExitState({ active: false }),
      }),
    );

    await expect(result.current.requestGraphExitNavigation(navigation)).resolves.toBe(true);

    expect(navigation).toHaveBeenCalledOnce();
    expect(result.current.graphExitDialogOpen).toBe(false);
  });

  test("saves pending workflow graph changes before continuing deferred navigation", async () => {
    const navigation = vi.fn();
    const persistCurrentGraph = vi.fn(async () => true);
    const { result } = renderHook(() =>
      useGraphExitNavigation({
        workflow: workflowExitState({
          active: true,
          graphAutosaveEnabled: false,
          graphRevision: 3,
          savedGraphRevision: 2,
          persistCurrentGraph,
        }),
        subflow: subflowExitState({ active: false }),
      }),
    );

    await act(async () => {
      await expect(result.current.requestGraphExitNavigation(navigation)).resolves.toBe(false);
    });
    expect(result.current.graphExitDialogOpen).toBe(true);
    expect(navigation).not.toHaveBeenCalled();

    await act(async () => {
      await expect(result.current.saveGraphExitChangesAndNavigate()).resolves.toBe(true);
    });

    expect(persistCurrentGraph).toHaveBeenCalledOnce();
    expect(navigation).toHaveBeenCalledOnce();
    expect(result.current.graphExitDialogOpen).toBe(false);
  });

  test("discarding pending graph changes marks the active graph clean before continuing", async () => {
    const navigation = vi.fn();
    const discardWorkflowGraph = vi.fn();
    const discardSubflowGraph = vi.fn();
    const { result } = renderHook(() =>
      useGraphExitNavigation({
        workflow: workflowExitState({
          active: true,
          graphAutosaveEnabled: false,
          graphRevision: 5,
          savedGraphRevision: 4,
          discardWorkflowGraph,
        }),
        subflow: subflowExitState({
          active: false,
          graphSaveStatus: "unsaved",
          discardSubflowGraph,
        }),
      }),
    );

    await act(async () => {
      await result.current.requestGraphExitNavigation(navigation);
    });
    act(() => {
      result.current.discardGraphExitChangesAndNavigate();
    });

    expect(discardWorkflowGraph).toHaveBeenCalledWith({
      savedGraphRevision: 5,
      graphSaveStatus: "off",
    });
    expect(discardSubflowGraph).not.toHaveBeenCalled();
    expect(navigation).toHaveBeenCalledOnce();
  });
});

function workflowExitState(overrides: Partial<Parameters<typeof useGraphExitNavigation>[0]["workflow"]> = {}) {
  return {
    active: true,
    graphAutosaveEnabled: false,
    graphSaveStatus: "saved" as const,
    graphRevision: 1,
    savedGraphRevision: 1,
    persistCurrentGraph: vi.fn(async () => true),
    discardWorkflowGraph: vi.fn(),
    ...overrides,
  };
}

function subflowExitState(overrides: Partial<Parameters<typeof useGraphExitNavigation>[0]["subflow"]> = {}) {
  return {
    active: false,
    graphSaveStatus: "saved" as const,
    saveCurrentSubflowGraph: vi.fn(async () => true),
    discardSubflowGraph: vi.fn(),
    ...overrides,
  };
}
