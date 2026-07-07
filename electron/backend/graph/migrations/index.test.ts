// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import { MIGRATIONS, runMigrations } from "./index.js";
import type { Migration } from "./types.js";

function baselineGraph(version: number): WorkflowGraph {
  return {
    version,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [],
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("migration runner", () => {
  test("empty migrations list returns graph unchanged", () => {
    const { runMigrations: runWithEmpty } = makeRunner([]);
    const graph = baselineGraph(1);
    const result = runWithEmpty(graph);
    expect(result.graph).toEqual(graph);
    expect(result.applied).toEqual([]);
    expect(result.failed).toBeNull();
  });

  test("graph at v1, migrations [v2, v3] applies both, final version = 3", () => {
    const { runMigrations: runWith } = makeRunner([
      {
        version: 2,
        description: "bump to v2",
        up: (g) => ({ ...g, version: 2 }),
      },
      {
        version: 3,
        description: "bump to v3",
        up: (g) => ({ ...g, version: 3 }),
      },
    ]);
    const result = runWith(baselineGraph(1));
    expect(result.graph.version).toBe(3);
    expect(result.applied).toEqual([
      { version: 2, description: "bump to v2" },
      { version: 3, description: "bump to v3" },
    ]);
    expect(result.failed).toBeNull();
  });

  test("graph at v3, migrations [v2, v3] is no-op, no new notes", () => {
    const { runMigrations: runWith } = makeRunner([
      {
        version: 2,
        description: "bump to v2",
        up: (g) => ({ ...g, version: 2 }),
      },
      {
        version: 3,
        description: "bump to v3",
        up: (g) => ({ ...g, version: 3 }),
      },
    ]);
    const graph: WorkflowGraph = { ...baselineGraph(3), migration_notes: [] };
    const result = runWith(graph);
    expect(result.graph.version).toBe(3);
    expect(result.applied).toEqual([]);
  });

  test("migration throws returns pre-failure graph and failed populated", () => {
    const { runMigrations: runWith } = makeRunner([
      {
        version: 2,
        description: "ok",
        up: (g) => ({ ...g, version: 2 }),
      },
      {
        version: 3,
        description: "boom",
        up: () => {
          throw new Error("intentional failure");
        },
      },
    ]);
    const result = runWith(baselineGraph(1));
    expect(result.graph.version).toBe(2);
    expect(result.applied).toEqual([{ version: 2, description: "ok" }]);
    expect(result.failed).toEqual({ version: 3, error: "intentional failure" });
  });

  test("non-monotonic registry throws at module load", () => {
    expect(() =>
      makeRunner([
        { version: 3, description: "a", up: (g) => g },
        { version: 2, description: "b", up: (g) => g },
      ]),
    ).toThrow(/not monotonic/);
  });

  test("idempotent: running twice produces identical output", () => {
    const result1 = runMigrations(baselineGraph(1));
    const result2 = runMigrations(result1.graph);
    expect(result2.graph).toEqual(result1.graph);
    expect(result2.applied).toEqual([]);
  });

  test("baseline migration (real registry) upgrades v1 to v5 with migration_notes", () => {
    const result = runMigrations(baselineGraph(1));
    expect(result.graph.version).toBe(5);
    expect(result.graph.migration_notes).toEqual([]);
    expect(result.applied).toHaveLength(4);
    expect(result.failed).toBeNull();
  });

  test("migration 002 renames evaluate_logic and evaluate_expression nodes to check_conditions and calculate_value", () => {
    const legacyGraph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "node1",
          node_type: "evaluate_logic",
          label: "Logic",
          position: { x: 0, y: 0 },
          ports: [],
          config: { output_name: "test_logic", mode: "visual" },
        },
        {
          id: "node2",
          node_type: "evaluate_expression",
          label: "Expression",
          position: { x: 0, y: 0 },
          ports: [],
          config: { output_name: "test_expr", expression: "1 + 1" },
        },
        {
          id: "node3",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          ports: [],
          config: null,
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      migration_notes: [],
    };

    const result = runMigrations(legacyGraph);
    expect(result.graph.version).toBe(5);
    expect(result.graph.nodes[0].node_type).toBe("check_conditions");
    expect(result.graph.nodes[1].node_type).toBe("calculate_value");
    expect(result.graph.nodes[2].node_type).toBe("start");
    expect(result.applied).toHaveLength(3);
    expect(result.applied[0].version).toBe(3);
    expect(result.applied[1].version).toBe(4);
    expect(result.applied[2].version).toBe(5);
  });

  test("migration 003 converts update_list_variable nodes to new granular list nodes", () => {
    const legacyGraph: WorkflowGraph = {
      version: 3,
      nodes: [
        {
          id: "push-node",
          node_type: "update_list_variable",
          label: "Push Value",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myList", operation: "push", value: "hello", value_type: "text" },
        },
        {
          id: "pop-node",
          node_type: "update_list_variable",
          label: "Pop Value",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myList", operation: "pop" },
        },
        {
          id: "remove-val-node",
          node_type: "update_list_variable",
          label: "Remove Value",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myList", operation: "remove_by_value", value: "42", value_type: "number" },
        },
        {
          id: "merge-unique-node",
          node_type: "update_list_variable",
          label: "Merge Unique",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myList", operation: "merge_unique", value: "otherList" },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      migration_notes: [],
    };

    const result = runMigrations(legacyGraph);
    expect(result.graph.version).toBe(5);
    
    expect(result.graph.nodes[0].node_type).toBe("add_to_list");
    expect(result.graph.nodes[0].config).toEqual({
      name: "myList",
      position: "end",
      value_type: "text",
      value: "hello",
    });

    expect(result.graph.nodes[1].node_type).toBe("remove_from_list_by_index");
    expect(result.graph.nodes[1].config).toEqual({
      name: "myList",
      index: "last",
    });

    expect(result.graph.nodes[2].node_type).toBe("remove_from_list_by_value");
    expect(result.graph.nodes[2].config).toEqual({
      name: "myList",
      value_type: "number",
      value: "42",
    });

    expect(result.graph.nodes[3].node_type).toBe("merge_lists");
    expect(result.graph.nodes[3].config).toEqual({
      name: "myList",
      value: "otherList",
      unique: true,
    });

    expect(result.applied).toHaveLength(2);
    expect(result.applied[0].version).toBe(4);
    expect(result.applied[1].version).toBe(5);
  });

  test("migration 004 converts update_object_variable nodes to new granular object nodes", () => {
    const legacyGraph: WorkflowGraph = {
      version: 4,
      nodes: [
        {
          id: "merge-node",
          node_type: "update_object_variable",
          label: "Merge Object",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myObj", operation: "merge", value: '{"a": 1}' },
        },
        {
          id: "set-key-node",
          node_type: "update_object_variable",
          label: "Set Property",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myObj", operation: "set_key", property_key: "b.c", property_value: "hello", property_value_type: "text" },
        },
        {
          id: "delete-key-node",
          node_type: "update_object_variable",
          label: "Remove Property",
          position: { x: 0, y: 0 },
          ports: [],
          config: { name: "myObj", operation: "delete_key", property_key: "b.c" },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
      migration_notes: [],
    };

    const result = runMigrations(legacyGraph);
    expect(result.graph.version).toBe(5);

    expect(result.graph.nodes[0].node_type).toBe("merge_objects");
    expect(result.graph.nodes[0].config).toEqual({
      name: "myObj",
      value: '{"a": 1}',
      deep: false,
    });

    expect(result.graph.nodes[1].node_type).toBe("set_object_property");
    expect(result.graph.nodes[1].config).toEqual({
      name: "myObj",
      property_key: "b.c",
      value_type: "text",
      value: "hello",
    });

    expect(result.graph.nodes[2].node_type).toBe("remove_object_property");
    expect(result.graph.nodes[2].config).toEqual({
      name: "myObj",
      property_key: "b.c",
    });

    expect(result.applied).toHaveLength(1);
    expect(result.applied[0].version).toBe(5);
  });

  test("real registry is monotonic", () => {
    const versions = MIGRATIONS.map((m) => m.version);
    for (let i = 1; i < versions.length; i++) {
      expect(versions[i]).toBeGreaterThan(versions[i - 1]);
    }
  });
});

function makeRunner(migrations: Migration[]) {
  // Re-implement the minimal runner to test with a custom registry.
  // We avoid importing the real assertMonotonic so we can inject bad input.
  for (let i = 1; i < migrations.length; i++) {
    if (migrations[i].version <= migrations[i - 1].version) {
      throw new Error("Migration registry is not monotonic");
    }
  }
  return {
    runMigrations(graph: WorkflowGraph) {
      const applied: Array<{ version: number; description: string }> = [];
      let current = graph;
      for (const migration of migrations) {
        if (migration.version <= current.version) continue;
        try {
          current = migration.up(current);
          applied.push({ version: migration.version, description: migration.description });
        } catch (error) {
          return {
            graph: current,
            applied,
            failed: {
              version: migration.version,
              error: error instanceof Error ? error.message : String(error),
            },
          };
        }
      }
      return { graph: current, applied, failed: null };
    },
  };
}
