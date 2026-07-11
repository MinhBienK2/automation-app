// @vitest-environment node

import { describe, expect, test } from "vitest";
import { WorkflowRepository } from "./workflowRepository.js";
import {
  snapshotRevision,
  listRevisions,
  getRevision,
  tagRevision,
  untagRevision,
  pruneRevisions,
  restoreRevision,
  deleteRevision,
} from "./revisionRepository.js";
import type { WorkflowGraph } from "../../../../src/types/workflow.js";
import { TestDbAdapter } from "../../db/testDbAdapter.js";

function sampleGraph(): WorkflowGraph {
  return {
    version: 3,
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
  test("5 saves produce 5 revisions with monotonic numbers", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

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
      await repo.saveWorkflowGraph(wf.id, modified);
    }

    const revisions = await listRevisions(db, "workflow", wf.id);
    expect(revisions).toHaveLength(5);
    expect(revisions[0].revision_number).toBe(5);
    expect(revisions[4].revision_number).toBe(1);
  });

  test("subflow saves also produce revisions", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const sf = await repo.createSubflow(project.id, "Sub", "", graph);

    await repo.saveSubflowGraph(sf.id, graph);
    await repo.saveSubflowGraph(sf.id, graph);

    const revisions = await listRevisions(db, "subflow", sf.id);
    expect(revisions).toHaveLength(2);
    expect(revisions[0].revision_number).toBe(2);
  });

  test("getRevision returns full snapshot", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    await repo.saveWorkflowGraph(wf.id, graph);

    const revisions = await listRevisions(db, "workflow", wf.id);
    const rev = await getRevision(db, "workflow", revisions[0].id);
    expect(rev).not.toBeNull();
    expect(rev!.graph_snapshot_json).toBe(JSON.stringify(graph));
    expect(rev!.size_bytes).toBeGreaterThan(0);
  });

  test("tagRevision and untagRevision", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    await repo.saveWorkflowGraph(wf.id, graph);

    const revisions = await listRevisions(db, "workflow", wf.id);
    await tagRevision(db, "workflow", revisions[0].id, "release");
    const tagged = await getRevision(db, "workflow", revisions[0].id);
    expect(tagged!.tag).toBe("release");

    await untagRevision(db, "workflow", revisions[0].id);
    const untagged = await getRevision(db, "workflow", revisions[0].id);
    expect(untagged!.tag).toBeNull();
  });

  test("deleteRevision deletes revision by id", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    await repo.saveWorkflowGraph(wf.id, graph);

    let revisions = await listRevisions(db, "workflow", wf.id);
    expect(revisions).toHaveLength(1);
    const revId = revisions[0].id;

    await deleteRevision(db, "workflow", revId);

    revisions = await listRevisions(db, "workflow", wf.id);
    expect(revisions).toHaveLength(0);

    const rev = await getRevision(db, "workflow", revId);
    expect(rev).toBeNull();
  });
});

describe("revisionRepository — pruning", () => {
  test("prunes untagged revisions beyond 50, keeps tagged ones", async () => {
    const db = await TestDbAdapter.create();
    const graph = sampleGraph();

    const wfId = "wf-prune-test";
    await db.query(
      `INSERT INTO workflows (id, name, description, tags_json, settings_json, created_at, updated_at, owner_id)
       VALUES ($1, 'Test', '', '[]', NULL, '1', '1', $2)`,
      [wfId, db.ownerId]
    );

    for (let i = 0; i < 65; i++) {
      await snapshotRevision(db, "workflow", wfId, graph, {
        createdAt: new Date(2024, 0, i + 1).toISOString(),
      });
    }

    const allRevs = await listRevisions(db, "workflow", wfId, { limit: 100 });
    for (let i = 0; i < 10; i++) {
      await tagRevision(db, "workflow", allRevs[i].id, "milestone");
    }

    const listFull = await listRevisions(db, "workflow", wfId, { limit: 100 });
    expect(listFull).toHaveLength(65);

    const result = await pruneRevisions(db, "workflow");
    expect(result.pruned).toBe(5);

    const remaining = await listRevisions(db, "workflow", wfId, { limit: 100 });
    expect(remaining).toHaveLength(60);

    const tagged = remaining.filter((r) => r.tag === "milestone");
    expect(tagged).toHaveLength(10);
  });

  test("prunes correctly when untagged > 50", async () => {
    const db = await TestDbAdapter.create();
    const graph = sampleGraph();

    const wfId = "wf-prune-test2";
    await db.query(
      `INSERT INTO workflows (id, name, description, tags_json, settings_json, created_at, updated_at, owner_id)
       VALUES ($1, 'Test', '', '[]', NULL, '1', '1', $2)`,
      [wfId, db.ownerId]
    );

    for (let i = 0; i < 60; i++) {
      await snapshotRevision(db, "workflow", wfId, graph, {
        createdAt: new Date(2024, 0, i + 1).toISOString(),
      });
    }

    const allRevs = await listRevisions(db, "workflow", wfId, { limit: 100 });
    for (let i = 0; i < 5; i++) {
      await tagRevision(db, "workflow", allRevs[i].id, "release");
    }

    const result = await pruneRevisions(db, "workflow");
    expect(result.pruned).toBe(5);

    const remaining = await listRevisions(db, "workflow", wfId, { limit: 100 });
    expect(remaining).toHaveLength(55);

    const tagged = remaining.filter((r) => r.tag === "release");
    expect(tagged).toHaveLength(5);
  });
});

describe("revisionRepository — restore", () => {
  test("restoreRevision restores the graph and captures pre-restore state", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const graphV1 = sampleGraph();
    const wf = await repo.createWorkflow("Test", graphV1, new Date(), { projectId: project.id });

    await repo.saveWorkflowGraph(wf.id, graphV1);

    const graphV2 = {
      ...graphV1,
      nodes: [...graphV1.nodes, {
        id: "extra",
        node_type: "end_failure" as const,
        label: "Extra",
        position: { x: 200, y: 0 },
        config: null,
        ports: [],
      }],
    };
    await repo.saveWorkflowGraph(wf.id, graphV2);

    const revisions = await listRevisions(db, "workflow", wf.id);
    const v1Revision = revisions.find((r) => r.revision_number === 1)!;

    const result = await restoreRevision(db, "workflow", wf.id, v1Revision.id, { comment: "Rollback to v1" });
    expect(result.restoredRevisionNumber).toBe(1);
    expect(result.capturedRevisionNumber).toBe(3);

    const restored = await repo.getWorkflowGraph(wf.id);
    expect(restored!.nodes).toHaveLength(2);

    const allRevisions = await listRevisions(db, "workflow", wf.id);
    expect(allRevisions).toHaveLength(3);
    const capturedRev = allRevisions.find((r) => r.revision_number === 3)!;
    expect(capturedRev.comment).toBe("Rollback to v1");

    const undoResult = await restoreRevision(db, "workflow", wf.id, capturedRev.id, { comment: "Undo rollback" });
    expect(undoResult.restoredRevisionNumber).toBe(3);

    const afterUndo = await repo.getWorkflowGraph(wf.id);
    expect(afterUndo!.nodes).toHaveLength(3);
    expect(afterUndo!.nodes[2].id).toBe("extra");
  });

  test("restoreRevision throws for non-existent revision", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });
    await repo.saveWorkflowGraph(wf.id, graph);

    await expect(
      restoreRevision(db, "workflow", wf.id, "nonexistent-revision-id")
    ).rejects.toThrow("Revision nonexistent-revision-id not found");
  });

  test("saveWorkflowGraph and saveSubflowGraph store comment and tag", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    await repo.saveWorkflowGraph(wf.id, graph, { comment: "First backup", tag: "backup-1" });

    const revisions = await listRevisions(db, "workflow", wf.id);
    expect(revisions).toHaveLength(1);
    expect(revisions[0].comment).toBe("First backup");
    expect(revisions[0].tag).toBe("backup-1");
  });

  test("listRevisions onlyBackups option filters correctly", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const wf = await repo.createWorkflow("Test", graph, new Date(), { projectId: project.id });

    await repo.saveWorkflowGraph(wf.id, graph);
    await repo.saveWorkflowGraph(wf.id, graph, { comment: "Manual backup" });
    await repo.saveWorkflowGraph(wf.id, graph);

    const allRevs = await listRevisions(db, "workflow", wf.id);
    expect(allRevs).toHaveLength(3);

    const backupsOnly = await listRevisions(db, "workflow", wf.id, { onlyBackups: true });
    expect(backupsOnly).toHaveLength(1);
    expect(backupsOnly[0].comment).toBe("Manual backup");
  });

  test("workflow backup bundles exclusive subflows and restore duplicates & remaps them", async () => {
    const db = await TestDbAdapter.create();
    const repo = new WorkflowRepository(db);
    const graph = sampleGraph();

    const projects = await repo.listProjects();
    const project = projects[0] ?? (await repo.createProject("Main"));
    const sf = await repo.createSubflow(project.id, "Subflow Component", "", graph);
    
    const wfGraph: WorkflowGraph = {
      ...graph,
      nodes: [
        { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 }, config: null, ports: [] },
        {
          id: "call-sf",
          node_type: "call_subflow",
          label: "Call",
          position: { x: 100, y: 0 },
          config: { subflow_id: sf.id, input_mapping: [], output_prefix: null },
          ports: [],
        },
      ],
    };
    
    const wf = await repo.createWorkflow("Main Workflow", wfGraph, new Date(), { projectId: project.id });
    await repo.saveWorkflowGraph(wf.id, wfGraph);
    await repo.saveWorkflowGraph(wf.id, wfGraph, { comment: "Pre-change backup" });
    await repo.deleteSubflow(sf.id);
    
    const revisions = await listRevisions(db, "workflow", wf.id, { onlyBackups: true });
    expect(revisions).toHaveLength(1);
    
    const restoreResult = await restoreRevision(db, "workflow", wf.id, revisions[0].id, { comment: "Restore backup" });
    expect(restoreResult.restoredRevisionNumber).toBe(2);
    
    const subflows = await repo.listSubflows(project.id);
    expect(subflows).toHaveLength(1);
    expect(subflows[0].name).toBe("Subflow Component (Backup)");
    
    const restoredWfGraph = await repo.getWorkflowGraph(wf.id);
    const callNode = restoredWfGraph!.nodes.find((n) => n.id === "call-sf")!;
    expect((callNode.config as any).subflow_id).toBe(subflows[0].id);
  });
});
