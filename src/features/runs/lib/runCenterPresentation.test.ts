import { describe, expect, test } from "vitest";
import type { WorkflowRunSnapshot } from "../../../types/workflow";
import { initialRunState } from "../../../lib/workflowUi";
import {
  buildRunCenterSummary,
  compactRunIssueSummary,
  runSourceLabel,
  runStatusTone,
  sortRunSnapshotsByStartedAt,
} from "./runCenterPresentation";

describe("run center presentation helpers", () => {
  test("summarizes active and session run counts", () => {
    expect(buildRunCenterSummary([
      runSnapshot({ run_id: "run-1", status: "running" }),
      runSnapshot({ run_id: "run-2", status: "failed" }),
      runSnapshot({ run_id: "run-3", status: "running" }),
    ])).toEqual({
      activeCount: 2,
      sessionCount: 3,
      activeLabel: "2 active",
      sessionLabel: "3 session runs",
    });
  });

  test("sorts newest session runs first without mutating input", () => {
    const older = runSnapshot({
      run_id: "older",
      started_at: "2026-05-29T10:00:00.000Z",
    });
    const newer = runSnapshot({
      run_id: "newer",
      started_at: "2026-05-29T10:02:00.000Z",
    });
    const input = [older, newer];

    expect(sortRunSnapshotsByStartedAt(input).map((run) => run.run_id))
      .toEqual(["newer", "older"]);
    expect(input.map((run) => run.run_id)).toEqual(["older", "newer"]);
  });

  test("keeps issue summaries bounded to the first readable line", () => {
    const reason = [
      "page.goto: net::ERR_NAME_NOT_RESOLVED at https://owned.example.test/path/abcdefghijklmnopqrstuvwxyz0123456789",
      "Call log:",
      "  - raw browser trace output",
    ].join("\n");

    const summary = compactRunIssueSummary(reason);

    expect(summary).toMatch(/^page\.goto: net::ERR_NAME_NOT_RESOLVED/);
    expect(summary).not.toContain("Call log");
    expect(summary).not.toContain("raw browser trace output");
    expect(summary.length).toBeLessThanOrEqual(90);
  });

  test("labels sources and status tones without relying on color alone", () => {
    expect(runSourceLabel("manual")).toBe("Manual");
    expect(runSourceLabel("schedule")).toBe("Schedule");
    expect(runStatusTone(runSnapshot({ status: "running" }))).toBe("active");
    expect(runStatusTone(runSnapshot({ status: "failed" }))).toBe("danger");
    expect(runStatusTone(runSnapshot({ status: "success" }))).toBe("neutral");
  });
});

function runSnapshot({
  run_id = "run-1",
  workflow_id = "workflow-1",
  workflow_name = "Login flow",
  source = "manual",
  started_at = "2026-05-29T10:00:00.000Z",
  status = "idle",
}: Partial<WorkflowRunSnapshot> & {
  status?: WorkflowRunSnapshot["state"]["status"];
} = {}): WorkflowRunSnapshot {
  const state = {
    ...initialRunState,
    status,
  };
  return {
    ...state,
    run_id,
    workflow_id,
    workflow_name,
    source,
    started_at,
    state,
  };
}
