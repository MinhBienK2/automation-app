// @vitest-environment node

import { describe, expect, test } from "vitest";
import { createAppPaths, initializeDatabase } from "./database.js";
import { WorkflowRepository } from "./workflowRepository.js";
import { migrateAllGraphs } from "./migrateAllGraphs.js";
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
  test("getWorkflowGraph migrates v1 to v2 and persists back", () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const workflow = repo.createWorkflow("Test", baselineV1Graph(), new Date(), { projectId: project.id });
    // Insert a raw v1 graph directly
    db.prepare("UPDATE workflows SET graph_json = ? WHERE id = ?").run(
      JSON.stringify(baselineV1Graph()),
      workflow.id,
    );

    // First read: should migrate and persist
    const graph = repo.getWorkflowGraph(workflow.id);
    expect(graph).not.toBeNull();
    expect(graph!.version).toBe(2);
    expect(graph!.migration_notes).toEqual([]);

    // Second read: should be a no-op (already v2)
    const graph2 = repo.getWorkflowGraph(workflow.id);
    expect(graph2!.version).toBe(2);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("getSubflowGraph migrates v1 to v2 and persists back", () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const subflow = repo.createSubflow(project.id, "Test Subflow", "", baselineV1Graph());

    const graph = repo.getSubflowGraph(subflow.id);
    expect(graph).not.toBeNull();
    expect(graph!.version).toBe(2);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("migrateAllGraphs (eager startup)", () => {
  test("migrates all workflows and subflows, logs to migration_log", () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test Workflow", baselineV1Graph(), new Date(), { projectId: project.id });
    // Reset to raw v1 graph to test eager migration
    db.prepare("UPDATE workflows SET graph_json = ? WHERE id = ?").run(
      JSON.stringify(baselineV1Graph()),
      wf.id,
    );
    repo.createSubflow(project.id, "Test Subflow", "", baselineV1Graph());

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

  test("second run is a no-op", () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = initializeDatabase(paths);
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

  test("malformed JSON is logged as failure, not crashed", () => {
    const root = tempRoot();
    const paths = createAppPaths(root);
    const db = initializeDatabase(paths);
    const repo = new WorkflowRepository(db);

    const wf = repo.createWorkflow("Bad Workflow", baselineV1Graph());
    db.prepare("UPDATE workflows SET graph_json = ? WHERE id = ?").run(
      "{ not valid json",
      wf.id,
    );

    const report = migrateAllGraphs(db);
    expect(report.failed).toBeGreaterThanOrEqual(1);

    const logs = db.prepare("SELECT * FROM migration_log WHERE failure_json IS NOT NULL").all();
    expect(logs.length).toBeGreaterThanOrEqual(1);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
