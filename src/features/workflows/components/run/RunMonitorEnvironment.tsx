import { useState, type JSX, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

type RunMonitorEnvironmentProps = {
  initialVariables?: Array<{ name: string; value: string }> | null;
  profileVariables?: Array<{ name: string; value: string }> | null;
  traces: any[];
  stepIndex: number;
  trace?: any;
};

import {
  VariableTreeNode,
  EnvironmentChangeNode,
  buildVariableTree,
  buildEnvironmentChangeTree,
  getVariablesStateAtStep,
  formatVariableValue,
  countLeaves,
} from "../../lib/runMonitorTree";

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
      <div className={itemClass} style={indent} role="treeitem">
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
        role="treeitem"
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
        <div className="run-monitor-env-tree-children" role="group">
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
      <div className={itemClass} style={indent} role="treeitem">
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
        role="treeitem"
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
        <div className="run-monitor-env-tree-children" role="group">
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
  profileVariables,
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
  const prevVars = getVariablesStateAtStep(initialVariables, traces, stepIndex - 1, profileVariables);
  const addedSet = new Set(added);
  const changedSet = new Set(changed);

  const changeTree = buildEnvironmentChangeTree(added, changed, removed, values, prevVars);

  return (
    <div className="run-monitor-env-panel" onClick={(e) => e.stopPropagation()}>
      <div className="run-monitor-env-section-title">Environment changes</div>

      {hasChanges ? (
        <div className="run-monitor-env-changes-list" role="tree" aria-label="Environment changes">
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
              profileVariables,
            );
            const tree = buildVariableTree(currentVars);
            if (tree.length === 0) {
              return (
                <p className="run-monitor-env-empty">No active variables.</p>
              );
            }
            return (
              <div className="run-monitor-env-all-list" role="tree" aria-label="Active Variables">
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
