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
  getWorkflowGraph,
  getSubflowGraph,
  deleteWorkflowRevision,
  deleteSubflowRevision,
} from "../../../lib/api/workflowApi";

export type RevisionOwnerKind = "workflow" | "subflow";

export interface RevisionApi {
  list(ownerId: string): Promise<RevisionSummary[]>;
  get(revisionId: string): Promise<RevisionDetail | null>;
  restore(
    ownerId: string,
    revisionId: string,
    options?: { comment?: string },
  ): Promise<unknown>;
  /** Active graph after a restore landed in the database. */
  getGraph(ownerId: string): Promise<WorkflowGraph | null>;
  tag(revisionId: string, tag: string): Promise<unknown>;
  untag(revisionId: string): Promise<unknown>;
  deleteRevision(revisionId: string): Promise<unknown>;
}

const listOptions = { limit: 100, onlyBackups: true } as const;

/**
 * Owner-kind seam for revision history. Endpoint prefixes (workflow vs
 * subflow) live here so UI consumers never branch on ownerKind.
 */
export function revisionApi(kind: RevisionOwnerKind): RevisionApi {
  if (kind === "workflow") {
    return {
      list: (ownerId) => listWorkflowRevisions(ownerId, { ...listOptions }),
      get: (revisionId) => getWorkflowRevision(revisionId),
      restore: (ownerId, revisionId, options) =>
        restoreWorkflowRevision(ownerId, revisionId, options),
      getGraph: (ownerId) => getWorkflowGraph(ownerId),
      tag: (revisionId, tag) => tagWorkflowRevision(revisionId, tag),
      untag: (revisionId) => untagWorkflowRevision(revisionId),
      deleteRevision: (revisionId) => deleteWorkflowRevision(revisionId),
    };
  }
  return {
    list: (ownerId) => listSubflowRevisions(ownerId, { ...listOptions }),
    get: (revisionId) => getSubflowRevision(revisionId),
    restore: (ownerId, revisionId, options) =>
      restoreSubflowRevision(ownerId, revisionId, options),
    getGraph: (ownerId) => getSubflowGraph(ownerId),
    tag: (revisionId, tag) => tagSubflowRevision(revisionId, tag),
    untag: (revisionId) => untagSubflowRevision(revisionId),
    deleteRevision: (revisionId) => deleteSubflowRevision(revisionId),
  };
}
