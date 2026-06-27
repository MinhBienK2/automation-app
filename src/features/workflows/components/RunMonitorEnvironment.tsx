import { useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type RunMonitorEnvironmentProps = {
  initialVariables?: Array<{ name: string; value: string }> | null;
  traces: any[];
  stepIndex: number;
  trace?: any;
};

export type VariableTreeNode =
  | {
      kind: "leaf";
      name: string;
      path: string;
      value: unknown;
    }
  | {
      kind: "object";
      name: string;
      path: string;
      children: VariableTreeNode[];
    };

export type EnvironmentChangeKind = "added" | "changed" | "removed";

export type EnvironmentChangeNode =
  | {
      kind: "leaf";
      path: string;
      changeKind: EnvironmentChangeKind;
      newValue?: unknown;
      oldValue?: unknown;
    }
  | {
      kind: "object";
      path: string;
      children: EnvironmentChangeNode[];
      addedCount: number;
      changedCount: number;
      removedCount: number;
    };

type MutableObjectNode = {
  kind: "object";
  path: string;
  children: EnvironmentChangeNode[];
  addedCount: number;
  changedCount: number;
  removedCount: number;
  _selfAdded: number;
  _selfChanged: number;
  _selfRemoved: number;
};

function isPlainObject(val: unknown): val is Record<string, unknown> {
  return (
    typeof val === "object" &&
    val !== null &&
    !Array.isArray(val) &&
    Object.getPrototypeOf(val) === Object.prototype
  );
}

// Variable tree (Active Variables)

type TreeBuilderEntry = {
  isLeaf: boolean;
  value?: unknown;
  sourcePath: string;
  children: Map<string, TreeBuilderEntry>;
};

function createEntry(sourcePath: string): TreeBuilderEntry {
  return { isLeaf: false, sourcePath, children: new Map() };
}

function insertPath(
  root: Map<string, TreeBuilderEntry>,
  segments: string[],
  sourcePath: string,
  value: unknown,
) {
  let map = root;
  let entry: TreeBuilderEntry | null = null;
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    let next = map.get(segment);
    if (!next) {
      next = createEntry(sourcePath);
      map.set(segment, next);
    }
    entry = next;
    if (i < segments.length - 1) {
      map = next.children;
    }
  }
  if (entry) {
    if (isPlainObject(value)) {
      for (const [childKey, childVal] of Object.entries(value)) {
        insertPath(
          entry.children,
          [childKey],
          `${sourcePath}.${childKey}`,
          childVal,
        );
      }
    } else {
      entry.isLeaf = true;
      entry.value = value;
      entry.sourcePath = sourcePath;
    }
  }
}

function toTreeNodes(
  map: Map<string, TreeBuilderEntry>,
  parentPath: string,
): VariableTreeNode[] {
  const result: VariableTreeNode[] = [];
  const keys = [...map.keys()].sort();
  for (const key of keys) {
    const entry = map.get(key)!;
    const path = parentPath ? `${parentPath}.${key}` : key;
    if (entry.children.size > 0) {
      result.push({
        kind: "object",
        name: key,
        path,
        children: toTreeNodes(entry.children, path),
      });
    } else {
      result.push({
        kind: "leaf",
        name: key,
        path: entry.sourcePath || path,
        value: entry.value,
      });
    }
  }
  return result;
}

export function buildVariableTree(
  outputs: Record<string, unknown>,
): VariableTreeNode[] {
  const root = new Map<string, TreeBuilderEntry>();
  for (const [key, value] of Object.entries(outputs)) {
    if (key.startsWith("__")) continue;
    const segments = key.split(".");
    insertPath(root, segments, key, value);
  }
  return toTreeNodes(root, "");
}

// Environment change tree

function createMutableObjectNode(path: string): MutableObjectNode {
  return {
    kind: "object",
    path,
    children: [],
    addedCount: 0,
    changedCount: 0,
    removedCount: 0,
    _selfAdded: 0,
    _selfChanged: 0,
    _selfRemoved: 0,
  };
}

function bumpSelfCount(node: MutableObjectNode, kind: EnvironmentChangeKind) {
  if (kind === "added") node._selfAdded += 1;
  if (kind === "changed") node._selfChanged += 1;
  if (kind === "removed") node._selfRemoved += 1;
}

function recomputeObjectCounts(node: MutableObjectNode) {
  const descendant = countAllChanges(node.children);
  node.addedCount = node._selfAdded + descendant.added;
  node.changedCount = node._selfChanged + descendant.changed;
  node.removedCount = node._selfRemoved + descendant.removed;
}

function insertChangeLeaf(
  nodes: EnvironmentChangeNode[],
  segments: string[],
  leaf: EnvironmentChangeNode,
) {
  if (segments.length === 1) {
    const existing = nodes.find((n) => n.path === segments[0]);
    if (existing && existing.kind === "leaf") {
      const objectNode = createMutableObjectNode(segments[0]);
      objectNode.children = [leaf];
      bumpSelfCount(objectNode, existing.changeKind);
      bumpSelfCount(objectNode, leaf.changeKind);
      const idx = nodes.indexOf(existing);
      nodes[idx] = objectNode;
      recomputeObjectCounts(objectNode);
      return;
    }
    nodes.push(leaf);
    return;
  }

  const head = segments[0];
  const tail = segments.slice(1);

  let objectNode = nodes.find(
    (n) => n.kind === "object" && n.path === head,
  ) as MutableObjectNode | undefined;

  if (!objectNode) {
    const existingLeaf = nodes.find(
      (n) => n.kind === "leaf" && n.path === head,
    );
    objectNode = createMutableObjectNode(head);
    if (existingLeaf) {
      bumpSelfCount(objectNode, existingLeaf.changeKind);
      const idx = nodes.indexOf(existingLeaf);
      nodes[idx] = objectNode;
    } else {
      nodes.push(objectNode);
    }
  }

  insertChangeLeaf(objectNode.children, tail, leaf);
  recomputeObjectCounts(objectNode);
}


function countAllChanges(nodes: EnvironmentChangeNode[]) {
  let added = 0,
    changed = 0,
    removed = 0;
  for (const node of nodes) {
    if (node.kind === "leaf") {
      if (node.changeKind === "added") added++;
      if (node.changeKind === "changed") changed++;
      if (node.changeKind === "removed") removed++;
    } else {
      added += node.addedCount;
      changed += node.changedCount;
      removed += node.removedCount;
    }
  }
  return { added, changed, removed };
}

function sortChangeNodes(nodes: EnvironmentChangeNode[]): EnvironmentChangeNode[] {
  return nodes
    .map((node) => {
      if (node.kind === "object") {
        return { ...node, children: sortChangeNodes(node.children) };
      }
      return node;
    })
    .sort((a, b) => {
      if (a.kind === "object" && b.kind === "leaf") return -1;
      if (a.kind === "leaf" && b.kind === "object") return 1;
      return a.path.localeCompare(b.path);
    });
}

export function buildEnvironmentChangeTree(
  added: string[],
  changed: string[],
  removed: string[],
  values: Record<string, unknown>,
  prevVars: Record<string, unknown>,
): EnvironmentChangeNode[] {
  const root: EnvironmentChangeNode[] = [];

  for (const key of added) {
    const segments = key.split(".");
    insertChangeLeaf(
      root,
      segments,
      { kind: "leaf", path: key, changeKind: "added", newValue: values[key] },
    );
  }
  for (const key of changed) {
    const segments = key.split(".");
    insertChangeLeaf(
      root,
      segments,
      { kind: "leaf", path: key, changeKind: "changed", newValue: values[key], oldValue: prevVars[key] },
    );
  }
  for (const key of removed) {
    const segments = key.split(".");
    insertChangeLeaf(
      root,
      segments,
      { kind: "leaf", path: key, changeKind: "removed", oldValue: prevVars[key] },
    );
  }

  return sortChangeNodes(root);
}

export function getVariablesStateAtStep(
  initialVariables: Array<{ name: string; value: string }> | null | undefined,
  traces: any[],
  stepIndex: number,
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  if (initialVariables) {
    for (const v of initialVariables) {
      if (v.name.trim()) {
        state[v.name] = v.value;
      }
    }
  }
  for (let i = 0; i <= stepIndex; i++) {
    const trace = traces[i];
    if (!trace) continue;
    const summary = trace.output_summary;
    const values = trace.output_values ?? {};
    if (summary) {
      for (const key of summary.added_keys) {
        state[key] = values[key];
      }
      for (const key of summary.changed_keys) {
        state[key] = values[key];
      }
      for (const key of summary.removed_keys) {
        delete state[key];
      }
    }
  }
  return state;
}

export function formatVariableValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

function countLeaves(nodes: VariableTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "leaf") count += 1;
    else count += countLeaves(node.children);
  }
  return count;
}

type ChangeTreeNodeViewProps = {
  node: EnvironmentChangeNode;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  prevVars: Record<string, unknown>;
  values: Record<string, unknown>;
};

function ChangeTreeNodeView({
  node,
  depth,
  expanded,
  onToggle,
  prevVars,
  values,
}: ChangeTreeNodeViewProps) {
  const indent = { paddingLeft: `${depth * 14}px` };

  if (node.kind === "leaf") {
    let badge: JSX.Element | null = null;
    let itemClass = "run-monitor-env-item";
    if (node.changeKind === "added") {
      badge = <span className="env-badge badge-added">added</span>;
      itemClass += " env-added";
    } else if (node.changeKind === "changed") {
      badge = <span className="env-badge badge-changed">changed</span>;
      itemClass += " env-changed";
    } else if (node.changeKind === "removed") {
      badge = <span className="env-badge badge-removed">removed</span>;
      itemClass += " env-removed";
    }

    const segments = node.path.split(".");
    const shortName = segments[segments.length - 1];

    return (
      <div className={itemClass} style={indent}>
        {badge}
        <code className="env-key">{shortName}</code>
        <span className="env-separator">:</span>
        {node.changeKind === "changed" ? (
          <>
            <code className="env-value-old">{formatVariableValue(prevVars[node.path])}</code>
            <span className="env-arrow">→</span>
            <code className="env-value-new">{formatVariableValue(values[node.path])}</code>
          </>
        ) : (
          <code className="env-value">
            {formatVariableValue(
              node.changeKind === "added" ? values[node.path] : prevVars[node.path],
            )}
          </code>
        )}
      </div>
    );
  }

  const isExpanded = expanded[node.path] ?? false;
  const total = node.addedCount + node.changedCount + node.removedCount;
  const changeParts: string[] = [];
  if (node.addedCount > 0) changeParts.push(`${node.addedCount} added`);
  if (node.changedCount > 0) changeParts.push(`${node.changedCount} changed`);
  if (node.removedCount > 0) changeParts.push(`${node.removedCount} removed`);

  return (
    <div className="run-monitor-env-tree-group">
      <button
        type="button"
        className="run-monitor-env-tree-toggle"
        style={indent}
        aria-expanded={isExpanded}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(node.path);
        }}
      >
        <span className="run-monitor-env-tree-icon" aria-hidden="true">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        <code className="env-key">{node.path.split(".").pop()}</code>
        <span className="run-monitor-env-tree-meta">
          {changeParts.length > 0 ? changeParts.join(", ") : `${total} changes`}
        </span>
      </button>
      {isExpanded && (
        <div className="run-monitor-env-tree-children">
          {node.children.map((child) => (
            <ChangeTreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              prevVars={prevVars}
              values={values}
            />
          ))}
        </div>
      )}
    </div>
  );
}

type TreeNodeViewProps = {
  node: VariableTreeNode;
  depth: number;
  expanded: Record<string, boolean>;
  onToggle: (path: string) => void;
  addedSet: Set<string>;
  changedSet: Set<string>;
};

function TreeNodeView({
  node,
  depth,
  expanded,
  onToggle,
  addedSet,
  changedSet,
}: TreeNodeViewProps) {
  const indent = { paddingLeft: `${depth * 14}px` };

  if (node.kind === "leaf") {
    const isAdded = addedSet.has(node.path);
    const isChanged = changedSet.has(node.path);
    let badge: JSX.Element | null = null;
    let itemClass = "run-monitor-env-item";
    if (isAdded) {
      badge = <span className="env-badge badge-added">added</span>;
      itemClass += " env-added";
    } else if (isChanged) {
      badge = <span className="env-badge badge-changed">changed</span>;
      itemClass += " env-changed";
    }
    return (
      <div className={itemClass} style={indent}>
        {badge}
        <code className="env-key">{node.name}</code>
        <span className="env-separator">:</span>
        <code className="env-value">{formatVariableValue(node.value)}</code>
      </div>
    );
  }

  const isExpanded = expanded[node.path] ?? false;
  const leafCount = countLeaves(node.children);
  return (
    <div className="run-monitor-env-tree-group">
      <button
        type="button"
        className="run-monitor-env-tree-toggle"
        style={indent}
        aria-expanded={isExpanded}
        onClick={(e) => {
          e.stopPropagation();
          onToggle(node.path);
        }}
      >
        <span className="run-monitor-env-tree-icon" aria-hidden="true">
          {isExpanded ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        <code className="env-key">{node.name}</code>
        <span className="run-monitor-env-tree-meta">
          object · {leafCount} {leafCount === 1 ? "field" : "fields"}
        </span>
      </button>
      {isExpanded && (
        <div className="run-monitor-env-tree-children">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.path}
              node={child}
              depth={depth + 1}
              expanded={expanded}
              onToggle={onToggle}
              addedSet={addedSet}
              changedSet={changedSet}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function RunMonitorEnvironmentPanel({
  initialVariables,
  traces,
  stepIndex,
  trace,
  showAll,
  onToggleShowAll,
}: RunMonitorEnvironmentProps & {
  showAll: boolean;
  onToggleShowAll: (e: ReactMouseEvent) => void;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleNode = (path: string) =>
    setExpanded((prev) => ({ ...prev, [path]: !prev[path] }));

  if (!trace) {
    return (
      <div className="run-monitor-env-panel env-pending">
        Step is currently running or pending...
      </div>
    );
  }

  const summary = trace.output_summary;
  const values = trace.output_values ?? {};

  const added: string[] = summary?.added_keys ?? [];
  const changed: string[] = summary?.changed_keys ?? [];
  const removed: string[] = summary?.removed_keys ?? [];

  const hasChanges = added.length > 0 || changed.length > 0 || removed.length > 0;
  const prevVars = getVariablesStateAtStep(initialVariables, traces, stepIndex - 1);
  const addedSet = new Set(added);
  const changedSet = new Set(changed);

  const changeTree = buildEnvironmentChangeTree(added, changed, removed, values, prevVars);

  return (
    <div className="run-monitor-env-panel" onClick={(e) => e.stopPropagation()}>
      <div className="run-monitor-env-section-title">Environment changes</div>

      {hasChanges ? (
        <div className="run-monitor-env-changes-list">
          {changeTree.map((node) => (
            <ChangeTreeNodeView
              key={node.path}
              node={node}
              depth={0}
              expanded={expanded}
              onToggle={toggleNode}
              prevVars={prevVars}
              values={values}
            />
          ))}
        </div>
      ) : (
        <p className="run-monitor-env-empty">No environment changes at this step.</p>
      )}

      <button
        type="button"
        className="run-monitor-env-toggle"
        onClick={onToggleShowAll}
      >
        {showAll ? "Hide full environment" : "Show full environment"}
      </button>

      {showAll && (
        <div className="run-monitor-env-all-vars">
          <div className="run-monitor-env-section-title">Active Variables</div>
          {(() => {
            const currentVars = getVariablesStateAtStep(
              initialVariables,
              traces,
              stepIndex,
            );
            const tree = buildVariableTree(currentVars);
            if (tree.length === 0) {
              return (
                <p className="run-monitor-env-empty">No active variables.</p>
              );
            }
            return (
              <div className="run-monitor-env-all-list">
                {tree.map((node) => (
                  <TreeNodeView
                    key={node.path}
                    node={node}
                    depth={0}
                    expanded={expanded}
                    onToggle={toggleNode}
                    addedSet={addedSet}
                    changedSet={changedSet}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
