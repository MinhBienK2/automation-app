import type {
  MissionControlTarget,
  OperationsNavigationTarget,
  RunState,
  WorkflowGraph,
  WorkflowRunSnapshot,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../types/workflow";
import { initialRunState } from "./workflowUi";

export type GraphSaveStatus = "saved" | "unsaved" | "saving" | "failed" | "off";
export type WorkflowSettingsSaveStatus = "saved" | "unsaved" | "saving" | "failed";

const appSettingsStorageKey = "workflow-manager:settings:v1";

export function readGraphAutosaveEnabled() {
  try {
    const stored = window.localStorage.getItem(appSettingsStorageKey);
    if (!stored) return true;
    const parsed = JSON.parse(stored) as { graphAutosaveEnabled?: unknown };
    return typeof parsed.graphAutosaveEnabled === "boolean"
      ? parsed.graphAutosaveEnabled
      : true;
  } catch {
    return true;
  }
}

export function writeGraphAutosaveEnabled(enabled: boolean) {
  window.localStorage.setItem(
    appSettingsStorageKey,
    JSON.stringify({ graphAutosaveEnabled: enabled }),
  );
}

export function graphSaveStatusLabel(status: GraphSaveStatus) {
  switch (status) {
    case "saved":
      return "Saved";
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving...";
    case "failed":
      return "Autosave failed";
    case "off":
      return "Autosave off";
  }
}

export function graphEditableContentKey(graph: WorkflowGraph | null) {
  if (!graph) return "";
  return JSON.stringify({
    version: graph.version,
    nodes: graph.nodes,
    edges: graph.edges,
    migration_notes: graph.migration_notes ?? [],
  });
}

export function hasEditableGraphChange(
  currentGraph: WorkflowGraph | null,
  nextGraph: WorkflowGraph | null,
) {
  if (currentGraph === nextGraph) return false;
  if (!currentGraph || !nextGraph) {
    return graphEditableContentKey(currentGraph) !== graphEditableContentKey(nextGraph);
  }
  const sameMigrationNotes =
    currentGraph.migration_notes === nextGraph.migration_notes ||
    (!currentGraph.migration_notes && !nextGraph.migration_notes);
  if (
    currentGraph.version === nextGraph.version &&
    currentGraph.nodes === nextGraph.nodes &&
    currentGraph.edges === nextGraph.edges &&
    sameMigrationNotes
  ) {
    return false;
  }
  return graphEditableContentKey(currentGraph) !== graphEditableContentKey(nextGraph);
}

export function latestRunSnapshot(snapshots: WorkflowRunSnapshot[]) {
  return [...snapshots].sort((left, right) =>
    right.started_at.localeCompare(left.started_at),
  )[0] ?? null;
}

export function latestRunForWorkflow(
  snapshots: WorkflowRunSnapshot[],
  workflowId: string,
) {
  return latestRunSnapshot(
    snapshots.filter((snapshot) => snapshot.workflow_id === workflowId),
  );
}

export function idleRunStateWithRetainedSession(state: RunState): RunState {
  return { ...initialRunState, retained_session: state.retained_session };
}

export function legacyRunId(workflowId: string | null) {
  return `legacy-${workflowId ?? "run"}`;
}

export function operationsTargetToMissionTarget(
  target: OperationsNavigationTarget,
): MissionControlTarget {
  if (target.type === "workflow") {
    return {
      type: "workflow",
      workflow_id: target.workflow_id,
      ...(target.mode ? { mode: target.mode } : {}),
    };
  }
  if (target.type === "schedule") {
    return { type: "schedule", schedule_id: target.schedule_id };
  }
  return { type: "evidence", evidence_id: target.evidence_id };
}

export function formatMaintenanceBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(1)} KiB`;
  return `${(kib / 1024).toFixed(1)} MiB`;
}

export function todayOperationsRange() {
  const now = new Date();
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    day_start_utc: start.toISOString(),
    day_end_utc: end.toISOString(),
    timezone_label: Intl.DateTimeFormat().resolvedOptions().timeZone || "Local",
  };
}

export function settingsSaveStatuses(status: WorkflowSettingsSaveStatus) {
  return {
    general: status,
    run_policy: status,
    browser_launch: status,
    graph_defaults: status,
    environment: status,
  } satisfies Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>;
}

export function cloneWorkflowSettings(settings: WorkflowSettings) {
  return JSON.parse(JSON.stringify(settings)) as WorkflowSettings;
}

export function isWorkflowSettings(value: unknown): value is WorkflowSettings {
  return Boolean(
    value &&
      typeof value === "object" &&
      "workflow_id" in value &&
      "general" in value &&
      "browser_launch" in value,
  );
}
