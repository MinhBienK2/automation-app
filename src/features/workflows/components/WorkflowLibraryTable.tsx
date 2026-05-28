import { useEffect, useRef, useState } from "react";
import {
  MoreHorizontal,
  Play,
  Settings,
  Square,
  Copy,
  Download,
  Trash2,
  Workflow,
} from "lucide-react";
import { IconButton } from "../../../components/ui/icon-button";
import { Button } from "../../../components/ui/button";
import { StatusBadge } from "../../../components/ui/badge";
import { runStatusLabel } from "../../../lib/workflowUi";
import type { WorkflowRunSnapshot, WorkflowSummary } from "../../../types/workflow";
import {
  formatWorkflowUpdatedAt,
  getWorkflowActionAvailability,
  type WorkflowLibraryContext,
} from "../lib/workflowLibrary";

type WorkflowLibraryTableProps = {
  workflows: WorkflowSummary[];
  context: WorkflowLibraryContext;
  selectedWorkflowId: string | null;
  onSelectWorkflow: (workflowId: string) => void;
  onOpenWorkflow: (workflowId: string) => void;
  onOpenSettings: (workflow: WorkflowSummary) => void;
  onRunWorkflow: (workflow: WorkflowSummary) => void;
  onStopRun: (runId: string) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => void;
  onExportWorkflow: (workflow: WorkflowSummary) => void;
  onDeleteWorkflow: (workflowId: string) => void;
};

export function WorkflowLibraryTable({
  workflows,
  context,
  selectedWorkflowId,
  onSelectWorkflow,
  onOpenWorkflow,
  onOpenSettings,
  onRunWorkflow,
  onStopRun,
  onDuplicateWorkflow,
  onExportWorkflow,
  onDeleteWorkflow,
}: WorkflowLibraryTableProps) {
  return (
    <table className="workflow-library-table" aria-label="Workflow library table">
      <thead>
        <tr>
          <th>Workflow</th>
          <th>Status</th>
          <th>Schedule</th>
          <th>Updated</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {workflows.map((workflow) => {
          const activeRun = context.activeRunsByWorkflow.get(workflow.id) ?? null;
          const isScheduled = context.scheduledWorkflowIds.has(workflow.id);
          const statusText = activeRun
            ? runStatusLabel(activeRun.state)
            : "Idle";
          const rowLabel = `${workflow.name} ${statusText}${isScheduled ? " Scheduled" : ""}`;

          return (
            <tr
              key={workflow.id}
              aria-current={selectedWorkflowId === workflow.id ? "true" : undefined}
              aria-label={rowLabel}
              className={selectedWorkflowId === workflow.id ? "workflow-library-row-selected" : undefined}
              onClick={() => onSelectWorkflow(workflow.id)}
              onDoubleClick={() => onOpenWorkflow(workflow.id)}
            >
              <td>
                <div className="workflow-library-name-cell">
                  <strong>{workflow.name}</strong>
                  <small>{workflow.step_count} steps</small>
                </div>
              </td>
              <td>
                <WorkflowRunStatus activeRun={activeRun} />
              </td>
              <td>
                {isScheduled ? (
                  <StatusBadge tone="neutral" size="sm">
                    Scheduled
                  </StatusBadge>
                ) : (
                  <span className="muted">No schedule</span>
                )}
              </td>
              <td>{formatWorkflowUpdatedAt(workflow.updated_at)}</td>
              <td>
                <WorkflowRowActions
                  workflow={workflow}
                  context={context}
                  onOpenWorkflow={onOpenWorkflow}
                  onOpenSettings={onOpenSettings}
                  onRunWorkflow={onRunWorkflow}
                  onStopRun={onStopRun}
                  onDuplicateWorkflow={onDuplicateWorkflow}
                  onExportWorkflow={onExportWorkflow}
                  onDeleteWorkflow={onDeleteWorkflow}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function WorkflowRunStatus({ activeRun }: { activeRun: WorkflowRunSnapshot | null }) {
  if (!activeRun) {
    return (
      <StatusBadge tone="muted" size="sm">
        Idle
      </StatusBadge>
    );
  }
  return (
    <span className="workflow-library-run-status">
      <StatusBadge tone="active" size="sm">
        {runStatusLabel(activeRun.state)}
      </StatusBadge>
      {activeRun.state.current_step_number ? (
        <small>step {activeRun.state.current_step_number}</small>
      ) : null}
    </span>
  );
}

function WorkflowRowActions({
  workflow,
  context,
  onOpenWorkflow,
  onOpenSettings,
  onRunWorkflow,
  onStopRun,
  onDuplicateWorkflow,
  onExportWorkflow,
  onDeleteWorkflow,
}: Omit<WorkflowLibraryTableProps, "workflows" | "selectedWorkflowId" | "onSelectWorkflow"> & {
  workflow: WorkflowSummary;
}) {
  const availability = getWorkflowActionAvailability(workflow, context);
  const activeRun = availability.activeRun;

  return (
    <div className="workflow-library-row-actions">
      <IconButton
        label={`Open Graph ${workflow.name}`}
        tooltip={`Open Graph ${workflow.name}`}
        type="button"
        variant="secondary"
        onClick={(event) => {
          event.stopPropagation();
          onOpenWorkflow(workflow.id);
        }}
      >
        <Workflow aria-hidden="true" />
      </IconButton>
      {activeRun ? (
        <IconButton
          label={`Stop ${workflow.name}`}
          tooltip={`Stop ${workflow.name}`}
          type="button"
          variant="destructive"
          onClick={(event) => {
            event.stopPropagation();
            onStopRun(activeRun.run_id);
          }}
        >
          <Square aria-hidden="true" />
        </IconButton>
      ) : (
        <IconButton
          label={`Run ${workflow.name}`}
          tooltip={`Run ${workflow.name}`}
          type="button"
          variant="secondary"
          disabled={!availability.canRun}
          onClick={(event) => {
            event.stopPropagation();
            onRunWorkflow(workflow);
          }}
        >
          <Play aria-hidden="true" />
        </IconButton>
      )}
      <WorkflowMoreMenu
        workflow={workflow}
        availability={availability}
        onOpenSettings={onOpenSettings}
        onDuplicateWorkflow={onDuplicateWorkflow}
        onExportWorkflow={onExportWorkflow}
        onDeleteWorkflow={onDeleteWorkflow}
      />
    </div>
  );
}

function WorkflowMoreMenu({
  workflow,
  availability,
  onOpenSettings,
  onDuplicateWorkflow,
  onExportWorkflow,
  onDeleteWorkflow,
}: {
  workflow: WorkflowSummary;
  availability: ReturnType<typeof getWorkflowActionAvailability>;
  onOpenSettings: (workflow: WorkflowSummary) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => void;
  onExportWorkflow: (workflow: WorkflowSummary) => void;
  onDeleteWorkflow: (workflowId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  function closeAfter(action: () => void) {
    action();
    setOpen(false);
  }

  return (
    <div
      className="workflow-more-menu"
      ref={ref}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        if (event.key === "Escape") setOpen(false);
      }}
    >
      <IconButton
        label={`More actions for ${workflow.name}`}
        tooltip={`More actions for ${workflow.name}`}
        type="button"
        variant="secondary"
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal aria-hidden="true" />
      </IconButton>
      {open ? (
        <div
          className="workflow-more-menu-popover"
          role="menu"
          aria-label={`More actions for ${workflow.name}`}
        >
          <Button
            type="button"
            role="menuitem"
            variant="quiet"
            onClick={() => closeAfter(() => onOpenSettings(workflow))}
          >
            <Settings aria-hidden="true" />
            Settings {workflow.name}
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="quiet"
            disabled={!availability.canDuplicate}
            title={availability.disabledReason}
            onClick={() => closeAfter(() => onDuplicateWorkflow(workflow))}
          >
            <Copy aria-hidden="true" />
            Duplicate {workflow.name}
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="quiet"
            disabled={!availability.canExport}
            title={availability.disabledReason}
            onClick={() => closeAfter(() => onExportWorkflow(workflow))}
          >
            <Download aria-hidden="true" />
            Export {workflow.name}
          </Button>
          <Button
            type="button"
            role="menuitem"
            variant="quiet"
            disabled={!availability.canDelete}
            title={availability.disabledReason}
            onClick={() => closeAfter(() => onDeleteWorkflow(workflow.id))}
          >
            <Trash2 aria-hidden="true" />
            Delete {workflow.name}
          </Button>
          {availability.disabledReason ? (
            <small className="workflow-more-menu-reason">{availability.disabledReason}</small>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
