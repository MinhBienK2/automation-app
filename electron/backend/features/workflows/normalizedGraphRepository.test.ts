// @vitest-environment node

import { describe, expect, test } from "vitest";
import { WorkflowRepository } from "./workflowRepository.js";
import { assembleGraphFromTables } from "./normalizedGraphRepository.js";
import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import { TestDbAdapter } from "../../db/testDbAdapter.js";
import { sampleGraph } from "../../testSupport/commands.testHelpers.js";

describe("normalized graph tables", () => {
  test("tables exist with correct schema", async () => {
    const db = await TestDbAdapter.create();

    const tablesResult = await db.query("SELECT name FROM sqlite_master WHERE type='table'");
    const tables = tablesResult.map((r) => (r as { name: string }).name);

    expect(tables).toContain("workflow_nodes");
    expect(tables).toContain("workflow_edges");
    expect(tables).toContain("subflow_nodes");
    expect(tables).toContain("subflow_edges");

    const wfColumnsResult = await db.query("PRAGMA table_info(workflows)");
    const wfColumns = wfColumnsResult.map((r) => (r as { name: string }).name);
    expect(wfColumns).toContain("graph_version");
    expect(wfColumns).toContain("viewport_json");
    expect(wfColumns).toContain("migration_notes_json");
  });

  test("assembleGraphFromTables returns null for non-existent workflow", async () => {
    const db = await TestDbAdapter.create();
    const result = await assembleGraphFromTables(db, "nonexistent");
    expect(result).toBeNull();
  });

  test("assembleGraphFromTables produces identical output to legacy reader when populated", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    const fromTables = await assembleGraphFromTables(db, wf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.version).toBe(graph.version);
    expect(fromTables!.nodes).toHaveLength(3);
    expect(fromTables!.edges).toHaveLength(2);
    expect(fromTables!.nodes[0].id).toBe("start");
    expect(fromTables!.nodes[1].config).toEqual(graph.nodes[1].config);
    expect(fromTables!.viewport).toEqual(graph.viewport);
    expect(fromTables!.edges[0].source_port).toBe("out");
  });

  test("saveWorkflowGraph and assembleGraphFromTables preserve edge label, condition, and delay", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    
    const edgeDelay = { type: "random" as const, min_ms: 500, max_ms: 1200 };
    const edgeCondition = { kind: "variable_is_true" as const, name: "my_var" };
    
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: null,
          ports: [],
        },
        {
          id: "end-1",
          node_type: "end_success",
          label: "End",
          position: { x: 200, y: 100 },
          config: null,
          ports: [],
        },
      ],
      edges: [
        {
          id: "edge-1",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "end-1",
          target_port: "in",
          label: "my-label",
          condition: edgeCondition,
          delay: edgeDelay,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
      migration_notes: [],
    };

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test Edge Props", graph, new Date(), { projectId: project.id });

    const fromTables = await assembleGraphFromTables(db, wf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.edges).toHaveLength(1);
    
    const edge = fromTables!.edges[0];
    expect(edge.label).toBe("my-label");
    expect(edge.condition).toEqual(edgeCondition);
    expect(edge.delay).toEqual(edgeDelay);
  });
});
