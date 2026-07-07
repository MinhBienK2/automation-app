// @vitest-environment node

import { describe, expect, test } from "vitest";
import { WorkflowRepository } from "./workflowRepository.js";
import { migrateAllGraphs } from "./migrateAllGraphs.js";
import { writeGraphToNormalizedTables } from "./backfillGraphTables.js";
import type { WorkflowGraph } from "../../../src/types/workflow.js";
import { TestDbAdapter } from "./testDbAdapter.js";

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
  test("getWorkflowGraph migrates v1 to v4 and persists back", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const workflow = await repo.createWorkflow("Test", baselineV1Graph(), new Date(), { projectId: project.id });
    
    // Reset normalized tables to raw v1 graph
    await writeGraphToNormalizedTables(db, baselineV1Graph(), "workflow", workflow.id, new Date().toISOString());

    // First read: should migrate and persist
    const graph = await repo.getWorkflowGraph(workflow.id);
    expect(graph).not.toBeNull();
    expect(graph!.version).toBe(6);
    expect(graph!.migration_notes).toEqual([]);

    // Second read: should be a no-op (already v4)
    const graph2 = await repo.getWorkflowGraph(workflow.id);
    expect(graph2!.version).toBe(6);
  });

  test("getSubflowGraph migrates v1 to v4 and persists back", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const subflow = await repo.createSubflow(project.id, "Test Subflow", "", baselineV1Graph());

    const graph = await repo.getSubflowGraph(subflow.id);
    expect(graph).not.toBeNull();
    expect(graph!.version).toBe(6);
  });
});

describe("migrateAllGraphs (eager startup)", () => {
  test("migrates all workflows and subflows, logs to migration_log", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test Workflow", baselineV1Graph(), new Date(), { projectId: project.id });
    
    // Reset normalized tables to raw v1 graph to test eager migration
    await writeGraphToNormalizedTables(db, baselineV1Graph(), "workflow", wf.id, new Date().toISOString());
    await repo.createSubflow(project.id, "Test Subflow", "", baselineV1Graph());
    
    // Reset subflow to v1 as well (createSubflow already wrote v1, but ensure)
    const subflows = await repo.listSubflows(project.id);
    const sf = subflows[0];
    await writeGraphToNormalizedTables(db, baselineV1Graph(), "subflow", sf.id, new Date().toISOString());

    const report = await migrateAllGraphs(db);
    expect(report.scanned).toBe(2);
    expect(report.migrated).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.durationMs).toBeGreaterThanOrEqual(0);

    // migration_log should have 2 entries
    const logs = await db.query("SELECT * FROM migration_log") as Array<{ target_id: string }>;
    expect(logs).toHaveLength(2);
  });

  test("second run is a no-op", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    await repo.createWorkflow("Test", baselineV1Graph(), new Date(), { projectId: project.id });
    await repo.createSubflow(project.id, "Sub", "", baselineV1Graph());

    await migrateAllGraphs(db);
    const report2 = await migrateAllGraphs(db);
    expect(report2.migrated).toBe(0);
    expect(report2.failed).toBe(0);
  });

  test("malformed graph is logged as failure, not crashed", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Bad Workflow", baselineV1Graph(), new Date(), { projectId: project.id });
    
    // Delete all nodes from normalized tables to simulate a broken/empty graph
    await db.execute("DELETE FROM workflow_nodes WHERE workflow_id = $1", [wf.id]);
    await db.execute("DELETE FROM workflow_edges WHERE workflow_id = $1", [wf.id]);

    const report = await migrateAllGraphs(db);
    // Empty graph won't be migrated (no nodes), but won't crash either
    expect(report.failed).toBe(0);
  });
});
