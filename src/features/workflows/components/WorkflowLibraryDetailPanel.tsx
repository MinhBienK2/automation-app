import { Copy, Download, Play, Settings, Square, Trash2, Workflow } from "lucide-react";
import { DetailPanel } from "../../../components/patterns/DetailPanel";
import { StatePanel } from "../../../components/patterns/StatePanel";
import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/badge";
import { KeyValueList } from "../../../components/patterns/KeyValueList";
import { runStatusLabel } from "../../../lib/workflowUi";
import type { WorkflowSummary } from "../../../types/workflow";
import {
  formatWorkflowUpdatedAt,
  getWorkflowActionAvailability,
  type WorkflowLibraryContext,
} from "../lib/workflowLibrary";

type WorkflowLibraryDetailPanelProps = {
  workflow: WorkflowSummary | null;
  context: WorkflowLibraryContext;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenSettings: (workflow: WorkflowSummary) => void;
  onRunWorkflow: (workflow: WorkflowSummary) => void;
  onStopRun: (runId: string) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => void;
  onExportWorkflow: (workflow: WorkflowSummary) => void;
  onDeleteWorkflow: (workflowId: string) => void;
};

export function WorkflowLibraryDetailPanel({
  workflow,
  context,
  onOpenWorkflow,
  onOpenSettings,
  onRunWorkflow,
  onStopRun,
  onDuplicateWorkflow,
  onExportWorkflow,
  onDeleteWorkflow,
}: WorkflowLibraryDetailPanelProps) {
  if (!workflow) {
    return (
      <StatePanel
        tone="neutral"
        title="No workflow selected"
        description="Select a workflow row to preview safe library metadata and actions."
      />
    );
  }

  const availability = getWorkflowActionAvailability(workflow, context);
  const activeRun = availability.activeRun;
  const isScheduled = context.scheduledWorkflowIds.has(workflow.id);

  return (
    <section aria-label="Workflow detail">
      <DetailPanel
        title={workflow.name}
        subtitle={workflow.id}
        status={
          activeRun ? (
            <StatusBadge tone="active">Active</StatusBadge>
          ) : (
            <StatusBadge tone="muted">Idle</StatusBadge>
          )
        }
        actions={
          <>
            <Button
              type="button"
              variant="secondary"
              onClick={() => onOpenWorkflow(workflow.id)}
            >
              <Workflow aria-hidden="true" />
              Open Graph
            </Button>
            {activeRun ? (
              <Button
                type="button"
                variant="destructive"
                onClick={() => onStopRun(activeRun.run_id)}
              >
                <Square aria-hidden="true" />
                Stop
              </Button>
            ) : (
              <Button type="button" onClick={() => onRunWorkflow(workflow)}>
                <Play aria-hidden="true" />
                Launch Run
              </Button>
            )}
          </>
        }
      >
        <KeyValueList
          items={[
            { label: "Steps", value: `${workflow.step_count}` },
            { label: "Updated", value: formatWorkflowUpdatedAt(workflow.updated_at) },
            { label: "Schedule", value: isScheduled ? "Enabled schedule loaded" : "No schedule loaded" },
            {
              label: "Run state",
              value: activeRun
                ? `${runStatusLabel(activeRun.state)}${
                    activeRun.state.current_step_number
                      ? ` step ${activeRun.state.current_step_number}`
                      : ""
                  }`
                : "Idle",
            },
          ]}
        />
        <div className="workflow-library-detail-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenSettings(workflow)}
          >
            <Settings aria-hidden="true" />
            Settings
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!availability.canDuplicate}
            title={availability.disabledReason}
            onClick={() => onDuplicateWorkflow(workflow)}
          >
            <Copy aria-hidden="true" />
            Duplicate
          </Button>
          <Button
            type="button"
            variant="secondary"
            disabled={!availability.canExport}
            title={availability.disabledReason}
            onClick={() => onExportWorkflow(workflow)}
          >
            <Download aria-hidden="true" />
            Export
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!availability.canDelete}
            title={availability.disabledReason}
            onClick={() => onDeleteWorkflow(workflow.id)}
          >
            <Trash2 aria-hidden="true" />
            Delete
          </Button>
        </div>
        {availability.disabledReason ? (
          <p className="muted">{availability.disabledReason}</p>
        ) : null}
      </DetailPanel>
    </section>
  );
}
