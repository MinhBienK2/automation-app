import type { GraphNode } from "../../../types/workflow";

export type NodeContextMenuProps = {
  node: GraphNode | null;
  calledSubflowName?: string | null;
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onHelp: () => void;
  onOpenSubflowDetail?: () => void;
  onDelete: () => void;
};

export function NodeContextMenu({
  node,
  calledSubflowName = null,
  x,
  y,
  onClose,
  onCopy,
  onDuplicate,
  onHelp,
  onOpenSubflowDetail,
  onDelete,
}: NodeContextMenuProps) {
  if (!node) return null;
  const canDelete = node.node_type !== "start";

  return (
    <div
      aria-label="Node actions"
      className="graph-node-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      {onOpenSubflowDetail ? (
        <button
          type="button"
          role="menuitem"
          aria-label={`Open subflow ${calledSubflowName ?? node.label}`}
          onClick={onOpenSubflowDetail}
        >
          Open subflow
        </button>
      ) : null}
      <button type="button" role="menuitem" onClick={onDuplicate}>
        Duplicate
      </button>
      <button type="button" role="menuitem" onClick={onCopy}>
        Copy
      </button>
      <button type="button" role="menuitem" onClick={onHelp}>
        Help
      </button>
      <button type="button" role="menuitem" onClick={onDelete} disabled={!canDelete}>
        Delete
      </button>
    </div>
  );
}

export type LinkContextMenuProps = {
  edge: { id: string } | null;
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
};

export function LinkContextMenu({
  edge,
  x,
  y,
  onClose,
  onDelete,
}: LinkContextMenuProps) {
  if (!edge) return null;

  return (
    <div
      aria-label="Link actions"
      className="graph-node-context-menu graph-link-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <button type="button" role="menuitem" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}
