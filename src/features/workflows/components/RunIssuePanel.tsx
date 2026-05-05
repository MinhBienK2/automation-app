import { LocateFixed, RotateCw, Save } from "lucide-react";
import type { RunIssue } from "../../../lib/workflowUi";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";

type RunIssuePanelProps = {
  issues: RunIssue[];
  totalBlockingIssues: number;
  onRunAgain: () => void;
  onSaveAgain: () => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onValidateAgain: () => void;
};

export function RunIssuePanel({
  issues,
  totalBlockingIssues,
  onRunAgain,
  onSaveAgain,
  onSelectEdge,
  onSelectNode,
  onValidateAgain,
}: RunIssuePanelProps) {
  if (!issues.length) return null;

  const firstIssue = issues[0];
  const header = issuePanelHeader(firstIssue.severity);
  const summary = issuePanelSummary(firstIssue.severity, totalBlockingIssues);

  return (
    <section className="run-issue-panel panel" aria-label="Run issues">
      <div className="run-issue-header">
        <div>
          <Badge variant={firstIssue.severity === "runtime" ? "destructive" : "default"}>
            {issueSeverityLabel(firstIssue.severity)}
          </Badge>
          <h2>{header}</h2>
          {summary ? <p>{summary}</p> : null}
        </div>
        <div className="run-issue-header-actions">
          {firstIssue.severity === "blocking" ? (
            <Button type="button" variant="secondary" onClick={onValidateAgain}>
              <RotateCw aria-hidden="true" />
              Validate again
            </Button>
          ) : null}
          {firstIssue.severity === "runtime" ? (
            <Button type="button" variant="secondary" onClick={onRunAgain}>
              <RotateCw aria-hidden="true" />
              Run again
            </Button>
          ) : null}
          {firstIssue.severity === "system" ? (
            <Button type="button" variant="secondary" onClick={onSaveAgain}>
              <Save aria-hidden="true" />
              Save again
            </Button>
          ) : null}
        </div>
      </div>

      <div className="run-issue-list">
        {issues.map((issue) => (
          <article className="run-issue-item" key={issue.id}>
            <div>
              <h3>{issue.title}</h3>
              <p>{issue.message}</p>
            </div>
            {issue.suggestions.length ? (
              <div className="run-issue-suggestions">
                <span>What to check</span>
                <ul>
                  {issue.suggestions.slice(0, 4).map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="run-issue-actions">
              {issue.node_id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSelectNode(issue.node_id as string)}
                >
                  <LocateFixed aria-hidden="true" />
                  {issue.severity === "runtime" ? "Select failed node" : "Select node"}
                </Button>
              ) : null}
              {issue.edge_id ? (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => onSelectEdge(issue.edge_id as string)}
                >
                  <LocateFixed aria-hidden="true" />
                  Select link
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {totalBlockingIssues > issues.length ? (
        <p className="run-issue-overflow">
          Showing {issues.length} of {totalBlockingIssues} issues. Run Validate to
          inspect all highlighted nodes.
        </p>
      ) : null}
    </section>
  );
}

function issuePanelHeader(severity: RunIssue["severity"]) {
  if (severity === "blocking") return "Run blocked";
  if (severity === "runtime") return "Run failed";
  return "Could not start run";
}

function issuePanelSummary(
  severity: RunIssue["severity"],
  totalBlockingIssues: number,
) {
  if (severity !== "blocking") return "";
  return `Fix ${totalBlockingIssues} ${
    totalBlockingIssues === 1 ? "issue" : "issues"
  } before running this workflow.`;
}

function issueSeverityLabel(severity: RunIssue["severity"]) {
  if (severity === "blocking") return "Blocking issue";
  if (severity === "runtime") return "Runtime failure";
  return "System error";
}
