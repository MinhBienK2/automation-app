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

export function isPlainObject(val: unknown): val is Record<string, unknown> {
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
    if (existing && existing.kind === "leaf" && leaf.kind === "leaf") {
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
      (n): n is Extract<EnvironmentChangeNode, { kind: "leaf" }> =>
        n.kind === "leaf" && n.path === head,
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
  profileVariables?: Array<{ name: string; value: string }> | null | undefined,
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  if (profileVariables) {
    for (const v of profileVariables) {
      if (v.name.trim()) {
        state[v.name] = v.value;
      }
    }
  }
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

export function countLeaves(nodes: VariableTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === "leaf") count += 1;
    else count += countLeaves(node.children);
  }
  return count;
}
