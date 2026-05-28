import type {
  MissionControlTarget,
  OperationsNavigationTarget,
} from "../types/workflow";

export type MissionControlNavItemId =
  | "overview"
  | "workflows"
  | "runs"
  | "evidence"
  | "schedules"
  | "identities"
  | "settings";

export type AppScreenId =
  | "overview"
  | "list"
  | "detail"
  | "settings"
  | "schedules"
  | "runs"
  | "evidence"
  | "identities";

export type StaleTargetDescriptor = {
  targetType:
    | "workflow"
    | "run"
    | "evidence"
    | "schedule"
    | "identity"
    | "graph_issue";
  requestedId: string;
  source?:
    | "search"
    | "overview"
    | "runs"
    | "evidence"
    | "identity"
    | "schedule"
    | "alerts";
  message: string;
  fallbackActions: Array<"refresh" | "open_overview" | "open_list" | "clear_target">;
};

export const missionControlNavItems: Array<{
  id: MissionControlNavItemId;
  label: string;
  ariaLabel: string;
}> = [
  { id: "overview", label: "Overview", ariaLabel: "Overview" },
  { id: "workflows", label: "Workflows", ariaLabel: "Workflows" },
  { id: "runs", label: "Runs", ariaLabel: "Runs" },
  { id: "evidence", label: "Evidence", ariaLabel: "Evidence" },
  { id: "schedules", label: "Schedules", ariaLabel: "Schedules" },
  { id: "identities", label: "Identities", ariaLabel: "Identities" },
  { id: "settings", label: "Settings", ariaLabel: "Settings" },
];

export function activeItemFromScreen(screen: AppScreenId): MissionControlNavItemId {
  switch (screen) {
    case "settings":
      return "settings";
    case "schedules":
      return "schedules";
    case "runs":
      return "runs";
    case "evidence":
      return "evidence";
    case "identities":
      return "identities";
    case "overview":
      return "overview";
    case "list":
    case "detail":
      return "workflows";
  }
}

export function operationsTargetToMissionTarget(
  target: OperationsNavigationTarget,
): MissionControlTarget {
  if (target.type === "workflow") {
    return { type: "workflow", workflow_id: target.workflow_id };
  }
  if (target.type === "run") {
    return { type: "run", run_id: target.run_id };
  }
  if (target.type === "schedule") {
    return { type: "schedule", schedule_id: target.schedule_id };
  }
  return { type: "evidence", evidence_id: target.evidence_id };
}

export function createStaleTargetDescriptor(
  target: MissionControlTarget,
  source: StaleTargetDescriptor["source"],
  reason: string,
): StaleTargetDescriptor {
  const { targetType, requestedId } = staleTargetIdentity(target);
  return {
    targetType,
    requestedId,
    source,
    message: reason,
    fallbackActions: ["refresh", "open_list", "open_overview", "clear_target"],
  };
}

export function isInputLikeShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;
  const tagName = target.tagName.toLowerCase();
  if (["input", "textarea", "select"].includes(tagName)) return true;
  if (target.closest("[contenteditable='true']")) return true;
  if (target.closest("[role='dialog']")) return true;
  if (target.closest("[data-command-palette]")) return true;
  if (target.closest("[data-popover]")) return true;
  return false;
}

function staleTargetIdentity(target: MissionControlTarget): {
  targetType: StaleTargetDescriptor["targetType"];
  requestedId: string;
} {
  switch (target.type) {
    case "workflow":
      return { targetType: "workflow", requestedId: target.workflow_id };
    case "run":
      return { targetType: "run", requestedId: target.run_id };
    case "evidence":
      return { targetType: "evidence", requestedId: target.evidence_id ?? "filtered evidence" };
    case "identity":
      return { targetType: "identity", requestedId: target.target.identity_id };
    case "schedule":
      return {
        targetType: "schedule",
        requestedId: target.schedule_event_id ?? target.schedule_id ?? "schedule list",
      };
    case "graph_issue":
      return {
        targetType: "graph_issue",
        requestedId: target.issue_id ?? target.node_id ?? target.workflow_id,
      };
    case "overview":
      return { targetType: "workflow", requestedId: target.focus ?? "overview" };
  }
}
