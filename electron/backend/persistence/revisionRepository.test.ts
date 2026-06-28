// @vitest-environment node

import { describe, expect, test } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createAppPaths, initializeDatabase } from "./database.js";
import { WorkflowRepository } from "./workflowRepository.js";
import {
  snapshotRevision,
  listRevisions,
  getRevision,
  tagRevision,
  untagRevision,
  pruneRevisions,
} from "./revisionRepository.js";
import type { WorkflowGraph } from "../../../src/types/workflow.js";

function tempRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "revision-test-"));
}

function sampleGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: null, ports: [] },
      { id: "end", node_type: "end_success", label: "End", position: { x: 100, y: 0 }, config: null, ports: [] },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

describe("revisionRepository — snapshot on save", () => {
  test("5 saves produce 5 revisions with monotonic numbers", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    // createWorkflow already wrote 1 revision via createWorkflow → no, createWorkflow
    // does NOT call saveWorkflowGraph. So 0 revisions initially.
    // Let's save 5 times.
    for (let i = 0; i < 5; i++) {
      const modified = {
        ...graph,
        nodes: [...graph.nodes, {
          id: `node-${i}`,
          node_type: "end_failure" as const,
          label: `Node ${i}`,
          position: { x: i * 100, y: 0 },
          config: null,
          ports: [],
        }],
      };
      repo.saveWorkflowGraph(wf.id, modified);
    }

    const revisions = listRevisions(db, "workflow", wf.id);
    expect(revisions).toHaveLength(5);
    expect(revisions[0].revision_number).toBe(5);
    expect(revisions[4].revision_number).toBe(1);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("subflow saves also produce revisions", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const sf = repo.createSubflow(project.id, "Sub", "", graph);

    repo.saveSubflowGraph(sf.id, graph);
    repo.saveSubflowGraph(sf.id, graph);

    const revisions = listRevisions(db, "subflow", sf.id);
    expect(revisions).toHaveLength(2);
    expect(revisions[0].revision_number).toBe(2);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("getRevision returns full snapshot", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    repo.saveWorkflowGraph(wf.id, graph);

    const revisions = listRevisions(db, "workflow", wf.id);
    const rev = getRevision(db, "workflow", revisions[0].id);
    expect(rev).not.toBeNull();
    expect(rev!.graph_snapshot_json).toBe(JSON.stringify(graph));
    expect(rev!.size_bytes).toBeGreaterThan(0);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("tagRevision and untagRevision", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const project = repo.listProjects()[0] ?? repo.createProject("Main");
    const wf = repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    repo.saveWorkflowGraph(wf.id, graph);

    const revisions = listRevisions(db, "workflow", wf.id);
    tagRevision(db, "workflow", revisions[0].id, "release");
    const tagged = getRevision(db, "workflow", revisions[0].id);
    expect(tagged!.tag).toBe("release");

    untagRevision(db, "workflow", revisions[0].id);
    const untagged = getRevision(db, "workflow", revisions[0].id);
    expect(untagged!.tag).toBeNull();

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe("revisionRepository — pruning", () => {
  test("prunes untagged revisions beyond 50, keeps tagged ones", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const graph = sampleGraph();

    const wfId = "wf-prune-test";
    db.prepare(
      "INSERT INTO workflows (id, name, description, tags_json, settings_json, created_at, updated_at) VALUES (?, 'Test', '', '[]', NULL, '1', '1')",
    ).run(wfId);

    // Create 65 revisions: 55 untagged + 10 tagged
    for (let i = 0; i < 65; i++) {
      snapshotRevision(db, "workflow", wfId, graph, {
        createdAt: new Date(2024, 0, i + 1).toISOString(),
      });
    }

    // Tag revisions 56-65 (the 10 most recent)
    const allRevs = listRevisions(db, "workflow", wfId, { limit: 100 });
    for (let i = 0; i < 10; i++) {
      tagRevision(db, "workflow", allRevs[i].id, "milestone");
    }

    expect(listRevisions(db, "workflow", wfId, { limit: 100 })).toHaveLength(65);

    const result = pruneRevisions(db, "workflow");
    expect(result.pruned).toBe(5); // 55 untagged - 50 max = 5 pruned

    const remaining = listRevisions(db, "workflow", wfId, { limit: 100 });
    expect(remaining).toHaveLength(60); // 50 untagged + 10 tagged

    const tagged = remaining.filter((r) => r.tag === "milestone");
    expect(tagged).toHaveLength(10);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });

  test("prunes correctly when untagged > 50", () => {
    const root = tempRoot();
    const db = initializeDatabase(createAppPaths(root));
    const graph = sampleGraph();

    const wfId = "wf-prune-test2";
    db.prepare(
      "INSERT INTO workflows (id, name, description, tags_json, settings_json, created_at, updated_at) VALUES (?, 'Test', '', '[]', NULL, '1', '1')",
    ).run(wfId);

    // Create 55 untagged + 5 tagged = 60 total
    for (let i = 0; i < 60; i++) {
      snapshotRevision(db, "workflow", wfId, graph, {
        createdAt: new Date(2024, 0, i + 1).toISOString(),
      });
    }

    // Tag the 5 most recent (revision numbers 56-60)
    const allRevs = listRevisions(db, "workflow", wfId, { limit: 100 });
    for (let i = 0; i < 5; i++) {
      tagRevision(db, "workflow", allRevs[i].id, "release");
    }

    const result = pruneRevisions(db, "workflow");
    expect(result.pruned).toBe(5); // 55 untagged - 50 max = 5 pruned

    const remaining = listRevisions(db, "workflow", wfId, { limit: 100 });
    expect(remaining).toHaveLength(55); // 50 untagged + 5 tagged

    const tagged = remaining.filter((r) => r.tag === "release");
    expect(tagged).toHaveLength(5);

    db.close();
    fs.rmSync(root, { recursive: true, force: true });
  });
});
