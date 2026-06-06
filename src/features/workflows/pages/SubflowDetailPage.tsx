import { Copy, Save, Trash2 } from "lucide-react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { IconButton } from "../../../components/ui/icon-button";
import { initialRunState } from "../../../lib/workflowUi";
import type {
  Subflow,
  SubflowUsage,
  WorkflowGraph,
} from "../../../types/workflow";
import { WorkflowGraphEditor } from "../components/WorkflowGraphEditor";

type SubflowDetailPageProps = {
  subflow: Subflow;
  usage: SubflowUsage[];
  graph: WorkflowGraph | null;
  graphSaveStatus: string;
  appError: string;
  onBack: () => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onSaveGraph: () => void;
  onDuplicateSubflow: (subflow: Subflow) => Promise<void>;
  onDeleteSubflow: (subflow: Subflow) => Promise<void>;
};

export function SubflowDetailPage({
  subflow,
  usage,
  graph,
  graphSaveStatus,
  appError,
  onBack,
  onGraphChange,
  onSaveGraph,
  onDuplicateSubflow,
  onDeleteSubflow,
}: SubflowDetailPageProps) {
  const usageCount = usage.length;
  const usageLabel = `${usageCount} ${usageCount === 1 ? "workflow" : "workflows"}`;

  return (
    <section className="app-screen workflow-detail-screen">
      <h1 className="sr-only">{subflow.name}</h1>
      <PageHeader
        ariaLabel="Subflow detail header"
        backLabel="Back to Subflows"
        breadcrumbLabel="Subflows"
        eyebrow="Subflow"
        meta={[graphSaveStatus, `Usage: ${usageLabel}`]}
        title={subflow.name}
        onBack={onBack}
        actions={
          <div className="run-actions">
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Save"
              onClick={onSaveGraph}
            >
              <Save aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label={`Duplicate ${subflow.name}`}
              onClick={() => {
                void onDuplicateSubflow(subflow);
              }}
            >
              <Copy aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="destructive"
              type="button"
              label={`Delete ${subflow.name}`}
              onClick={() => {
                void onDeleteSubflow(subflow);
              }}
            >
              <Trash2 aria-hidden="true" />
            </IconButton>
          </div>
        }
      />

      {appError ? (
        <p className="field-error" role="alert">
          {appError}
        </p>
      ) : null}

      <section className="panel settings-panel" aria-label="Subflow usage">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Usage</p>
            <h2>Used by {usageLabel}</h2>
          </div>
        </div>
        {usageCount > 0 ? (
          <>
            <p className="field-warning">
              This subflow is used by {usageLabel}. Saving changes will affect their next run.
            </p>
            <ul className="subflow-usage-list">
              {usage.map((item) => (
                <li key={item.workflow_id}>{item.workflow_name}</li>
              ))}
            </ul>
          </>
        ) : (
          <p className="muted">No workflows call this subflow yet.</p>
        )}
      </section>

      {graph ? (
        <WorkflowGraphEditor
          graph={graph}
          graphKind="subflow"
          runState={initialRunState}
          validationIssues={[]}
          onChange={onGraphChange}
          onSaveGraph={onSaveGraph}
        />
      ) : (
        <div className="empty-state panel">
          <h2>Loading graph</h2>
          <p className="muted">Subflow graph is loading.</p>
        </div>
      )}
    </section>
  );
}
