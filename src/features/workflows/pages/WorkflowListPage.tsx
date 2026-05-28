import { useEffect, useMemo, useState } from "react";
import { CircleDot, Plus, Upload } from "lucide-react";
import type {
  RunState,
  WorkflowRunSnapshot,
  WorkflowSchedule,
  WorkflowSummary,
} from "../../../types/workflow";
import { CommandRegion } from "../../../components/patterns/CommandRegion";
import { StatePanel } from "../../../components/patterns/StatePanel";
import { StaleTargetPanel } from "../../../components/patterns/StaleTargetPanel";
import { StatusCluster } from "../../../components/patterns/StatusCluster";
import { TableShell } from "../../../components/patterns/TableShell";
import { Button } from "../../../components/ui/button";
import type { StaleTargetDescriptor } from "../../../lib/missionControlNavigation";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { runStatusLabel } from "../../../lib/workflowUi";
import { WorkflowLibraryDetailPanel } from "../components/WorkflowLibraryDetailPanel";
import { WorkflowLibraryFilters } from "../components/WorkflowLibraryFilters";
import { WorkflowLibraryTable } from "../components/WorkflowLibraryTable";
import {
  buildActiveRunMap,
  buildScheduledWorkflowSet,
  filterWorkflowLibraryItems,
  getWorkflowFilterOptions,
  selectWorkflowFallback,
  type WorkflowLibraryFilterId,
  type WorkflowLibrarySortId,
} from "../lib/workflowLibrary";

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  workflowDialogMode: "create" | "edit" | null;
  workflowNameDraft: string;
  appError: string;
  runState: RunState;
  runSnapshots: WorkflowRunSnapshot[];
  schedules?: WorkflowSchedule[];
  activeRunWorkflowName?: string | null;
  staleTarget?: StaleTargetDescriptor | null;
  onWorkflowNameDraftChange: (name: string) => void;
  onSubmitWorkflowDialog: (event: React.FormEvent) => void;
  onOpenCreateWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowSummary) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => void;
  onRunWorkflow: (workflow: WorkflowSummary) => void;
  onStopRun: (runId: string) => void;
  onOpenExportWorkflow: (workflow: WorkflowSummary) => void;
  onImportWorkflowPackageFile: (file: File | null) => void;
  onRecordWorkflow: () => void;
  onCloseWorkflowDialog: () => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  onRefreshTarget?: () => void;
  onOpenList?: () => void;
  onOpenOverview?: () => void;
  onClearStaleTarget?: () => void;
};

export function WorkflowListPage({
  workflows,
  workflowDialogMode,
  workflowNameDraft,
  appError,
  runState,
  runSnapshots,
  schedules = [],
  activeRunWorkflowName,
  staleTarget,
  onWorkflowNameDraftChange,
  onSubmitWorkflowDialog,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onDuplicateWorkflow,
  onRunWorkflow,
  onStopRun,
  onOpenExportWorkflow,
  onImportWorkflowPackageFile,
  onRecordWorkflow,
  onCloseWorkflowDialog,
  onOpenWorkflow,
  onDeleteWorkflow,
  onRefreshTarget,
  onOpenList,
  onOpenOverview,
  onClearStaleTarget,
}: WorkflowListPageProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<WorkflowLibraryFilterId>("all");
  const [sort, setSort] = useState<WorkflowLibrarySortId>("recent");
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [duplicateCandidate, setDuplicateCandidate] =
    useState<WorkflowSummary | null>(null);
  const workflowDialogTitle =
    workflowDialogMode === "create" ? "Create Workflow" : "Edit Workflow";
  const workflowDialogDescription =
    workflowDialogMode === "create"
      ? "Name the workflow before building its automation graph."
      : "Rename the workflow without changing its graph.";
  const workflowNameLabel =
    workflowDialogMode === "create" ? "New workflow name" : "Workflow name";
  const activeRunsByWorkflow = useMemo(
    () => buildActiveRunMap(runSnapshots),
    [runSnapshots],
  );
  const scheduledWorkflowIds = useMemo(
    () => buildScheduledWorkflowSet(schedules),
    [schedules],
  );
  const workflowLibraryContext = useMemo(
    () => ({ activeRunsByWorkflow, scheduledWorkflowIds }),
    [activeRunsByWorkflow, scheduledWorkflowIds],
  );
  const filterOptions = useMemo(
    () => getWorkflowFilterOptions(workflowLibraryContext),
    [workflowLibraryContext],
  );
  const visibleWorkflows = useMemo(
    () =>
      filterWorkflowLibraryItems(workflows, {
        context: workflowLibraryContext,
        filter,
        search,
        sort,
      }),
    [filter, search, sort, workflowLibraryContext, workflows],
  );
  const selectedWorkflow = selectWorkflowFallback(selectedWorkflowId, visibleWorkflows);
  const runStatusText =
    runState.status === "idle"
      ? null
      : `${runStatusLabel(runState)}${activeRunWorkflowName ? `: ${activeRunWorkflowName}` : ""}`;
  const activeRunCount = activeRunsByWorkflow.size;

  useEffect(() => {
    if (selectedWorkflow?.id !== selectedWorkflowId) {
      setSelectedWorkflowId(selectedWorkflow?.id ?? null);
    }
  }, [selectedWorkflow?.id, selectedWorkflowId]);

  function clearLibraryFilters() {
    setSearch("");
    setFilter("all");
  }

  function confirmDuplicateWorkflow() {
    if (!duplicateCandidate) return;
    onDuplicateWorkflow(duplicateCandidate);
    setDuplicateCandidate(null);
  }

  return (
    <section className="app-screen workflow-list-screen">
      <CommandRegion
        ariaLabel="Workflow library header"
        eyebrow="Mission Control Workspace"
        title="Workflows"
        description="Find, run, package, duplicate, and delete saved workflows."
        status={
          <StatusCluster
            ariaLabel="Workflow summary"
            items={[
              { label: `${workflows.length} workflows`, tone: "neutral" },
              { label: `${activeRunCount} active runs`, tone: activeRunCount > 0 ? "active" : "muted" },
              ...(runStatusText ? [{ label: runStatusText, tone: "active" as const }] : []),
            ]}
          />
        }
        primaryAction={
          <Button shape="pill" type="button" onClick={onOpenCreateWorkflow}>
            <Plus aria-hidden="true" />
            Create Workflow
          </Button>
        }
        secondaryActions={
          <>
            <label className="workflow-import-button">
              <Upload aria-hidden="true" />
              Import Workflow
              <input
                aria-label="Workflow package file"
                className="workflow-package-file-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  onImportWorkflowPackageFile(event.currentTarget.files?.[0] ?? null);
                  event.currentTarget.value = "";
                }}
              />
            </label>
            <Button variant="secondary" shape="pill" type="button" onClick={onRecordWorkflow}>
              <CircleDot aria-hidden="true" />
              Record Workflow
            </Button>
          </>
        }
      />

      {appError ? (
        <p className="field-error" role="alert">
          {appError}
        </p>
      ) : null}

      {staleTarget ? (
        <StaleTargetPanel
          descriptor={staleTarget}
          onRefresh={onRefreshTarget}
          onOpenList={onOpenList}
          onOpenOverview={onOpenOverview}
          onClear={onClearStaleTarget}
        />
      ) : null}

      {workflows.length === 0 ? (
        <StatePanel
          tone="neutral"
          title="No workflows yet"
          description="Create, record, or import a workflow to begin building an automation graph."
          primaryAction={
            <Button type="button" onClick={onOpenCreateWorkflow}>
              Create Workflow
            </Button>
          }
          secondaryAction={
            <>
              <Button type="button" variant="secondary" onClick={onRecordWorkflow}>
                Record Workflow
              </Button>
              <label className="workflow-import-button">
                <Upload aria-hidden="true" />
                Import Workflow
                <input
                  aria-label="Workflow package file"
                  className="workflow-package-file-input"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    onImportWorkflowPackageFile(event.currentTarget.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
            </>
          }
        />
      ) : (
        <TableShell
          title="Workflow library"
          toolbar={
            <WorkflowLibraryFilters
              search={search}
              filter={filter}
              sort={sort}
              filters={filterOptions}
              resultCount={visibleWorkflows.length}
              totalCount={workflows.length}
              onSearchChange={setSearch}
              onFilterChange={setFilter}
              onSortChange={setSort}
              onClear={clearLibraryFilters}
            />
          }
          state={
            visibleWorkflows.length === 0 ? (
              <StatePanel
                tone="neutral"
                title="No matching workflows"
                description="Clear search and filters to show the full workflow library."
                primaryAction={
                  <Button type="button" variant="secondary" onClick={clearLibraryFilters}>
                    Clear search and filters
                  </Button>
                }
              />
            ) : undefined
          }
          detail={
            <WorkflowLibraryDetailPanel
              workflow={selectedWorkflow}
              context={workflowLibraryContext}
              onOpenWorkflow={onOpenWorkflow}
              onOpenSettings={onOpenEditWorkflow}
              onRunWorkflow={onRunWorkflow}
              onStopRun={onStopRun}
              onDuplicateWorkflow={setDuplicateCandidate}
              onExportWorkflow={onOpenExportWorkflow}
              onDeleteWorkflow={onDeleteWorkflow}
            />
          }
        >
          <WorkflowLibraryTable
            workflows={visibleWorkflows}
            context={workflowLibraryContext}
            selectedWorkflowId={selectedWorkflow?.id ?? null}
            onSelectWorkflow={setSelectedWorkflowId}
            onOpenWorkflow={onOpenWorkflow}
            onOpenSettings={onOpenEditWorkflow}
            onRunWorkflow={onRunWorkflow}
            onStopRun={onStopRun}
            onDuplicateWorkflow={setDuplicateCandidate}
            onExportWorkflow={onOpenExportWorkflow}
            onDeleteWorkflow={onDeleteWorkflow}
          />
        </TableShell>
      )}

      <Dialog
        open={Boolean(duplicateCandidate)}
        onOpenChange={(open) => {
          if (!open) setDuplicateCandidate(null);
        }}
      >
        {duplicateCandidate ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Workflow</p>
              <DialogTitle>Duplicate Workflow</DialogTitle>
              <DialogDescription>
                Create {`Copy of ${duplicateCandidate.name}`} as a separate workflow.
              </DialogDescription>
            </DialogHeader>
            <DialogBody>
              <ul className="workflow-consequence-list">
                <li>Saved graph and non-storage local settings are copied.</li>
                <li>Browser identity, profile, and fingerprint are fresh for the copy.</li>
                <li>Run from selected starts disabled for the copied workflow.</li>
              </ul>
            </DialogBody>
            <DialogFooter className="form-actions">
              <Button type="button" onClick={confirmDuplicateWorkflow}>
                Duplicate Workflow
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDuplicateCandidate(null)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog
        open={Boolean(workflowDialogMode)}
        onOpenChange={(open) => {
          if (!open) onCloseWorkflowDialog();
        }}
      >
        {workflowDialogMode ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Workflow</p>
              <DialogTitle>{workflowDialogTitle}</DialogTitle>
              <DialogDescription>{workflowDialogDescription}</DialogDescription>
            </DialogHeader>

            <form className="workflow-dialog-form" onSubmit={onSubmitWorkflowDialog}>
              <Label htmlFor="workflow-name">
                {workflowNameLabel}
              </Label>
              <Input
                autoFocus
                id="workflow-name"
                value={workflowNameDraft}
                onChange={(event) =>
                  onWorkflowNameDraftChange(event.currentTarget.value)
                }
                placeholder="Login flow"
              />
              {appError ? <p className="field-error">{appError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  {workflowDialogMode === "create" ? "Create Workflow" : "Save Changes"}
                </Button>
                <Button variant="secondary" type="button" onClick={onCloseWorkflowDialog}>
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
    </section>
  );
}
