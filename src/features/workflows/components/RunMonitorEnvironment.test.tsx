import { describe, expect, test } from "vitest";
import {
  buildVariableTree,
  buildEnvironmentChangeTree,
  type VariableTreeNode,
} from "../lib/runMonitorTree";

describe("buildVariableTree", () => {
  test("returns empty array for empty input", () => {
    expect(buildVariableTree({})).toEqual([]);
  });

  test("returns a single leaf for a primitive top-level key", () => {
    const tree = buildVariableTree({ count: 5 });
    expect(tree).toHaveLength(1);
    expect(tree[0]).toMatchObject({
      path: "count",
      name: "count",
      kind: "leaf",
      value: 5,
    });
  });

  test("keeps multiple top-level primitives as leaves", () => {
    const tree = buildVariableTree({ a: "x", b: 2, c: true });
    expect(tree.map((node: VariableTreeNode) => node.name).sort()).toEqual(["a", "b", "c"]);
    expect(tree.every((node: VariableTreeNode) => node.kind === "leaf")).toBe(true);
  });

  test("groups dotted keys into a parent object with children", () => {
    const tree = buildVariableTree({
      "user.name": "alice",
      "user.email": "a@b.com",
    });

    expect(tree).toHaveLength(1);
    const userNode = tree[0];
    expect(userNode.kind).toBe("object");
    expect(userNode.name).toBe("user");
    expect(userNode.path).toBe("user");
    if (userNode.kind !== "object") throw new Error("expected object");
    expect(userNode.children).toHaveLength(2);
    expect(userNode.children.map((c: VariableTreeNode) => c.name).sort()).toEqual(["email", "name"]);
  });

  test("prefers nested object value over redundant dotted children with same data", () => {
    const tree = buildVariableTree({
      system: { current_url: { href: "http://example.com" } },
      "system.current_url": { href: "http://example.com" },
      "system.current_url.href": "http://example.com",
    });

    expect(tree).toHaveLength(1);
    const systemNode = tree[0];
    expect(systemNode.kind).toBe("object");
    expect(systemNode.name).toBe("system");
    if (systemNode.kind !== "object") throw new Error("expected object");
    expect(systemNode.children).toHaveLength(1);

    const currentUrlNode = systemNode.children[0];
    expect(currentUrlNode.name).toBe("current_url");
    expect(currentUrlNode.kind).toBe("object");
    if (currentUrlNode.kind !== "object") throw new Error("expected object");
    expect(currentUrlNode.children).toHaveLength(1);
    expect(currentUrlNode.children[0]).toMatchObject({
      name: "href",
      path: "system.current_url.href",
      kind: "leaf",
      value: "http://example.com",
    });
  });

  test("handles deeply nested dotted keys (3+ levels)", () => {
    const tree = buildVariableTree({
      "a.b.c.d": 1,
      "a.b.c.e": 2,
      "a.b.f": 3,
    });

    expect(tree).toHaveLength(1);
    const a = tree[0];
    expect(a.kind).toBe("object");
    if (a.kind !== "object") throw new Error("expected object");
    expect(a.children).toHaveLength(1);

    const b = a.children[0];
    expect(b.name).toBe("b");
    expect(b.kind).toBe("object");
    if (b.kind !== "object") throw new Error("expected object");
    expect(b.children).toHaveLength(2);
    expect(b.children.map((c: VariableTreeNode) => c.name).sort()).toEqual(["c", "f"]);
  });

  test("marks the source path used to derive each leaf", () => {
    const tree = buildVariableTree({
      "user.name": "alice",
    });
    const userNode = tree[0];
    if (userNode.kind !== "object") throw new Error("expected object");
    const nameLeaf = userNode.children[0];
    expect(nameLeaf.path).toBe("user.name");
  });

  test("sorts children alphabetically for stable rendering", () => {
    const tree = buildVariableTree({
      "obj.z": 1,
      "obj.a": 2,
      "obj.m": 3,
    });
    const obj = tree[0];
    if (obj.kind !== "object") throw new Error("expected object");
    expect(obj.children.map((c: VariableTreeNode) => c.name)).toEqual(["a", "m", "z"]);
  });

  test("preserves arrays as leaf values (not expanded as tree)", () => {
    const tree = buildVariableTree({ items: [1, 2, 3] });
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe("leaf");
    if (tree[0].kind !== "leaf") throw new Error("expected leaf");
    expect(tree[0].value).toEqual([1, 2, 3]);
  });

  test("handles null values as leaves", () => {
    const tree = buildVariableTree({ x: null });
    expect(tree).toHaveLength(1);
    expect(tree[0].kind).toBe("leaf");
  });
});

describe("buildEnvironmentChangeTree", () => {
  test("returns empty array for no changes", () => {
    const tree = buildEnvironmentChangeTree([], [], [], {}, {});
    expect(tree).toEqual([]);
  });

  test("groups added dotted keys into object nodes", () => {
    const tree = buildEnvironmentChangeTree(
      ["system", "system.current_url", "system.current_url.href"],
      [],
      [],
      { "system": {}, "system.current_url": {}, "system.current_url.href": "http://example.com" },
      {},
    );
    expect(tree).toHaveLength(1);
    const system = tree[0];
    expect(system.kind).toBe("object");
    expect(system.path).toBe("system");
    if (system.kind === "object") {
      expect(system.addedCount).toBe(3);
    }
  });

  test("combines added, changed and removed nodes", () => {
    const tree = buildEnvironmentChangeTree(
      ["a.x"],
      ["a.y"],
      ["a.z"],
      { "a.x": 1, "a.y": 2 },
      { "a.y": 1, "a.z": 3 },
    );
    expect(tree).toHaveLength(1);
    const a = tree[0];
    expect(a.kind).toBe("object");
    if (a.kind === "object") {
      expect(a.addedCount).toBe(1);
      expect(a.changedCount).toBe(1);
      expect(a.removedCount).toBe(1);
      expect(a.children).toHaveLength(3);
    }
  });
});
