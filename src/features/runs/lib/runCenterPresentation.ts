import type {
  WorkflowRunSnapshot,
  WorkflowRunSource,
} from "../../../types/workflow";

export type RunStatusTone = "active" | "danger" | "neutral";

export function buildRunCenterSummary(runSnapshots: WorkflowRunSnapshot[]) {
  const activeCount = runSnapshots.filter((run) => run.state.status === "running").length;
  const sessionCount = runSnapshots.length;
  return {
    activeCount,
    sessionCount,
    activeLabel: `${activeCount} active`,
    sessionLabel: `${sessionCount} session ${sessionCount === 1 ? "run" : "runs"}`,
  };
}

export function sortRunSnapshotsByStartedAt(runSnapshots: WorkflowRunSnapshot[]) {
  return [...runSnapshots].sort((left, right) => compareDateDesc(left.started_at, right.started_at));
}

export function compactRunIssueSummary(reason: string, maxLength = 90) {
  const firstLine = reason
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? reason.trim();
  if (!firstLine) return "-";
  if (firstLine.length <= maxLength) return firstLine;
  return `${firstLine.slice(0, Math.max(0, maxLength - 3))}...`;
}

export function runSourceLabel(source: WorkflowRunSource) {
  if (source === "manual") return "Manual";
  return "Schedule";
}

export function runStatusTone(run: WorkflowRunSnapshot): RunStatusTone {
  if (run.state.status === "running") return "active";
  if (run.state.status === "failed") return "danger";
  return "neutral";
}

export function formatRunDateTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function compareDateDesc(left: string, right: string) {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime)) {
    return rightTime - leftTime;
  }
  return right.localeCompare(left);
}
