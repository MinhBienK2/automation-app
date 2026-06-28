// @vitest-environment node

import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAppPaths, initializeDatabase } from "./database.js";
import { WorkflowRepository } from "./workflowRepository.js";
import { backfillGraphTables, writeGraphToNormalizedTables } from "./backfillGraphTables.js";
import { assembleGraphFromTables, assembleSubflowGraphFromTables } from "./normalizedGraphRepository.js";
import type { WorkflowGraph } from "../../../src/types/workflow.js";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "backfill-test-"));
}

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

describe("backfillGraphTables", () => {
  test("backfills workflows and subflows from graph_json", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    const sf = repo.createSubflow(project.id, "Sub", "", graph);

    // Clear normalized tables to simulate pre-backfill state
    db.exec("DELETE FROM workflow_nodes");
    db.exec("DELETE FROM workflow_edges");
    db.exec("DELETE FROM subflow_nodes");
    db.exec("DELETE FROM subflow_edges");
    db.exec("DELETE FROM app_meta");

    const report = backfillGraphTables(db);
    expect(report.scanned).toBe(2);
    expect(report.backfilled).toBe(2);
    expect(report.skipped).toBe(0);

    // Verify nodes exist
    const wfNodes = db.prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ?").all(wf.id);
    expect(wfNodes).toHaveLength(3);

    const sfNodes = db.prepare("SELECT * FROM subflow_nodes WHERE subflow_id = ?").all(sf.id);
    expect(sfNodes).toHaveLength(3);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("second run is a no-op (gated by app_meta)", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    repo.createWorkflow("Test", sampleGraph(), new Date(), { projectId: repo.createProject("Main").id });

    backfillGraphTables(db);
    const report2 = backfillGraphTables(db);
    expect(report2.scanned).toBe(0);
    expect(report2.backfilled).toBe(0);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("skips already-populated workflows (idempotent)", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: repo.createProject("Main").id });

    // Clear app_meta so backfill runs, but leave nodes in place
    db.exec("DELETE FROM app_meta");

    const report = backfillGraphTables(db);
    expect(report.skipped).toBeGreaterThanOrEqual(1);
    // No duplicate nodes
    const nodes = db.prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ?").all(wf.id);
    expect(nodes).toHaveLength(3);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("dual-write on save", () => {
  test("saveWorkflowGraph writes to both graph_json and normalized tables", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    // Modify graph and save
    const updated = { ...graph, nodes: [...graph.nodes, { id: "extra", node_type: "end_failure", label: "Extra", position: { x: 0, y: 0 }, config: null, ports: [] }] };
    repo.saveWorkflowGraph(wf.id, updated);

    // Verify normalized tables have the updated nodes
    const fromTables = assembleGraphFromTables(db, wf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.nodes).toHaveLength(4);
    expect(fromTables!.nodes[3].id).toBe("extra");

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("saveSubflowGraph writes to both graph_json and normalized tables", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const sf = repo.createSubflow(project.id, "Sub", "", graph);

    const updated = { ...graph, edges: [...graph.edges] };
    repo.saveSubflowGraph(sf.id, updated);

    const fromTables = assembleSubflowGraphFromTables(db, sf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.edges).toHaveLength(2);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("getWorkflowGraph reads from normalized tables", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    const loaded = repo.getWorkflowGraph(wf.id);
    expect(loaded).not.toBeNull();
    expect(loaded!.nodes).toHaveLength(3);
    expect(loaded!.nodes[1].config).toEqual(graph.nodes[1].config);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
