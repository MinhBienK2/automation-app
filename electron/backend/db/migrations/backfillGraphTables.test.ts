// @vitest-environment node

import { describe, expect, test } from "vitest";
import { WorkflowRepository } from "../../features/workflows/workflowRepository.js";
import { assembleGraphFromTables, assembleSubflowGraphFromTables } from "../../features/workflows/normalizedGraphRepository.js";
import type { WorkflowGraph } from "../../../src/types/workflow.js";
import { TestDbAdapter } from "../testDbAdapter.js";

function sampleGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: null, ports: [] },
      { id: "nav", node_type: "action", label: "Navigate", position: { x: 100, y: 0 }, ports: [],
        config: { type: "navigate", config: { url: "https://example.com" } } },
      { id: "end", node_type: "end_success", label: "End", position: { x: 200, y: 0 }, config: null, ports: [] },
    ],
    edges: [
      { id: "e1", source_node_id: "start", source_port: "out", target_node_id: "nav", target_port: "in" },
      { id: "e2", source_node_id: "nav", source_port: "out", target_node_id: "end", target_port: "in" },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

describe("save writes to normalized tables", () => {
  test("saveWorkflowGraph writes to normalized tables", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    // Modify graph and save
    const updated = { ...graph, nodes: [...graph.nodes, { id: "extra", node_type: "end_failure", label: "Extra", position: { x: 0, y: 0 }, config: null, ports: [] }] };
    await repo.saveWorkflowGraph(wf.id, updated);

    // Verify normalized tables have the updated nodes
    const fromTables = await assembleGraphFromTables(db, wf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.nodes).toHaveLength(4);
    expect(fromTables!.nodes[3].id).toBe("extra");
  });

  test("saveSubflowGraph writes to normalized tables", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const sf = await repo.createSubflow(project.id, "Sub", "", graph);

    const updated = { ...graph, edges: [...graph.edges] };
    await repo.saveSubflowGraph(sf.id, updated);

    const fromTables = await assembleSubflowGraphFromTables(db, sf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.edges).toHaveLength(2);
  });

  test("getWorkflowGraph reads from normalized tables", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    const loaded = await repo.getWorkflowGraph(wf.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes).toHaveLength(3);
    expect(loaded!.nodes[1].config).toEqual(graph.nodes[1].config);
  });

  test("saveWorkflowGraph concurrently preserves integrity and succeeds", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    // Create two updated graph states to save concurrently
    const updated1 = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: "extra1", node_type: "action" as const, label: "Extra 1", position: { x: 0, y: 0 }, config: null, ports: [] }
      ]
    };
    const updated2 = {
      ...graph,
      nodes: [
        ...graph.nodes,
        { id: "extra2", node_type: "action" as const, label: "Extra 2", position: { x: 0, y: 0 }, config: null, ports: [] }
      ]
    };

    // Run saves concurrently
    await expect(
      Promise.all([
        repo.saveWorkflowGraph(wf.id, updated1),
        repo.saveWorkflowGraph(wf.id, updated2),
      ])
    ).resolves.not.toThrow();

    // Verify it ends up in a consistent state (the last one saved, or either, but without duplicate key errors)
    const fromTables = await assembleGraphFromTables(db, wf.id);
    expect(fromTables).not.toBeNull();
    // It should have exactly 4 nodes (start, nav, end, and either extra1 or extra2)
    expect(fromTables!.nodes).toHaveLength(4);
  });
});
