import { Copy, Eye, Plus, RefreshCw, Settings, Trash2, Download, Upload, GitFork } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "../../../components/ui/button";
import { Alert } from "../../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { IconButton } from "../../../components/ui/icon-button";
import { Input } from "../../../components/ui/input";
import type { SubflowSummary, SubflowUsage } from "../../../types/workflow";
import { SearchInput } from "../../../components/ui/search-input";
import { FormField } from "../../../components/ui/form-field";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { Select } from "../../../components/ui/select";
import { SubflowSettingsDialog } from "../components/dialogs/SubflowSettingsDialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, SortableTableHead, type SortDirection } from "../../../components/ui/table";

type SubflowSortKey = "name" | "used_by";

type SubflowListPageProps = {
  subflows: SubflowSummary[];
  subflowUsagesBySubflow: Record<string, SubflowUsage[]>;
  loading: boolean;
  error: string;
  onCreateSubflow: (input: { name: string; description?: string | null }) => Promise<void>;
  onUpdateSubflow: (
    subflow: SubflowSummary,
    input: { name: string },
  ) => Promise<void>;
  onDuplicateSubflow: (subflow: SubflowSummary) => Promise<void>;
  onDeleteSubflow: (subflow: SubflowSummary) => Promise<void>;
  onOpenSubflow: (subflowId: string) => void;
  onRefresh: () => void;
  onExportSubflow: (subflowId: string) => void;
  onImportSubflowFile: (file: File | null) => void;
};

export function SubflowListPage({
  subflows,
  subflowUsagesBySubflow,
  loading,
  error,
  onCreateSubflow,
  onUpdateSubflow,
  onDuplicateSubflow,
  onDeleteSubflow,
  onOpenSubflow,
  onRefresh,
  onExportSubflow,
  onImportSubflowFile,
}: SubflowListPageProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descriptionDraft, setDescriptionDraft] = useState("");
  const [settingsSubflow, setSettingsSubflow] = useState<SubflowSummary | null>(null);
  const [deleteSubflowCandidate, setDeleteSubflowCandidate] = useState<SubflowSummary | null>(null);
  const [localError, setLocalError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [sortKey, setSortKey] = useState<SubflowSortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>("asc");
  const [duplicatingSubflowId, setDuplicatingSubflowId] = useState<string | null>(null);

  async function submitCreateSubflow(event: React.FormEvent) {
    event.preventDefault();
    const name = nameDraft.trim();
    if (!name) {
      setLocalError("Subflow name is required");
      return;
    }
    setCreating(true);
    try {
      await onCreateSubflow({
        name,
        description: descriptionDraft.trim() || null,
      });
      setCreateDialogOpen(false);
      setNameDraft("");
      setDescriptionDraft("");
      setLocalError("");
    } catch (err: any) {
      setLocalError(err.message || "Failed to create subflow");
    } finally {
      setCreating(false);
    }
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setNameDraft("");
    setDescriptionDraft("");
    setLocalError("");
  }

  function handleSort(key: string) {
    const typedKey = key as SubflowSortKey;
    if (sortKey === typedKey) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(typedKey);
      setSortDir("asc");
    }
  }

  const workflowOptions = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(subflowUsagesBySubflow).forEach((usages) => {
      usages.forEach((usage: SubflowUsage) => {
        map.set(usage.workflow_id, usage.workflow_name);
      });
    });
    return Array.from(map, ([value, label]) => ({ value, label })).sort((a, b) =>
      a.label.localeCompare(b.label),
    );
  }, [subflowUsagesBySubflow]);

  const filteredSubflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    let result = subflows;
    if (workflowFilter === "not_used") {
      result = result.filter((sub) => sub.used_by_count === 0);
    } else if (workflowFilter) {
      result = result.filter((sub) =>
        (subflowUsagesBySubflow[sub.id] ?? []).some(
          (usage) => usage.workflow_id === workflowFilter,
        ),
      );
    }
    if (query) {
      result = result.filter(
        (sub) =>
          sub.name.toLowerCase().includes(query) ||
          (sub.description && sub.description.toLowerCase().includes(query)),
      );
    }
    if (sortKey) {
      const dir = sortDir === "asc" ? 1 : -1;
      result = [...result].sort((a, b) => {
        const valueA = sortKey === "name" ? a.name.toLowerCase() : a.used_by_count;
        const valueB = sortKey === "name" ? b.name.toLowerCase() : b.used_by_count;
        if (valueA < valueB) return -1 * dir;
        if (valueA > valueB) return 1 * dir;
        return 0;
      });
    }
    return result;
  }, [subflows, searchQuery, workflowFilter, subflowUsagesBySubflow, sortKey, sortDir]);

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h1 className="sr-only">Subflows</h1>
      {error ? (
        <Alert variant="error" className="text-xs p-3 animate-fade-in">
          {error}
        </Alert>
      ) : null}

      {/* Toolbar Filter */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-2">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
          <SearchInput
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Search subflows..."
            label="Search subflows"
            className="max-w-xs"
          />
          <Select
            aria-label="Filter subflows by workflow"
            searchable
            searchPlaceholder="Search workflows..."
            placeholder="All workflows"
            value={workflowFilter}
            onChange={(event) => setWorkflowFilter(event.currentTarget.value)}
            className="select-sm bg-base-100 border-base-300 min-w-[12rem]"
          >
            <option value="">All workflows</option>
            <option value="not_used">Not used</option>
            {workflowOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="btn-sm"
          >
            <RefreshCw aria-hidden="true" size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>
          <label className="btn btn-secondary btn-sm cursor-pointer relative inline-flex items-center gap-1.5">
            <Upload aria-hidden="true" size={14} />
            <span>Import Subflow</span>
            <input
              aria-label="Subflow package file"
              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
              type="file"
              accept="application/json,.json"
              onChange={(event) => {
                onImportSubflowFile(event.currentTarget.files?.[0] ?? null);
                event.currentTarget.value = "";
              }}
            />
          </label>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="btn-primary btn-sm"
          >
            <Plus aria-hidden="true" size={16} />
            <span>Create Subflow</span>
          </Button>
        </div>
      </div>

      {/* Subflow List */}
      <section className="card bg-base-200 border border-base-300 card-body p-5 flex flex-col" aria-label="Subflow list">
        {filteredSubflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center text-secondary">
            <h2 className="text-sm font-bold text-base-content mb-1">No subflows yet</h2>
            <p className="text-xs">Create one to reuse graph paths across workflows.</p>
          </div>
        ) : (
          <Table>
             <TableHeader>
               <TableRow>
                 <SortableTableHead
                   label="NAME"
                   sortKey="name"
                   activeKey={sortKey}
                   direction={sortDir}
                   onSort={handleSort}
                 />
                 <TableHead>DESCRIPTION</TableHead>
                 <SortableTableHead
                   label="USED BY"
                   sortKey="used_by"
                   activeKey={sortKey}
                   direction={sortDir}
                   onSort={handleSort}
                 />
                 <TableHead className="text-right">ACTIONS</TableHead>
               </TableRow>
             </TableHeader>
              <TableBody>
                {filteredSubflows.map((subflow) => {
                  const isDuplicating = duplicatingSubflowId === subflow.id;
                  return (
                    <TableRow
                      key={subflow.id}
                      data-slot="card"
                      className={`cursor-pointer ${duplicatingSubflowId ? "opacity-60 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (duplicatingSubflowId) return;
                        onOpenSubflow(subflow.id);
                      }}
                    >
                     <TableCell>
                       <div className="flex items-center gap-2.5">
                         <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                           {isDuplicating ? (
                             <span className="loading loading-spinner loading-xs text-primary" />
                           ) : (
                             <GitFork className="w-3.5 h-3.5" />
                           )}
                         </div>
                         <h2
                           className="font-bold text-sm text-base-content cursor-pointer hover:underline hover:text-primary transition-colors"
                           onClick={() => {
                             if (duplicatingSubflowId) return;
                             onOpenSubflow(subflow.id);
                           }}
                         >
                           {subflow.name}
                         </h2>
                       </div>
                     </TableCell>
                     <TableCell className="text-secondary text-xs">{subflow.description || "No description"}</TableCell>
                     <TableCell className="text-secondary text-xs font-semibold">
                       {subflow.used_by_count}{" "}
                       {subflow.used_by_count === 1 ? "workflow" : "workflows"}
                     </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex gap-2 justify-end items-center"
                          onClick={(event) => event.stopPropagation()}
                        >
                         <IconButton
                           label={`Open ${subflow.name}`}
                           type="button"
                           variant="ghost"
                           className="text-fg-primary hover:text-accent w-8 h-8"
                           disabled={duplicatingSubflowId !== null}
                           onClick={() => onOpenSubflow(subflow.id)}
                         >
                           <Eye aria-hidden="true" size={15} />
                         </IconButton>
                         <IconButton
                           label={`Settings ${subflow.name}`}
                           type="button"
                           variant="ghost"
                           className="text-fg-primary hover:text-accent w-8 h-8"
                           disabled={duplicatingSubflowId !== null}
                           onClick={() => setSettingsSubflow(subflow)}
                         >
                           <Settings aria-hidden="true" size={15} />
                         </IconButton>
                         <IconButton
                           label={`Duplicate ${subflow.name}`}
                           type="button"
                           variant="ghost"
                           className="text-fg-primary hover:text-accent w-8 h-8"
                           loading={isDuplicating}
                           disabled={duplicatingSubflowId !== null}
                           onClick={async () => {
                             setDuplicatingSubflowId(subflow.id);
                             try {
                               await onDuplicateSubflow(subflow);
                             } finally {
                               setDuplicatingSubflowId(null);
                             }
                           }}
                         >
                           <Copy aria-hidden="true" size={15} />
                         </IconButton>
                         <IconButton
                           label={`Export ${subflow.name}`}
                           type="button"
                           variant="ghost"
                           className="text-fg-primary hover:text-accent w-8 h-8"
                           disabled={duplicatingSubflowId !== null}
                           onClick={() => onExportSubflow(subflow.id)}
                         >
                           <Download aria-hidden="true" size={15} />
                         </IconButton>
                         <IconButton
                           label={`Delete ${subflow.name}`}
                           type="button"
                           variant="ghost"
                           className="text-error hover:bg-error/10 w-8 h-8"
                           disabled={duplicatingSubflowId !== null}
                           onClick={() => {
                             setDeleteSubflowCandidate(subflow);
                           }}
                         >
                           <Trash2 aria-hidden="true" size={15} />
                         </IconButton>
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
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeCreateDialog();
        }}
      >
        <DialogContent className="workflow-dialog">
          <DialogHeader>
            <p className="eyebrow">Subflow</p>
            <DialogTitle>Create Subflow</DialogTitle>
            <DialogDescription>
              Name a reusable graph path for the current project.
            </DialogDescription>
          </DialogHeader>
          <form className="flex flex-col gap-4 mt-2" onSubmit={submitCreateSubflow}>
            <FormField label="Subflow name" htmlFor="subflow-name">
              <Input
                autoFocus
                id="subflow-name"
                value={nameDraft}
                onChange={(event) => setNameDraft(event.currentTarget.value)}
                placeholder="Login"
                className="input-sm border-base-300 w-full"
              />
            </FormField>
            <FormField label="Description" htmlFor="subflow-description">
              <Input
                id="subflow-description"
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.currentTarget.value)}
                placeholder="Reusable login path"
                className="input-sm border-base-300 w-full"
              />
            </FormField>
            {localError ? <Alert variant="error" className="text-xs p-2.5 mt-2">{localError}</Alert> : null}
            <DialogFooter className="flex gap-2 border-t border-base-300 pt-3 mt-2">
              <Button type="submit" disabled={creating} loading={creating} className="btn-primary">
                Create
              </Button>
              <Button variant="secondary" type="button" disabled={creating} onClick={closeCreateDialog}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      
      <SubflowSettingsDialog
        subflow={settingsSubflow}
        onOpenChange={(open) => {
          if (!open) setSettingsSubflow(null);
        }}
        onSave={async (input) => {
          if (!settingsSubflow) return;
          await onUpdateSubflow(settingsSubflow, input);
        }}
      />
      
      <ConfirmDialog
        open={Boolean(deleteSubflowCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteSubflowCandidate(null);
        }}
        title="Delete Subflow"
        description={`This removes ${deleteSubflowCandidate?.name || ""} from the app. This action cannot be undone.`}
        confirmText="Delete Subflow"
        variant="destructive"
        isLoading={deleting}
        onConfirm={async () => {
          if (deleteSubflowCandidate) {
            setDeleting(true);
            try {
              await onDeleteSubflow(deleteSubflowCandidate);
              setDeleteSubflowCandidate(null);
            } finally {
              setDeleting(false);
            }
          }
        }}
      />
    </div>
  );
}
