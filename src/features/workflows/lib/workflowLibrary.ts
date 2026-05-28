import type {
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowSummary,
} from "../../../types/workflow";

export type WorkflowLibraryFilterId =
  | "all"
  | "active"
  | "runnable"
  | "draft"
  | "scheduled"
  | "retained";

export type WorkflowLibrarySortId = "recent" | "name" | "run_state";

export type WorkflowLibraryContext = {
  activeRunsByWorkflow: Map<string, WorkflowRunSnapshot>;
  scheduledWorkflowIds: Set<string>;
};

export type WorkflowLibraryFilterOption = {
  id: WorkflowLibraryFilterId;
  label: string;
  disabled?: boolean;
  reason?: string;
};

export type WorkflowActionAvailability = {
  canRun: boolean;
  canStop: boolean;
  canDuplicate: boolean;
  canExport: boolean;
  canDelete: boolean;
  disabledReason?: string;
  activeRun?: WorkflowRunSnapshot;
};

export function buildActiveRunMap(runSnapshots: WorkflowRunSnapshot[]) {
  const activeRuns = new Map<string, WorkflowRunSnapshot>();
  runSnapshots.forEach((snapshot) => {
    if (snapshot.workflow_id && snapshot.state.status === "running") {
      activeRuns.set(snapshot.workflow_id, snapshot);
    }
  });
  return activeRuns;
}

export function buildScheduledWorkflowSet(schedules: WorkflowSchedule[]) {
  return new Set(
    schedules
      .filter((schedule) => schedule.enabled)
      .map((schedule) => schedule.workflow_id),
  );
}

export function workflowMatchesSearch(workflow: WorkflowSummary, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  return workflow.name.toLowerCase().includes(normalized);
}

export function getWorkflowFilterOptions(
  context: WorkflowLibraryContext,
): WorkflowLibraryFilterOption[] {
  const unavailableReason = "Requires workflow detail data not loaded in the library.";
  return [
    { id: "all", label: "All" },
    { id: "active", label: "Active run" },
    {
      id: "runnable",
      label: "Runnable/saved",
      disabled: true,
      reason: unavailableReason,
    },
    {
      id: "draft",
      label: "Draft/needs configuration",
      disabled: true,
      reason: unavailableReason,
    },
    {
      id: "scheduled",
      label: "Scheduled",
      disabled: context.scheduledWorkflowIds.size === 0,
      reason:
        context.scheduledWorkflowIds.size === 0
          ? "No enabled schedules are loaded for this workspace."
          : undefined,
    },
    {
      id: "retained",
      label: "Uses retained identity/session",
      disabled: true,
      reason: unavailableReason,
    },
  ];
}

export function workflowMatchesFilter(
  workflow: WorkflowSummary,
  filter: WorkflowLibraryFilterId,
  context: WorkflowLibraryContext,
) {
  switch (filter) {
    case "active":
      return context.activeRunsByWorkflow.has(workflow.id);
    case "scheduled":
      return context.scheduledWorkflowIds.has(workflow.id);
    case "all":
    case "runnable":
    case "draft":
    case "retained":
      return true;
  }
}

export function filterWorkflowLibraryItems(
  workflows: WorkflowSummary[],
  {
    context,
    filter,
    search,
    sort,
  }: {
    context: WorkflowLibraryContext;
    filter: WorkflowLibraryFilterId;
    search: string;
    sort: WorkflowLibrarySortId;
  },
) {
  return sortWorkflowLibraryItems(
    workflows.filter(
      (workflow) =>
        workflowMatchesSearch(workflow, search) &&
        workflowMatchesFilter(workflow, filter, context),
    ),
    sort,
    context,
  );
}

export function sortWorkflowLibraryItems(
  workflows: WorkflowSummary[],
  sort: WorkflowLibrarySortId,
  context: WorkflowLibraryContext,
) {
  return [...workflows].sort((left, right) => {
    if (sort === "name") {
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    }
    if (sort === "run_state") {
      const leftActive = context.activeRunsByWorkflow.has(left.id) ? 0 : 1;
      const rightActive = context.activeRunsByWorkflow.has(right.id) ? 0 : 1;
      if (leftActive !== rightActive) return leftActive - rightActive;
      return left.name.localeCompare(right.name, undefined, { sensitivity: "base" });
    }
    return right.updated_at.localeCompare(left.updated_at);
  });
}

export function getWorkflowActionAvailability(
  workflow: WorkflowSummary,
  context: WorkflowLibraryContext,
): WorkflowActionAvailability {
  const activeRun = context.activeRunsByWorkflow.get(workflow.id);
  if (activeRun) {
    return {
      canRun: false,
      canStop: true,
      canDuplicate: false,
      canExport: false,
      canDelete: false,
      disabledReason: "Workflow currently running",
      activeRun,
    };
  }
  return {
    canRun: true,
    canStop: false,
    canDuplicate: true,
    canExport: true,
    canDelete: true,
  };
}

export function selectWorkflowFallback(
  selectedWorkflowId: string | null,
  visibleWorkflows: WorkflowSummary[],
) {
  return (
    visibleWorkflows.find((workflow) => workflow.id === selectedWorkflowId) ??
    visibleWorkflows[0] ??
    null
  );
}

export function formatWorkflowUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Updated recently";
  return `Updated ${date.toLocaleDateString()}`;
}
