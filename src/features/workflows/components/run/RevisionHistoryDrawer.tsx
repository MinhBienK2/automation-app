import { useCallback, useEffect, useMemo, useState } from "react";
import { History, RotateCcw, Tag, X, Eye, Trash2 } from "lucide-react";
import { IconButton } from "../../../../components/ui/icon-button";
import { Button } from "../../../../components/ui/button";
import { Input } from "../../../../components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../../components/ui/dialog";
import type { WorkflowGraph, RevisionSummary, RevisionDetail } from "../../../../types/workflow";
import {
  revisionApi,
  type RevisionApi,
} from "../../lib/revisionApi";

type RevisionHistoryDrawerProps = {
  open: boolean;
  ownerId: string;
  ownerKind: "workflow" | "subflow";
  onClose: () => void;
  onRestore: (graph: WorkflowGraph) => void;
  onSaveBackup?: (options?: { comment?: string; tag?: string }) => void | Promise<unknown>;
  currentGraph?: WorkflowGraph;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function RevisionHistoryDrawer({
  open,
  ownerId,
  ownerKind,
  onClose,
  onRestore,
  onSaveBackup,
}: RevisionHistoryDrawerProps) {
  const [revisions, setRevisions] = useState<RevisionSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewRevision, setPreviewRevision] = useState<RevisionDetail | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [restoreCandidate, setRestoreCandidate] = useState<RevisionSummary | null>(null);
  const [isRestoring, setIsRestoring] = useState(false);
  const [tagDraft, setTagDraft] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  // Manual Backup States
  const [isBackupDialogOpen, setIsBackupDialogOpen] = useState(false);
  const [backupComment, setBackupComment] = useState("");
  const [backupTag, setBackupTag] = useState("");
  const [isSavingBackup, setIsSavingBackup] = useState(false);

  // Deletion States
  const [deleteCandidate, setDeleteCandidate] = useState<RevisionSummary | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const api: RevisionApi = useMemo(() => revisionApi(ownerKind), [ownerKind]);

  const loadRevisions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = await api.list(ownerId);
      setRevisions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revisions");
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, api]);

  useEffect(() => {
    if (open) {
      void loadRevisions();
    }
  }, [open, loadRevisions]);

  const handlePreview = useCallback(async (revision: RevisionSummary) => {
    setIsPreviewLoading(true);
    setActionError(null);
    try {
      const detail = await api.get(revision.id);
      setPreviewRevision(detail);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load revision");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [api]);

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    setActionError(null);
    try {
      const result = await api.restore(ownerId, restoreCandidate.id, {
        comment: `Restored revision ${restoreCandidate.revision_number}`,
      });

      // Fetch the newly restored active graph (containing duplicated/remapped subflows) from DB
      const restoredGraph = await api.getGraph(ownerId);

      if (restoredGraph) {
        onRestore(restoredGraph);
      }
      
      setRestoreCandidate(null);
      await loadRevisions();
      void result;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to restore revision");
    } finally {
      setIsRestoring(false);
    }
  }, [restoreCandidate, api, ownerId, onRestore, loadRevisions]);

  const handleCreateBackup = useCallback(async () => {
    if (!onSaveBackup || !backupComment.trim()) return;
    setIsSavingBackup(true);
    setActionError(null);
    try {
      await onSaveBackup({
        comment: backupComment.trim(),
        tag: backupTag.trim() || undefined,
      });
      setIsBackupDialogOpen(false);
      await loadRevisions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to create backup");
    } finally {
      setIsSavingBackup(false);
    }
  }, [onSaveBackup, backupComment, backupTag, loadRevisions]);

  const handleTag = useCallback(async (revision: RevisionSummary) => {
    const tagValue = tagDraft[revision.id]?.trim();
    if (!tagValue) return;
    setActionError(null);
    try {
      await api.tag(revision.id, tagValue);
      setTagDraft((prev) => ({ ...prev, [revision.id]: "" }));
      await loadRevisions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to tag revision");
    }
  }, [tagDraft, api, loadRevisions]);

  const handleUntag = useCallback(async (revision: RevisionSummary) => {
    if (!revision.tag) return;
    setActionError(null);
    try {
      await api.untag(revision.id);
      await loadRevisions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to untag revision");
    }
  }, [api, loadRevisions]);

  const handleConfirmDelete = useCallback(async () => {
    if (!deleteCandidate) return;
    setIsDeleting(true);
    setActionError(null);
    try {
      await api.deleteRevision(deleteCandidate.id);
      setDeleteCandidate(null);
      await loadRevisions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete revision");
    } finally {
      setIsDeleting(false);
    }
  }, [deleteCandidate, api, loadRevisions]);

  if (!open) return null;

  return (
    <aside
      className="revision-history-drawer"
      aria-label="Revision history drawer"
    >
      <div className="revision-history-header">
        <div className="revision-history-title">
          <History aria-hidden="true" />
          <h2>Revision History</h2>
        </div>
        <IconButton
          label="Close revision history"
          type="button"
          variant="ghost"
          onClick={onClose}
        >
          <X aria-hidden="true" />
        </IconButton>
      </div>

      {onSaveBackup && (
        <div style={{ padding: "12px 16px", borderBottom: "1px solid rgba(0,0,0,0.1)" }}>
          <Button
            type="button"
            style={{ width: "100%", display: "flex", justifyContent: "center", gap: "8px" }}
            onClick={() => {
              setBackupComment("");
              setBackupTag("");
              setIsBackupDialogOpen(true);
            }}
          >
            <History style={{ width: "16px", height: "16px" }} />
            Create Backup
          </Button>
        </div>
      )}

      {actionError ? (
        <p className="revision-history-error" role="alert">{actionError}</p>
      ) : null}

      {isLoading ? (
        <p className="revision-history-empty">Loading revisions...</p>
      ) : error ? (
        <p className="revision-history-error" role="alert">{error}</p>
      ) : revisions.length === 0 ? (
        <p className="revision-history-empty">No backups yet. Create a backup to see it here.</p>
      ) : (
        <ul className="revision-list" role="list">
          {revisions.map((revision) => (
            <li
              key={revision.id}
              className={`revision-item ${revision.tag ? "revision-tagged" : ""}`}
            >
              <div className="revision-item-header">
                <span className="revision-number">#{revision.revision_number}</span>
                {revision.tag ? (
                  <span className="revision-tag-badge">{revision.tag}</span>
                ) : null}
                <span className="revision-size">{formatBytes(revision.size_bytes)}</span>
              </div>
              <div className="revision-meta">
                <time dateTime={revision.created_at}>{formatTimestamp(revision.created_at)}</time>
                {revision.created_by ? (
                  <span className="revision-author">by {revision.created_by}</span>
                ) : null}
              </div>
              {revision.comment ? (
                <p className="revision-comment">{revision.comment}</p>
              ) : null}
              <div className="revision-actions">
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => void handlePreview(revision)}
                  disabled={isPreviewLoading}
                >
                  <Eye aria-hidden="true" />
                  Preview
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setRestoreCandidate(revision)}
                  disabled={isRestoring}
                >
                  <RotateCcw aria-hidden="true" />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  onClick={() => setDeleteCandidate(revision)}
                  disabled={isRestoring || isDeleting}
                  aria-label={`Delete revision ${revision.revision_number}`}
                  style={{ color: "var(--failure)" }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete
                </Button>
                {revision.tag ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    type="button"
                    onClick={() => void handleUntag(revision)}
                    disabled={isRestoring}
                  >
                    <Tag aria-hidden="true" />
                    Untag
                  </Button>
                ) : (
                  <div className="revision-tag-input">
                    <input
                      type="text"
                      placeholder="tag"
                      value={tagDraft[revision.id] ?? ""}
                      onChange={(e) =>
                        setTagDraft((prev) => ({ ...prev, [revision.id]: e.target.value }))
                      }
                      maxLength={32}
                      aria-label={`Tag for revision ${revision.revision_number}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      type="button"
                      onClick={() => void handleTag(revision)}
                      disabled={!tagDraft[revision.id]?.trim()}
                    >
                      <Tag aria-hidden="true" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewRevision} onOpenChange={(o) => !o && setPreviewRevision(null)}>
        <DialogContent className="revision-preview-dialog">
          <DialogHeader>
            <DialogTitle>
              Revision #{previewRevision?.revision_number} Preview
            </DialogTitle>
            <DialogDescription>
              {previewRevision ? formatTimestamp(previewRevision.created_at) : ""}
            </DialogDescription>
          </DialogHeader>
          <pre className="revision-preview-json" aria-label="Revision graph snapshot JSON">
            {previewRevision
              ? JSON.stringify(JSON.parse(previewRevision.graph_snapshot_json), null, 2)
              : "Loading..."}
          </pre>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setPreviewRevision(null)}
            >
              Close
            </Button>
            {previewRevision ? (
              <Button
                type="button"
                onClick={() => {
                  setRestoreCandidate(previewRevision as unknown as RevisionSummary);
                  setPreviewRevision(null);
                }}
              >
                <RotateCcw aria-hidden="true" />
                Restore this revision
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Restore Dialog */}
      <Dialog open={!!restoreCandidate} onOpenChange={(o) => !o && setRestoreCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Restore Revision #{restoreCandidate?.revision_number}?</DialogTitle>
            <DialogDescription>
              This will replace the current graph with the snapshot from this revision.
              The current state is captured as a new revision so you can undo this restore.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setRestoreCandidate(null)}
              disabled={isRestoring}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void handleConfirmRestore()}
              disabled={isRestoring}
            >
              {isRestoring ? "Restoring..." : "Restore"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteCandidate} onOpenChange={(o) => !o && setDeleteCandidate(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Backup History?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete backup revision #{deleteCandidate?.revision_number}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setDeleteCandidate(null)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => void handleConfirmDelete()}
              disabled={isDeleting}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Backup Dialog */}
      <Dialog open={isBackupDialogOpen} onOpenChange={(o) => !o && setIsBackupDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Backup for {ownerKind === "workflow" ? "Workflow" : "Subflow"}</DialogTitle>
            <DialogDescription>
              Save the current state as a backup milestone. Subflows belonging to this workflow will also be backed up automatically.
            </DialogDescription>
          </DialogHeader>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", margin: "16px 0" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", fontWeight: 500 }}>Backup description (Required)</label>
              <Input
                type="text"
                placeholder="e.g. Before changing logic, or v1.0.0 stable"
                value={backupComment}
                onChange={(e) => setBackupComment(e.target.value)}
                className="w-full"
                maxLength={200}
                aria-label="Backup description"
              />
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "14px", fontWeight: 500 }}>Tag / Label (Optional)</label>
              <Input
                type="text"
                placeholder="e.g. stable-v1 (Revisions with tags are preserved from auto-cleanup)"
                value={backupTag}
                onChange={(e) => setBackupTag(e.target.value)}
                className="w-full"
                maxLength={32}
                aria-label="Backup tag"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="secondary"
              type="button"
              onClick={() => setIsBackupDialogOpen(false)}
              disabled={isSavingBackup}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleCreateBackup}
              disabled={isSavingBackup || !backupComment.trim()}
            >
              {isSavingBackup ? "Saving..." : "Save Backup"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </aside>
  );
}
