import { useState } from "react";
import { ClipboardCopy, LocateFixed, RotateCw, Save } from "lucide-react";
import type { RunIssue } from "../../../../lib/workflowUi";
import { Button } from "../../../../components/ui/button";
import { Badge } from "../../../../components/ui/badge";

type RunIssuePanelProps = {
  issues: RunIssue[];
  issuesNeedRecheck?: boolean;
  totalBlockingIssues: number;
  onRunAgain: () => void;
  onSaveAgain: () => void;
  onSelectEdge: (edgeId: string) => void;
  onSelectNode: (nodeId: string) => void;
  onValidateAgain: () => void;
  isStartingRun?: boolean;
};

export function RunIssuePanel({
  issues,
  issuesNeedRecheck = false,
  totalBlockingIssues,
  onRunAgain,
  onSaveAgain,
  onSelectEdge,
  onSelectNode,
  onValidateAgain,
  isStartingRun = false,
}: RunIssuePanelProps) {
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(() => new Set());
  if (!issues.length) return null;

  const firstIssue = issues[0];
  const header = issuePanelHeader(firstIssue.severity);
  const summary = issuePanelSummary(firstIssue.severity, totalBlockingIssues);
  const firstIssueSummary = summarizeIssueMessage(firstIssue.message);
  const firstIssueHasDetails = hasIssueDetails(firstIssue, firstIssueSummary);
  const firstIssueExpanded = expandedIssueIds.has(firstIssue.id);
  const listedIssues = firstIssue.severity === "blocking" ? issues : issues.slice(1);
  const toggleDetails = (issueId: string) => {
    setExpandedIssueIds((current) => {
      const next = new Set(current);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  return (
    <section
      className={`run-issue-panel run-issue-panel-${firstIssue.severity} panel`}
      aria-label="Run issues"
    >
      <div className="run-issue-header">
        <div className="run-issue-header-copy">
          <div className="run-issue-badges">
            <Badge variant={firstIssue.severity === "runtime" ? "destructive" : "default"}>
              {issueSeverityLabel(firstIssue.severity)}
            </Badge>
            {issuesNeedRecheck ? <Badge variant="secondary">Needs recheck</Badge> : null}
          </div>
          <h2>{firstIssue.severity === "blocking" ? header : firstIssue.title}</h2>
          {summary ? <p>{summary}</p> : null}
          {firstIssue.severity !== "blocking" ? (
            <p className="run-issue-summary-text">{firstIssueSummary}</p>
          ) : null}
          {issuesNeedRecheck ? (
            <p className="run-issue-stale-note">
              Run issues may be out of date after graph edits.
            </p>
          ) : null}
          {firstIssue.context.length ? (
            <div className="run-issue-suggestions">
              <span>Failure context</span>
              <ul>
                {firstIssue.context.map((contextLine) => (
                  <li key={contextLine}>{contextLine}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="run-issue-header-actions">
          {firstIssue.severity === "blocking" || issuesNeedRecheck ? (
            <Button type="button" variant="secondary" onClick={onValidateAgain}>
              <RotateCw aria-hidden="true" />
              Validate again
            </Button>
          ) : null}
          {firstIssue.severity === "runtime" ? (
            <Button type="button" variant="secondary" onClick={onRunAgain} disabled={isStartingRun}>
              {isStartingRun ? (
                <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <RotateCw aria-hidden="true" />
              )}
              {isStartingRun ? "Starting..." : "Run again"}
            </Button>
          ) : null}
          {firstIssue.node_id && firstIssue.severity !== "blocking" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => onSelectNode(firstIssue.node_id as string)}
            >
              <LocateFixed aria-hidden="true" />
              {firstIssue.severity === "runtime" ? "Select failed node" : "Select node"}
            </Button>
          ) : null}
          {firstIssue.severity === "system" ? (
            <Button type="button" variant="secondary" onClick={onSaveAgain}>
              <Save aria-hidden="true" />
              Save again
            </Button>
          ) : null}
          {firstIssueHasDetails && firstIssue.severity !== "blocking" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => toggleDetails(firstIssue.id)}
            >
              {firstIssueExpanded ? "Hide details" : "Details"}
            </Button>
          ) : null}
          {firstIssueHasDetails && firstIssue.severity !== "blocking" ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => copyIssueDetails(firstIssue)}
            >
              <ClipboardCopy aria-hidden="true" />
              Copy details
            </Button>
          ) : null}
        </div>
      </div>
      {firstIssueHasDetails && firstIssue.severity !== "blocking" && firstIssueExpanded ? (
        <pre className="run-issue-details">{issueDetailsText(firstIssue)}</pre>
      ) : null}

      {listedIssues.length ? (
        <div className="run-issue-list">
          {listedIssues.map((issue) => {
            const issueSummary = summarizeIssueMessage(issue.message);
            const issueHasDetails = hasIssueDetails(issue, issueSummary);
            const expanded = expandedIssueIds.has(issue.id);
            return (
              <article className="run-issue-item" key={issue.id}>
                <div>
                  <h3>{issue.title}</h3>
                  <p className="run-issue-summary-text">{issueSummary}</p>
                  {issue.context.length ? (
                    <div className="run-issue-suggestions">
                      <span>Failure context</span>
                      <ul>
                        {issue.context.map((contextLine) => (
                          <li key={contextLine}>{contextLine}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {issueHasDetails ? (
                    <div className="run-issue-detail-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => toggleDetails(issue.id)}
                      >
                        {expanded ? "Hide details" : "Details"}
                      </Button>
                    </div>
                  ) : null}
                  {expanded ? (
                    <pre className="run-issue-details">{issueDetailsText(issue)}</pre>
                  ) : null}
                </div>
                {issue.suggestions.length ? (
                  <div className="run-issue-suggestions">
                    <span>What to check</span>
                    <ul>
                      {issue.suggestions.slice(0, 3).map((suggestion) => (
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
            );
          })}
        </div>
      ) : null}

      {totalBlockingIssues > issues.length ? (
        <p className="run-issue-overflow">
          Showing {issues.length} of {totalBlockingIssues} issues. Run Validate to
          inspect all highlighted nodes.
        </p>
      ) : null}
    </section>
  );
}

function summarizeIssueMessage(message: string) {
  const firstLine = message
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean) ?? message.trim();
  if (firstLine.length <= 180) return firstLine;
  return `${firstLine.slice(0, 177)}...`;
}

function hasIssueDetails(issue: RunIssue, summary: string) {
  return (
    issue.message.includes("\n") ||
    issue.message.trim() !== summary ||
    issue.diagnostics.length > 0
  );
}

function issueDetailsText(issue: RunIssue) {
  if (!issue.diagnostics.length) return issue.message;
  return [
    issue.message,
    "",
    "Diagnostics:",
    ...issue.diagnostics.map((diagnostic) => `- ${diagnostic}`),
  ].join("\n");
}

function copyIssueDetails(issue: RunIssue) {
  void navigator.clipboard?.writeText(issueDetailsText(issue));
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
