import { Copy, Eye, Plus, RefreshCw, Settings, Trash2, Download, Upload, GitFork } from "lucide-react";
import { useState, useMemo } from "react";
import { Button } from "../../../components/ui/button";
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
import type { SubflowSummary } from "../../../types/workflow";
import { SearchInput } from "../../../components/ui/search-input";
import { FormField } from "../../../components/ui/form-field";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { SubflowSettingsDialog } from "../components/SubflowSettingsDialog";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../../../components/ui/table";

type SubflowListPageProps = {
  subflows: SubflowSummary[];
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

  const filteredSubflows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return subflows;
    return subflows.filter(
      (sub) =>
        sub.name.toLowerCase().includes(query) ||
        (sub.description && sub.description.toLowerCase().includes(query)),
    );
  }, [subflows, searchQuery]);

  return (
    <div className="flex flex-col gap-4 mt-2">
      <h1 className="sr-only">Subflows</h1>
      {error ? (
        <div className="alert alert-error text-xs p-3 animate-fade-in" role="alert">
          {error}
        </div>
      ) : null}

      {/* Toolbar Filter */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center mb-2">
        <SearchInput
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Search subflows..."
          label="Search subflows"
          className="max-w-xs"
        />
        <div className="flex items-center gap-3">
          <Button
            variant="secondary"
            type="button"
            disabled={loading}
            onClick={onRefresh}
            className="btn-sm rounded-full"
          >
            <RefreshCw aria-hidden="true" size={14} className={loading ? "animate-spin" : ""} />
            <span>Refresh</span>
          </Button>
          <label className="btn btn-secondary btn-sm rounded-full cursor-pointer relative inline-flex items-center gap-1.5">
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
            className="btn-primary btn-sm rounded-full"
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
                <TableHead>NAME</TableHead>
                <TableHead>DESCRIPTION</TableHead>
                <TableHead>USED BY</TableHead>
                <TableHead className="text-right">ACTIONS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSubflows.map((subflow) => (
                <TableRow key={subflow.id} data-slot="card">
                  <TableCell>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
                        <GitFork className="w-3.5 h-3.5" />
                      </div>
                      <h2
                        className="font-bold text-sm text-base-content cursor-pointer hover:underline hover:text-primary transition-colors"
                        onClick={() => onOpenSubflow(subflow.id)}
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
                    <div className="flex gap-2 justify-end items-center">
                      <IconButton
                        label={`Open ${subflow.name}`}
                        type="button"
                        className="btn btn-ghost btn-xs text-fg-primary hover:bg-base-300 w-8 h-8 p-0"
                        onClick={() => onOpenSubflow(subflow.id)}
                      >
                        <Eye aria-hidden="true" size={15} />
                      </IconButton>
                      <IconButton
                        label={`Settings ${subflow.name}`}
                        type="button"
                        className="btn btn-ghost btn-xs text-fg-primary hover:bg-base-300 w-8 h-8 p-0"
                        onClick={() => setSettingsSubflow(subflow)}
                      >
                        <Settings aria-hidden="true" size={15} />
                      </IconButton>
                      <IconButton
                        label={`Duplicate ${subflow.name}`}
                        type="button"
                        className="btn btn-ghost btn-xs text-fg-primary hover:bg-base-300 w-8 h-8 p-0"
                        onClick={() => {
                          void onDuplicateSubflow(subflow);
                        }}
                      >
                        <Copy aria-hidden="true" size={15} />
                      </IconButton>
                      <IconButton
                        label={`Export ${subflow.name}`}
                        type="button"
                        className="btn btn-ghost btn-xs text-fg-primary hover:bg-base-300 w-8 h-8 p-0"
                        onClick={() => onExportSubflow(subflow.id)}
                      >
                        <Download aria-hidden="true" size={15} />
                      </IconButton>
                      <IconButton
                        label={`Delete ${subflow.name}`}
                        type="button"
                        className="btn btn-ghost btn-xs text-error hover:bg-error/10 w-8 h-8 p-0"
                        onClick={() => {
                          setDeleteSubflowCandidate(subflow);
                        }}
                      >
                        <Trash2 aria-hidden="true" size={15} />
                      </IconButton>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
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
        <DialogContent className="workflow-dialog max-w-md">
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
            {localError ? <div className="alert alert-error text-xs p-2.5 mt-2">{localError}</div> : null}
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
