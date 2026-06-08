import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { OperationsOverview } from "../../types/workflow";
import { getOperationsOverview } from "../../lib/workflowApi";
import { useOperationsOverviewWorkspace } from "./useOperationsOverviewWorkspace";

vi.mock("../../lib/workflowApi", () => ({
  getOperationsOverview: vi.fn(),
}));

describe("useOperationsOverviewWorkspace", () => {
  beforeEach(() => {
    vi.mocked(getOperationsOverview).mockReset();
  });

  test("loads the operations overview for the current local day", async () => {
    const setAppError = vi.fn();
    vi.mocked(getOperationsOverview).mockResolvedValue(overview());
    const { result } = renderHook(() =>
      useOperationsOverviewWorkspace({ setAppError }),
    );

    await act(async () => {
      await result.current.loadOperationsOverview();
    });

    expect(getOperationsOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        day_start_utc: expect.any(String),
        day_end_utc: expect.any(String),
      }),
    );
    expect(result.current.overview?.metrics.active_runs).toBe(1);
    expect(result.current.loading).toBe(false);
    expect(setAppError).toHaveBeenLastCalledWith("");
  });
});

function overview(): OperationsOverview {
  return {
    generated_at: "2026-06-01T12:00:00.000Z",
    range: {
      day_start_utc: "2026-06-01T00:00:00.000Z",
      day_end_utc: "2026-06-02T00:00:00.000Z",
      timezone_label: "UTC",
    },
    metrics: {
      active_runs: 1,
      succeeded_today: 2,
      attention_today: 0,
      upcoming_schedules: 1,
    },
    live_runs: { items: [], total: 0, has_more: false },
    attention: { items: [], total: 0, has_more: false },
    activity: [],
    recent_evidence: { items: [], total: 0, has_more: false },
    upcoming_schedules: { items: [], total: 0, has_more: false },
    data_warnings: { evidence_items_skipped: 0 },
  };
}
