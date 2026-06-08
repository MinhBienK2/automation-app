import { Save, Settings } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { IconButton } from "../../../components/ui/icon-button";
import { initialRunState } from "../../../lib/workflowUi";
import type {
  Subflow,
  SubflowUsage,
  WorkflowGraph,
} from "../../../types/workflow";
import { SubflowSettingsDialog } from "../components/SubflowSettingsDialog";
import { WorkflowGraphEditor } from "../components/WorkflowGraphEditor";

type SubflowDetailPageProps = {
  subflow: Subflow;
  projectName?: string | null;
  usage: SubflowUsage[];
  graph: WorkflowGraph | null;
  graphSaveStatus: string;
  canSaveGraph: boolean;
  appError: string;
  backLabel?: string;
  breadcrumbLabel?: string;
  onBack: () => void;
  onGraphChange: (graph: WorkflowGraph) => void;
  onSaveGraph: () => void;
  onUpdateSubflow: (input: { name: string }) => Promise<void>;
};

export function SubflowDetailPage({
  subflow,
  projectName = null,
  usage,
  graph,
  graphSaveStatus,
  canSaveGraph,
  appError,
  backLabel = "Back to Subflows",
  breadcrumbLabel = "Subflows",
  onBack,
  onGraphChange,
  onSaveGraph,
  onUpdateSubflow,
}: SubflowDetailPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const usageCount = usage.length;
  const usageLabel = `${usageCount} ${usageCount === 1 ? "workflow" : "workflows"}`;

  return (
    <section className="app-screen workflow-detail-screen">
      <h1 className="sr-only">{subflow.name}</h1>
      <PageHeader
        ariaLabel="Subflow detail header"
        backLabel={backLabel}
        breadcrumbLabel={breadcrumbLabel}
        eyebrow="Subflow"
        meta={[
          graphSaveStatus,
          ...(projectName ? [`Project: ${projectName}`] : []),
          `Usage: ${usageLabel}`,
        ]}
        title={subflow.name}
        onBack={onBack}
        actions={
          <div className="run-actions">
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings aria-hidden="true" />
            </IconButton>
            <IconButton
              className="workflow-command-icon"
              variant="secondary"
              type="button"
              label="Save"
              onClick={onSaveGraph}
              disabled={!canSaveGraph}
            >
              <Save aria-hidden="true" />
            </IconButton>
          </div>
        }
      />
      <SubflowSettingsDialog
        subflow={settingsOpen ? subflow : null}
        onOpenChange={(open) => setSettingsOpen(open)}
        onSave={onUpdateSubflow}
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
