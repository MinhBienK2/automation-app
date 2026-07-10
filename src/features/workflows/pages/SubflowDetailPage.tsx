import { Save, Settings } from "lucide-react";
import { useState } from "react";
import { PageHeader } from "../../../components/layout/PageHeader";
import { IconButton } from "../../../components/ui/icon-button";
import { Alert } from "../../../components/ui/alert";
import { initialRunState } from "../../../lib/workflowUi";
import type {
  Subflow,
  SubflowSummary,
  SubflowUsage,
  WorkflowGraph,
} from "../../../types/workflow";
import { SubflowSettingsDialog } from "../components/SubflowSettingsDialog";
import { WorkflowGraphEditor } from "../components/WorkflowGraphEditor";

type SubflowDetailPageProps = {
  subflow: Subflow | SubflowSummary | null;
  projectName?: string | null;
  usage: SubflowUsage[] | null;
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
  isSavingGraph?: boolean;
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
  isSavingGraph = false,
}: SubflowDetailPageProps) {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const usageCount = usage ? usage.length : 0;
  const usageLabel = usage
    ? `${usageCount} ${usageCount === 1 ? "workflow" : "workflows"}`
    : "...";

  return (
    <section className="app-screen workflow-detail-screen flex flex-col gap-4">
      <h1 className="sr-only">{subflow?.name ?? "Subflow"}</h1>
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
        title={subflow?.name ?? "Loading..."}
        onBack={onBack}
        actions={
          <div className="flex gap-2">
            <IconButton
              variant="secondary"
              type="button"
              label="Settings"
              onClick={() => setSettingsOpen(true)}
              disabled={!subflow}
            >
              <Settings aria-hidden="true" size={16} />
            </IconButton>
            <IconButton
              variant="secondary"
              type="button"
              label="Save"
              onClick={onSaveGraph}
              disabled={!canSaveGraph || isSavingGraph || !subflow}
              loading={isSavingGraph}
            >
              <Save aria-hidden="true" size={16} />
            </IconButton>
          </div>
        }
      />
      <SubflowSettingsDialog
        subflow={settingsOpen && subflow ? subflow : null}
        onOpenChange={(open) => setSettingsOpen(open)}
        onSave={onUpdateSubflow}
      />

      {appError ? (
        <Alert variant="error" className="text-xs p-3">
          {appError}
        </Alert>
      ) : null}

      <section className="card bg-base-200 border border-base-300 card-body p-5 flex flex-col mb-4" aria-label="Subflow usage">
        <div className="border-b border-base-300 pb-2 mb-3">
          <h3 className="text-secondary text-xs font-bold uppercase tracking-wider">Usage</h3>
          <h2 className="text-sm font-bold text-base-content mt-0.5">{usage ? `Used by ${usageLabel}` : "Loading usage..."}</h2>
        </div>
        {usage === null ? (
          <ul className="flex flex-col gap-1.5 py-1" aria-label="Subflow Usage Loading">
            <li className="skeleton h-4 w-32 rounded-md" />
            <li className="skeleton h-4 w-40 rounded-md" />
          </ul>
        ) : usageCount > 0 ? (
          <div className="flex flex-col gap-3">
            <Alert variant="warning" className="text-xs p-3">
              <span>This subflow is used by {usageLabel}. Saving changes will affect their next run.</span>
            </Alert>
            <ul className="list-disc list-inside text-xs text-base-content/85 flex flex-col gap-1 pl-1">
              {usage.map((item) => (
                <li key={item.workflow_id} className="font-medium">{item.workflow_name}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-secondary text-xs italic">No workflows call this subflow yet.</p>
        )}
      </section>

      {graph && subflow ? (
        <WorkflowGraphEditor
          graph={graph}
          graphKind="subflow"
          runState={initialRunState}
          validationIssues={[]}
          ownerId={subflow.id}
          onChange={onGraphChange}
          onSaveGraph={onSaveGraph}
        />
      ) : (
        <div className="flex flex-col gap-2 flex-grow min-h-[300px]">
          <div className="skeleton h-12 w-full rounded-lg" />
          <div className="skeleton flex-grow w-full rounded-lg mt-1" aria-label="Subflow Graph Loading" />
        </div>
      )}
    </section>
  );
}
