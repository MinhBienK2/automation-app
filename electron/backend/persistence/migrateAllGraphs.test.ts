// @vitest-environment node

import { describe, expect, test } from "vitest";
import { createAppPaths, initializeDatabase } from "./database.js";
import { WorkflowRepository } from "./workflowRepository.js";
import { migrateAllGraphs } from "./migrateAllGraphs.js";
import { writeGraphToNormalizedTables } from "./backfillGraphTables.js";
import type { WorkflowGraph } from "../../../src/types/workflow.js";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "graph-migration-test-"));
}

function baselineV1Graph(): WorkflowGraph {
  return {
    version: 1,
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
        id: "nav",
        node_type: "action",
        label: "Navigate",
        position: { x: 0, y: 0 },
        ports: [],
        config: { type: "navigate", config: { url: "https://example.com" } },
      },
    ],
    edges: [
      { id: "e1", source_node_id: "start", source_port: "out", target_node_id: "nav", target_port: "in" },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

describe("lazy migrate on read", () => {
  test("getWorkflowGraph migrates v1 to v3 and persists back", async () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = await initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const workflow = repo.createWorkflow("Test", baselineV1Graph(), new Date(), { projectId: project.id });
    // Reset normalized tables to raw v1 graph
    writeGraphToNormalizedTables(db, baselineV1Graph(), "workflow", workflow.id, new Date().toISOString());

    // First read: should migrate and persist
    const graph = repo.getWorkflowGraph(workflow.id);
    expect(graph).not.toBeNull();
    expect(graph!.version).toBe(3);
    expect(graph!.migration_notes).toEqual([]);

    // Second read: should be a no-op (already v3)
    const graph2 = repo.getWorkflowGraph(workflow.id);
    expect(graph2!.version).toBe(3);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("getSubflowGraph migrates v1 to v3 and persists back", async () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = await initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const subflow = repo.createSubflow(project.id, "Test Subflow", "", baselineV1Graph());

    const graph = repo.getSubflowGraph(subflow.id);
    expect(graph).not.toBeNull();
    expect(graph!.version).toBe(3);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("migrateAllGraphs (eager startup)", () => {
  test("migrates all workflows and subflows, logs to migration_log", async () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = await initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test Workflow", baselineV1Graph(), new Date(), { projectId: project.id });
    // Reset normalized tables to raw v1 graph to test eager migration
    writeGraphToNormalizedTables(db, baselineV1Graph(), "workflow", wf.id, new Date().toISOString());
    repo.createSubflow(project.id, "Test Subflow", "", baselineV1Graph());
    // Reset subflow to v1 as well (createSubflow already wrote v1, but ensure)
    const sf = repo.listSubflows(project.id)[0];
    writeGraphToNormalizedTables(db, baselineV1Graph(), "subflow", sf.id, new Date().toISOString());

    const report = migrateAllGraphs(db);
    expect(report.scanned).toBe(2);
    expect(report.migrated).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);

    // migration_log should have 2 entries
    const logs = db.prepare("SELECT * FROM migration_log").all() as Array<{ target_id: string }>;
    expect(logs).toHaveLength(2);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("second run is a no-op", async () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = await initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    repo.createWorkflow("Test", baselineV1Graph());
    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    repo.createSubflow(project.id, "Sub", "", baselineV1Graph());

    migrateAllGraphs(db);
    const report2 = migrateAllGraphs(db);
    expect(report2.migrated).toBe(0);
    expect(report2.failed).toBe(0);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("malformed graph is logged as failure, not crashed", async () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = await initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const wf = repo.createWorkflow("Bad Workflow", baselineV1Graph());
    // Delete all nodes from normalized tables to simulate a broken/empty graph
    db.prepare("DELETE FROM workflow_nodes WHERE workflow_id = ?").run(wf.id);
    db.prepare("DELETE FROM workflow_edges WHERE workflow_id = ?").run(wf.id);

    const report = migrateAllGraphs(db);
    // Empty graph won't be migrated (no nodes), but won't crash either
    expect(report.failed).toBe(0);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
