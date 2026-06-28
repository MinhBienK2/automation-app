import { useCallback, useEffect, useState } from "react";
import { History, RotateCcw, Tag, X, Eye } from "lucide-react";
import { IconButton } from "../../../components/ui/icon-button";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import type { WorkflowGraph, RevisionSummary, RevisionDetail } from "../../../types/workflow";
import {
  listWorkflowRevisions,
  listSubflowRevisions,
  getWorkflowRevision,
  getSubflowRevision,
  restoreWorkflowRevision,
  restoreSubflowRevision,
  tagWorkflowRevision,
  tagSubflowRevision,
  untagWorkflowRevision,
  untagSubflowRevision,
} from "../../../lib/workflowApi";

type RevisionHistoryDrawerProps = {
  open: boolean;
  ownerId: string;
  ownerKind: "workflow" | "subflow";
  onClose: () => void;
  onRestore: (graph: WorkflowGraph) => void;
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

  const loadRevisions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const list = ownerKind === "workflow"
        ? await listWorkflowRevisions(ownerId, { limit: 100 })
        : await listSubflowRevisions(ownerId, { limit: 100 });
      setRevisions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load revisions");
    } finally {
      setIsLoading(false);
    }
  }, [ownerId, ownerKind]);

  useEffect(() => {
    if (open) {
      void loadRevisions();
    }
  }, [open, loadRevisions]);

  const handlePreview = useCallback(async (revision: RevisionSummary) => {
    setIsPreviewLoading(true);
    setActionError(null);
    try {
      const detail = ownerKind === "workflow"
        ? await getWorkflowRevision(revision.id)
        : await getSubflowRevision(revision.id);
      setPreviewRevision(detail);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to load revision");
    } finally {
      setIsPreviewLoading(false);
    }
  }, [ownerKind]);

  const handleConfirmRestore = useCallback(async () => {
    if (!restoreCandidate) return;
    setIsRestoring(true);
    setActionError(null);
    try {
      const result = ownerKind === "workflow"
        ? await restoreWorkflowRevision(ownerId, restoreCandidate.id, {
            comment: `Restored revision ${restoreCandidate.revision_number}`,
          })
        : await restoreSubflowRevision(ownerId, restoreCandidate.id, {
            comment: `Restored revision ${restoreCandidate.revision_number}`,
          });
      const restoredRevision = ownerKind === "workflow"
        ? await getWorkflowRevision(restoreCandidate.id)
        : await getSubflowRevision(restoreCandidate.id);
      if (restoredRevision) {
        const graph = JSON.parse(restoredRevision.graph_snapshot_json) as WorkflowGraph;
        onRestore(graph);
      }
      setRestoreCandidate(null);
      await loadRevisions();
      void result;
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to restore revision");
    } finally {
      setIsRestoring(false);
    }
  }, [restoreCandidate, ownerKind, ownerId, onRestore, loadRevisions]);

  const handleTag = useCallback(async (revision: RevisionSummary) => {
    const tagValue = tagDraft[revision.id]?.trim();
    if (!tagValue) return;
    setActionError(null);
    try {
      if (ownerKind === "workflow") {
        await tagWorkflowRevision(revision.id, tagValue);
      } else {
        await tagSubflowRevision(revision.id, tagValue);
      }
      setTagDraft((prev) => ({ ...prev, [revision.id]: "" }));
      await loadRevisions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to tag revision");
    }
  }, [tagDraft, ownerKind, loadRevisions]);

  const handleUntag = useCallback(async (revision: RevisionSummary) => {
    if (!revision.tag) return;
    setActionError(null);
    try {
      if (ownerKind === "workflow") {
        await untagWorkflowRevision(revision.id);
      } else {
        await untagSubflowRevision(revision.id);
      }
      await loadRevisions();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to untag revision");
    }
  }, [ownerKind, loadRevisions]);

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

      {actionError ? (
        <p className="revision-history-error" role="alert">{actionError}</p>
      ) : null}

      {isLoading ? (
        <p className="revision-history-empty">Loading revisions...</p>
      ) : error ? (
        <p className="revision-history-error" role="alert">{error}</p>
      ) : revisions.length === 0 ? (
        <p className="revision-history-empty">No revisions yet. Save the graph to create one.</p>
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
    </aside>
  );
}
