import { useMemo, useState } from "react";
import {
  CircleDot,
  Copy,
  Download,
  Eye,
  MoreHorizontal,
  Pencil,
  Play,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { Select } from "../../../components/ui/select";
import { Badge } from "../../../components/ui/badge";
import type {
  BrowserProfile,
  DesktopTarget,
  ExecutionSurfaceKind,
  WorkflowRunSnapshot,
  WorkflowSummary,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { IconButton } from "../../../components/ui/icon-button";
import { Alert } from "../../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { SearchInput } from "../../../components/ui/search-input";
import { FormField } from "../../../components/ui/form-field";
import { runStatusLabel } from "../../../lib/workflowUi";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortableTableHead, type SortDirection } from "../../../components/ui/table";

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  workflowDialogMode: "create" | "edit" | null;
  workflowNameDraft: string;
  browserProfiles: BrowserProfile[];
  desktopTargets: DesktopTarget[];
  selectedProfileIdDraft: string | null;
  surfaceDraft: ExecutionSurfaceKind;
  selectedDesktopTargetIdDraft: string | null;
  appError: string;
  runSnapshots: WorkflowRunSnapshot[];
  startingWorkflowId?: string | null;
  onWorkflowNameDraftChange: (name: string) => void;
  onSelectedProfileIdDraftChange: (id: string | null) => void;
  onSurfaceDraftChange: (surface: ExecutionSurfaceKind) => void;
  onSelectedDesktopTargetIdDraftChange: (id: string | null) => void;
  onSubmitWorkflowDialog: (event: React.FormEvent) => void;
  onOpenCreateWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowSummary) => void;
  onDuplicateWorkflow: (workflow: WorkflowSummary) => Promise<void>;
  onRunWorkflow: (workflow: WorkflowSummary) => void;
  onStopRun: (runId: string) => void;
  onOpenExportWorkflow: (workflow: WorkflowSummary) => void;
  onImportWorkflowPackageFile: (file: File | null) => void;
  onRecordWorkflow: () => void;
  onCloseWorkflowDialog: () => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
  workflowDialogBusy?: boolean;
};

export function WorkflowListPage({
  workflows,
  workflowDialogMode,
  workflowNameDraft,
  browserProfiles,
  desktopTargets,
  selectedProfileIdDraft,
  surfaceDraft,
  selectedDesktopTargetIdDraft,
  appError,
  runSnapshots,
  startingWorkflowId = null,
  onWorkflowNameDraftChange,
  onSelectedProfileIdDraftChange,
  onSurfaceDraftChange,
  onSelectedDesktopTargetIdDraftChange,
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
  workflowDialogBusy = false,
}: WorkflowListPageProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [sortActive, setSortActive] = useState(false);
  const [duplicatingWorkflowId, setDuplicatingWorkflowId] = useState<string | null>(null);
  const workflowDialogTitle =
    workflowDialogMode === "create" ? "Create Workflow" : "Edit Workflow";
  const workflowDialogDescription =
    workflowDialogMode === "create"
      ? "Name the workflow before building its automation graph."
      : "Rename the workflow without changing its graph.";
  const workflowNameLabel =
    workflowDialogMode === "create" ? "New workflow name" : "Workflow name";

  const activeRunsByWorkflow = new Map(
    runSnapshots
      .filter((snapshot) => snapshot.state.status === "running")
      .map((snapshot) => [snapshot.workflow_id, snapshot]),
  );

  function handleSortName() {
    if (sortActive) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortActive(true);
      setSortDir("asc");
    }
  }

  const filteredWorkflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = workflows;
    if (query) {
      result = result.filter((wf) => wf.name.toLowerCase().includes(query));
    }
    if (sortActive) {
      const dir = sortDir === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return -1 * dir;
        if (nameA > nameB) return 1 * dir;
        return 0;
      });
    }
    return result;
  }, [workflows, searchQuery, sortActive, sortDir]);

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h1 className="sr-only">Workflows</h1>
      {appError ? (
        <Alert variant="error" className="text-xs p-3">
          {appError}
        </Alert>
      ) : null}

      {/* Toolbar Filter */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search workflows..."
          label="Search workflows"
          className="max-w-xs"
        />
        <div className="flex items-center gap-3">
          <label className="btn btn-secondary btn-sm cursor-pointer relative inline-flex items-center gap-1.5">
            <Upload aria-hidden="true" size={14} />
            <span>Import Workflow</span>
            <input
              aria-label="Workflow package file"
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                onImportWorkflowPackageFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Button variant="secondary" onClick={onRecordWorkflow} className="btn-sm flex items-center gap-1">
            <CircleDot aria-hidden="true" size={14} className="text-error animate-pulse" />
            <span>Record Workflow</span>
          </Button>
          <Button onClick={onOpenCreateWorkflow} className="btn-primary btn-sm">
            Create Workflow
          </Button>
        </div>
      </div>

      {/* Workflows Table */}
      <section className="card bg-base-200 border border-base-300 card-body p-5 flex flex-col" aria-label="Workflow list">
        {filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-secondary">
            <h2 className="text-sm font-bold text-base-content mb-1">No workflows yet</h2>
            <p className="text-xs">Create one to begin building an automation graph.</p>
          </div>
        ) : (
          <Table>
             <TableHeader>
               <TableRow>
                 <SortableTableHead
                   label="WORKFLOW"
                   sortKey="name"
                   activeKey={sortActive ? "name" : null}
                   direction={sortDir}
                   onSort={handleSortName}
                 />
                 <TableHead className="text-right">ACTIONS</TableHead>
               </TableRow>
             </TableHeader>
             <TableBody>
               {filteredWorkflows.map((workflow) => {
                 const activeRun = activeRunsByWorkflow.get(workflow.id);
                 const hasActiveRun = Boolean(activeRun);
                 const isDuplicating = duplicatingWorkflowId === workflow.id;
                 return (
                   <TableRow
                     key={workflow.id}
                     data-slot="card"
                     className={`cursor-pointer ${duplicatingWorkflowId ? "opacity-60 cursor-not-allowed" : ""}`}
                     onClick={() => {
                       if (duplicatingWorkflowId) return;
                       onOpenWorkflow(workflow.id);
                     }}
                   >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                          {isDuplicating ? (
                            <span className="loading loading-spinner loading-xs text-primary" />
                          ) : (
                            <Play className="w-3.5 h-3.5 fill-current" />
                          )}
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <h2
                            className="font-bold text-sm text-base-content cursor-pointer hover:underline hover:text-primary transition-colors"
                            onClick={() => {
                              if (duplicatingWorkflowId) return;
                              onOpenWorkflow(workflow.id);
                            }}
                          >
                            {workflow.name}
                          </h2>
                          {workflow.browser_profile_name && (
                            <span className="text-[11px] text-secondary">
                              Profile: <span className="text-fg-primary/80 font-medium">{workflow.browser_profile_name}</span>
                            </span>
                          )}
                        </div>
                        {activeRun ? (
                          <Badge variant="running" className="badge-xs font-semibold uppercase tracking-wider gap-1.5 flex items-center">
                            <span className="w-1.5 h-1.5 rounded-full bg-primary-content animate-ping" />
                            <span>{runStatusLabel(activeRun.state)}</span>
                          </Badge>
                        ) : null}
                      </div>
                    </TableCell>
                     <TableCell className="text-right">
                       <div
                         className="flex gap-2 justify-end items-center"
                         onClick={(event) => event.stopPropagation()}
                       >
                        <IconButton
                          label="View Details"
                          type="button"
                          variant="ghost"
                          className="text-fg-primary hover:text-accent w-8 h-8"
                          disabled={duplicatingWorkflowId !== null}
                          onClick={() => onOpenWorkflow(workflow.id)}
                        >
                          <Eye aria-hidden="true" size={15} />
                        </IconButton>
                        <IconButton
                          label={`Run ${workflow.name}`}
                          type="button"
                          variant="ghost"
                          className="text-primary hover:bg-primary/10 w-8 h-8"
                          disabled={hasActiveRun || (!!startingWorkflowId && startingWorkflowId !== workflow.id) || duplicatingWorkflowId !== null}
                          loading={startingWorkflowId === workflow.id}
                          onClick={() => onRunWorkflow(workflow)}
                        >
                          <Play aria-hidden="true" size={15} />
                        </IconButton>
                        {activeRun ? (
                          <IconButton
                            label={`Stop ${workflow.name}`}
                            type="button"
                            variant="ghost"
                            className="text-error hover:bg-error/10 w-8 h-8"
                            disabled={duplicatingWorkflowId !== null}
                            onClick={() => onStopRun(activeRun.run_id)}
                          >
                            <Square aria-hidden="true" size={15} />
                          </IconButton>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <IconButton
                              label={`More actions for ${workflow.name}`}
                              type="button"
                              variant="ghost"
                              className="text-fg-primary hover:text-accent w-8 h-8"
                              disabled={duplicatingWorkflowId !== null}
                            >
                              <MoreHorizontal aria-hidden="true" size={15} />
                            </IconButton>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem onSelect={() => setTimeout(() => onOpenEditWorkflow(workflow), 0)}>
                              <Pencil aria-hidden="true" size={14} className="mr-1.5 shrink-0" />
                              <span>Edit</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={hasActiveRun || duplicatingWorkflowId !== null}
                              onSelect={async () => {
                                setDuplicatingWorkflowId(workflow.id);
                                try {
                                  await onDuplicateWorkflow(workflow);
                                } finally {
                                   setDuplicatingWorkflowId(null);
                                }
                              }}
                            >
                              <Copy aria-hidden="true" size={14} className="mr-1.5 shrink-0" />
                              <span>Duplicate</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              disabled={hasActiveRun || duplicatingWorkflowId !== null}
                              onSelect={() => setTimeout(() => onOpenExportWorkflow(workflow), 0)}
                            >
                              <Download aria-hidden="true" size={14} className="mr-1.5 shrink-0" />
                              <span>Export</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              variant="destructive"
                              disabled={hasActiveRun || duplicatingWorkflowId !== null}
                              onSelect={() => setTimeout(() => onDeleteWorkflow(workflow.id), 0)}
                            >
                              <Trash2 aria-hidden="true" size={14} className="mr-1.5 shrink-0" />
                              <span>Delete</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </section>

      <Dialog
        open={Boolean(workflowDialogMode)}
        onOpenChange={(open) => {
          if (!open) onCloseWorkflowDialog();
        }}
      >
        <DialogContent className="workflow-dialog">
          {workflowDialogMode ? (
            <>
              <DialogHeader>
                <p className="eyebrow">Workflow</p>
                <DialogTitle>{workflowDialogTitle}</DialogTitle>
                <DialogDescription>{workflowDialogDescription}</DialogDescription>
              </DialogHeader>

              <form className="flex flex-col gap-4 mt-2" onSubmit={onSubmitWorkflowDialog}>
                <FormField label={workflowNameLabel} htmlFor="workflow-name">
                  <Input
                    autoFocus
                    id="workflow-name"
                    value={workflowNameDraft}
                    onChange={(event) =>
                      onWorkflowNameDraftChange(event.currentTarget.value)
                    }
                    placeholder="Login flow"
                    className="input-sm border-base-300 w-full"
                  />
                </FormField>
                {workflowDialogMode === "create" ? (
                  <>
                    <FormField
                      label="Execution Surface"
                      htmlFor="workflow-surface"
                      description="Fixed once the workflow is created. A workflow drives a browser or a desktop application, never both."
                    >
                      <Select
                        id="workflow-surface"
                        value={surfaceDraft}
                        onChange={(event) =>
                          onSurfaceDraftChange(
                            event.currentTarget.value === "desktop" ? "desktop" : "web",
                          )
                        }
                        className="select-sm bg-base-100 border-base-300 w-full"
                      >
                        <option value="web">Web — a browser page</option>
                        <option value="desktop">Desktop — an application window</option>
                      </Select>
                    </FormField>
                    {surfaceDraft === "web" ? (
                      <FormField label="Browser Profile" htmlFor="workflow-profile">
                        <Select
                          id="workflow-profile"
                          value={selectedProfileIdDraft ?? ""}
                          onChange={(event) =>
                            onSelectedProfileIdDraftChange(event.currentTarget.value || null)
                          }
                          className="select-sm bg-base-100 border-base-300 w-full"
                        >
                          {browserProfiles.map((profile) => (
                            <option key={profile.id} value={profile.id}>
                              {profile.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    ) : desktopTargets.length ? (
                      <FormField
                        label="Desktop Target"
                        htmlFor="workflow-desktop-target"
                        description="The application this workflow drives. Changeable later in Workflow Settings."
                      >
                        <Select
                          id="workflow-desktop-target"
                          value={selectedDesktopTargetIdDraft ?? ""}
                          onChange={(event) =>
                            onSelectedDesktopTargetIdDraftChange(
                              event.currentTarget.value || null,
                            )
                          }
                          className="select-sm bg-base-100 border-base-300 w-full"
                        >
                          {desktopTargets.map((target) => (
                            <option key={target.id} value={target.id}>
                              {target.name}
                            </option>
                          ))}
                        </Select>
                      </FormField>
                    ) : (
                      // Not an error: the workflow is still creatable, and a
                      // Target can be chosen later. Saying so here is cheaper
                      // than an empty picker the operator has to interpret.
                      <Alert variant="warning" className="text-xs p-2.5">
                        This project has no Desktop Targets yet. Create the workflow, then add
                        one under Projects → Desktop Targets and pick it in Workflow Settings.
                      </Alert>
                    )}
                  </>
                ) : null}
                {appError ? <Alert variant="error" className="text-xs p-2.5 mt-2">{appError}</Alert> : null}
                <DialogFooter className="flex gap-2 border-t border-base-300 pt-3 mt-2">
                  <Button type="submit" disabled={workflowDialogBusy} loading={workflowDialogBusy} className="btn-primary">
                    {workflowDialogMode === "create" ? "Create" : "Save Changes"}
                  </Button>
                  <Button variant="secondary" type="button" disabled={workflowDialogBusy} onClick={onCloseWorkflowDialog}>
                    Cancel
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
