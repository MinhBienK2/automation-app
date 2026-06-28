// @vitest-environment node

import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAppPaths, initializeDatabase } from "./database.js";
import { WorkflowRepository } from "./workflowRepository.js";
import { assembleGraphFromTables } from "./normalizedGraphRepository.js";
import type { WorkflowGraph } from "../../../src/types/workflow.js";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "normalized-graph-test-"));
}

function sampleGraph(): WorkflowGraph {
  return {
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
        id: "nav-1",
        node_type: "action",
        label: "Navigate",
        position: { x: 100, y: 50 },
        ports: [],
        config: { type: "navigate", config: { url: "https://example.com" } },
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
      { id: "e1", source_node_id: "start", source_port: "out", target_node_id: "nav-1", target_port: "in" },
      { id: "e2", source_node_id: "nav-1", source_port: "out", target_node_id: "end-1", target_port: "in" },
    ],
    viewport: { x: 10, y: 20, zoom: 0.8 },
    migration_notes: [],
  };
}

describe("normalized graph tables", () => {
  test("tables exist with correct schema", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all()
      .map((r) => (r as { name: string }).name);

    expect(tables).toContain("workflow_nodes");
    expect(tables).toContain("workflow_edges");
    expect(tables).toContain("subflow_nodes");
    expect(tables).toContain("subflow_edges");

    const wfColumns = db
      .prepare("PRAGMA table_info(workflows)")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(wfColumns).toContain("graph_version");
    expect(wfColumns).toContain("viewport_json");
    expect(wfColumns).toContain("migration_notes_json");

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("assembleGraphFromTables returns null for non-existent workflow", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    expect(assembleGraphFromTables(db, "nonexistent")).toBeNull();
    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("assembleGraphFromTables produces identical output to legacy reader when populated", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    // Populate normalized tables (simulating what PR 2.2 backfill will do)
    const now = new Date().toISOString();
    const insertNode = db.prepare(
      `INSERT INTO workflow_nodes (id, workflow_id, node_type, config_json, position_x, position_y, label, ports_json, ordinal, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const insertEdge = db.prepare(
      `INSERT INTO workflow_edges (id, workflow_id, source_node_id, source_handle, target_node_id, target_handle, edge_kind, metadata_json, ordinal)
       VALUES (?, ?, ?, ?, ?, ?, 'flow', '{}', ?)`,
    );

    graph.nodes.forEach((node, i) => {
      insertNode.run(
        node.id,
        wf.id,
        node.node_type,
        JSON.stringify(node.config),
        node.position.x,
        node.position.y,
        node.label,
        JSON.stringify(node.ports),
        i,
        now,
        now,
      );
    });
    graph.edges.forEach((edge, i) => {
      insertEdge.run(
        edge.id,
        wf.id,
        edge.source_node_id,
        edge.source_port,
        edge.target_node_id,
        edge.target_port,
        i,
      );
    });

    // Update workflow meta columns
    db.prepare(
      "UPDATE workflows SET graph_version = ?, viewport_json = ?, migration_notes_json = ? WHERE id = ?",
    ).run(graph.version, JSON.stringify(graph.viewport), JSON.stringify(graph.migration_notes ?? []), wf.id);

    const fromTables = assembleGraphFromTables(db, wf.id);
    expect(fromTables).not.toBeNull();
    expect(fromTables!.version).toBe(graph.version);
    expect(fromTables!.nodes).toHaveLength(3);
    expect(fromTables!.edges).toHaveLength(2);
    expect(fromTables!.nodes[0].id).toBe("start");
    expect(fromTables!.nodes[1].config).toEqual(graph.nodes[1].config);
    expect(fromTables!.viewport).toEqual(graph.viewport);
    expect(fromTables!.edges[0].source_port).toBe("out");

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
