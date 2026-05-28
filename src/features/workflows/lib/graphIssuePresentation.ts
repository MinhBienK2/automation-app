import type {
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
} from "../../../types/workflow";

export type GraphIssueGroups = {
  nodeIssues: Map<string, GraphValidationIssue[]>;
  edgeIssues: Map<string, GraphValidationIssue[]>;
  graphIssues: GraphValidationIssue[];
};

export type GraphHealthSummary = {
  totalNodes: number;
  totalLinks: number;
  unconfiguredActionNodes: number;
  validationIssueCount: number;
  errorIssueCount: number;
  warningIssueCount: number;
  issuesNeedRecheck: boolean;
  lastRunStatus: RunState["status"];
};

export function summarizeGraphHealth({
  graph,
  issues,
  issuesNeedRecheck,
  runState,
}: {
  graph: WorkflowGraph;
  issues: GraphValidationIssue[];
  issuesNeedRecheck: boolean;
  runState: RunState;
}): GraphHealthSummary {
  return {
    totalNodes: graph.nodes.length,
    totalLinks: graph.edges.length,
    unconfiguredActionNodes: graph.nodes.filter(isUnconfiguredActionNode).length,
    validationIssueCount: issues.length,
    errorIssueCount: issues.filter((issue) => issue.level === "error").length,
    warningIssueCount: issues.filter((issue) => issue.level === "warning").length,
    issuesNeedRecheck,
    lastRunStatus: runState.status,
  };
}

export function groupGraphIssuesByTarget(
  issues: GraphValidationIssue[],
): GraphIssueGroups {
  const nodeIssues = new Map<string, GraphValidationIssue[]>();
  const edgeIssues = new Map<string, GraphValidationIssue[]>();
  const graphIssues: GraphValidationIssue[] = [];

  for (const issue of issues) {
    if (issue.node_id) {
      nodeIssues.set(issue.node_id, [...(nodeIssues.get(issue.node_id) ?? []), issue]);
      continue;
    }
    if (issue.edge_id) {
      edgeIssues.set(issue.edge_id, [...(edgeIssues.get(issue.edge_id) ?? []), issue]);
      continue;
    }
    graphIssues.push(issue);
  }

  return { nodeIssues, edgeIssues, graphIssues };
}

export function getSelectedGraphIssues(
  groups: GraphIssueGroups,
  selection: { nodeId?: string | null; edgeId?: string | null },
) {
  if (selection.nodeId) return groups.nodeIssues.get(selection.nodeId) ?? [];
  if (selection.edgeId) return groups.edgeIssues.get(selection.edgeId) ?? [];
  return groups.graphIssues;
}

export function graphIssueStatusLabel({
  issueCount,
  issuesNeedRecheck,
}: {
  issueCount: number;
  issuesNeedRecheck: boolean;
}) {
  if (issueCount === 0) return issuesNeedRecheck ? "Needs recheck" : "No validation issues";
  const issueLabel = `${issueCount} ${issueCount === 1 ? "issue" : "issues"}`;
  return issuesNeedRecheck ? `${issueLabel} need recheck` : issueLabel;
}

function isUnconfiguredActionNode(node: WorkflowGraph["nodes"][number]) {
  if (node.node_type !== "action") return false;
  if (!node.config || typeof node.config !== "object" || Array.isArray(node.config)) {
    return true;
  }
  return !("type" in node.config);
}
