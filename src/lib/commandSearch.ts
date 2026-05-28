import type {
  CommandSearchResult,
  EvidenceListItem,
  IdentityLabOverview,
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowSummary,
} from "../types/workflow";

export type CommandSearchResultGroup = {
  key: CommandSearchResult["type"];
  label: string;
  results: CommandSearchResult[];
};

const groupLabels: Record<CommandSearchResult["type"], string> = {
  Workflow: "Workflows",
  Run: "Runs",
  Evidence: "Evidence",
  Schedule: "Schedules",
  Identity: "Identities",
};

const groupOrder: CommandSearchResult["type"][] = [
  "Workflow",
  "Run",
  "Evidence",
  "Schedule",
  "Identity",
];

export function buildWorkflowCommandResults(
  workflows: WorkflowSummary[],
  query: string,
): CommandSearchResult[] {
  const queryLower = query.toLowerCase();
  return workflows
    .filter((workflow) => includesCommandQuery(workflow.name, queryLower))
    .slice(0, 5)
    .map((workflow) => ({
      id: `workflow:${workflow.id}`,
      type: "Workflow",
      label: formatCommandResultContext(workflow.name, "Workflow"),
      context: `${workflow.step_count} steps`,
      target: { type: "workflow", workflow_id: workflow.id },
    }));
}

export function buildRunCommandResults(
  runSnapshots: WorkflowRunSnapshot[],
  query: string,
): CommandSearchResult[] {
  const queryLower = query.toLowerCase();
  return runSnapshots
    .filter(
      (run) =>
        includesCommandQuery(run.workflow_name, queryLower) ||
        includesCommandQuery(run.run_id, queryLower),
    )
    .slice(0, 5)
    .map((run) => ({
      id: `run:${run.run_id}`,
      type: "Run",
      label: formatCommandResultContext(run.workflow_name, "Run"),
      context: `${run.state.status} ${run.run_id}`,
      target: { type: "run", run_id: run.run_id },
    }));
}

export function buildScheduleCommandResults(
  schedules: WorkflowSchedule[],
  query: string,
): CommandSearchResult[] {
  const queryLower = query.toLowerCase();
  return schedules
    .filter(
      (schedule) =>
        includesCommandQuery(schedule.name, queryLower) ||
        includesCommandQuery(schedule.workflow_name, queryLower),
    )
    .slice(0, 5)
    .map((schedule) => ({
      id: `schedule:${schedule.id}`,
      type: "Schedule",
      label: formatCommandResultContext(schedule.name, "Schedule"),
      context: formatCommandResultContext(schedule.workflow_name, "Workflow"),
      target: { type: "schedule", schedule_id: schedule.id },
    }));
}

export function buildEvidenceCommandResults(
  evidenceItems: EvidenceListItem[],
): CommandSearchResult[] {
  const results: CommandSearchResult[] = [];
  evidenceItems.slice(0, 5).forEach((item) => {
    results.push({
      id: `evidence:${item.evidence_id}`,
      type: "Evidence",
      label: formatCommandResultContext(item.label, "Evidence item"),
      context: formatCommandResultContext(
        item.workflow?.name ?? item.identity?.display_name,
        "Run evidence",
      ),
      target: { type: "evidence", evidence_id: item.evidence_id },
    });
    if (item.identity?.id) {
      const context = item.workflow?.name
        ? `Historical evidence / ${item.workflow.name}`
        : `Historical evidence / ${item.run.id}`;
      results.push({
        id: [
          "identity",
          "historical",
          item.workflow?.id ?? "unknown",
          item.identity.id,
          item.run.id,
          item.evidence_id,
        ].join(":"),
        type: "Identity",
        label: formatCommandResultContext(item.identity.display_name ?? item.identity.id, "Identity"),
        context: formatCommandResultContext(context, "Historical evidence"),
        target: {
          type: "identity",
          target: {
            type: "historical",
            identity_id: item.identity.id,
            workflow_id: item.workflow?.id ?? null,
            evidence_id: item.evidence_id,
            run_id: item.run.id,
          },
        },
      });
    }
  });
  return results;
}

export function buildIdentityCommandResults(
  identityOverview: IdentityLabOverview,
): CommandSearchResult[] {
  return identityOverview.items.slice(0, 5).map((item) => ({
    id: `identity:${item.workflow_ref.id}:${item.identity_ref.id}`,
    type: "Identity",
    label: formatCommandResultContext(
      item.identity_ref.display_name ?? item.identity_ref.id,
      "Identity",
    ),
    context: formatCommandResultContext(item.workflow_ref.name, "Workflow"),
    target: {
      type: "identity",
      target: {
        type: "managed",
        workflow_id: item.workflow_ref.id,
        identity_id: item.identity_ref.id,
      },
    },
  }));
}

export function dedupeCommandSearchResults(
  results: CommandSearchResult[],
): CommandSearchResult[] {
  const unique = new Map<string, CommandSearchResult>();
  results.forEach((result) => {
    if (!unique.has(result.id)) unique.set(result.id, result);
  });
  return [...unique.values()];
}

export function groupCommandSearchResults(
  results: CommandSearchResult[],
): CommandSearchResultGroup[] {
  return groupOrder
    .map((type) => ({
      key: type,
      label: groupLabels[type],
      results: results.filter((result) => result.type === type),
    }))
    .filter((group) => group.results.length > 0);
}

export function limitCommandSearchResults(
  results: CommandSearchResult[],
  limits: { total?: number; perGroup?: number } = {},
): CommandSearchResult[] {
  const perGroup = limits.perGroup ?? 5;
  const total = limits.total ?? 10;
  const grouped = groupCommandSearchResults(results);
  return grouped.flatMap((group) => group.results.slice(0, perGroup)).slice(0, total);
}

export function formatCommandResultContext(
  value: string | null | undefined,
  fallback: string,
) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (/password|secret|token|cookie|authorization/i.test(trimmed)) return fallback;
  return trimmed.length > 96 ? `${trimmed.slice(0, 93)}...` : trimmed;
}

function includesCommandQuery(value: string | null | undefined, queryLower: string) {
  return value?.toLowerCase().includes(queryLower) ?? false;
}
