// @vitest-environment node

import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
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

/**
 * Create a legacy DB (pre-PR 2.3) with graph_json columns, then
 * call initializeDatabase to run column migrations.
 */
function createLegacyDb(root: string, graph: WorkflowGraph) {
  const paths = createAppPaths(root);
  fs.mkdirSync(paths.rootDir, { recursive: true });
  const legacy = new DatabaseSync(paths.databasePath);
  legacy.exec(`
    CREATE TABLE projects (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE workflows (
      id TEXT PRIMARY KEY, project_id TEXT, browser_profile_id TEXT,
      name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      tags_json TEXT NOT NULL DEFAULT '[]', graph_json TEXT NOT NULL, settings_json TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE subflows (
      id TEXT PRIMARY KEY, project_id TEXT NOT NULL, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', tags_json TEXT NOT NULL DEFAULT '[]',
      graph_json TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    INSERT INTO projects (id, name, created_at, updated_at) VALUES ('p1', 'Main', '1', '1');
    INSERT INTO workflows (id, project_id, name, graph_json, created_at, updated_at)
      VALUES ('wf1', 'p1', 'Test', '${JSON.stringify(graph).replace(/'/g, "''")}', '1', '1');
    INSERT INTO subflows (id, project_id, name, graph_json, created_at, updated_at)
      VALUES ('sf1', 'p1', 'Sub', '${JSON.stringify(graph).replace(/'/g, "''")}', '1', '1');
  `);
  legacy.close();
  return paths;
}

describe("backfillGraphTables", () => {
  test("backfills workflows and subflows from legacy graph_json", async () => {
    const root = tempRoot();
    const graph = sampleGraph();
    const paths = createLegacyDb(root, graph);
    const db = await initializeDatabase(paths);

    const report = backfillGraphTables(db);
    expect(report.scanned).toBe(2);
    expect(report.backfilled).toBe(2);
    expect(report.skipped).toBe(0);

    // Verify nodes exist in normalized tables
    const wfNodes = db.prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ?").all("wf1");
    expect(wfNodes).toHaveLength(3);

    const sfNodes = db.prepare("SELECT * FROM subflow_nodes WHERE subflow_id = ?").all("sf1");
    expect(sfNodes).toHaveLength(3);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("second run is a no-op (gated by app_meta)", async () => {
    const root = tempRoot();
    const graph = sampleGraph();
    const paths = createLegacyDb(root, graph);
    const db = await initializeDatabase(paths);

    backfillGraphTables(db);
    const report2 = backfillGraphTables(db);
    expect(report2.scanned).toBe(0);
    expect(report2.backfilled).toBe(0);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("skips already-populated workflows (idempotent)", async () => {
    const root = tempRoot();
    const graph = sampleGraph();
    const paths = createLegacyDb(root, graph);
    const db = await initializeDatabase(paths);

    // Populate normalized tables manually before backfill
    writeGraphToNormalizedTables(db, graph, "workflow", "wf1", new Date().toISOString());
    writeGraphToNormalizedTables(db, graph, "subflow", "sf1", new Date().toISOString());
    // Clear app_meta so backfill runs
    db.exec("DELETE FROM app_meta");

    const report = backfillGraphTables(db);
    expect(report.skipped).toBeGreaterThanOrEqual(1);
    // No duplicate nodes
    const nodes = db.prepare("SELECT * FROM workflow_nodes WHERE workflow_id = ?").all("wf1");
    expect(nodes).toHaveLength(3);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("no-op on fresh DB without graph_json column", async () => {
    const root = tempRoot();
    const db = await initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    repo.createWorkflow("Test", sampleGraph(), new Date(), { projectId: repo.createProject("Main").id });

    // Fresh DB has no graph_json column, so backfill is a no-op
    const report = backfillGraphTables(db);
    expect(report.scanned).toBe(0);
    expect(report.backfilled).toBe(0);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("save writes to normalized tables", () => {
  test("saveWorkflowGraph writes to normalized tables", async () => {
    const root = tempRoot();
    const db = await initializeDatabase(createAppPaths(root));
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

  test("saveSubflowGraph writes to normalized tables", async () => {
    const root = tempRoot();
    const db = await initializeDatabase(createAppPaths(root));
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

  test("getWorkflowGraph reads from normalized tables", async () => {
    const root = tempRoot();
    const db = await initializeDatabase(createAppPaths(root));
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
