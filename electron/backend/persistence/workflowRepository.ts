import type { DatabaseSync } from "node:sqlite";
import type {
  Project,
  BrowserProfile,
  BrowserProfileInput,
  Subflow,
  SubflowSummary,
  SubflowUsage,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import { processGraphOnLoad } from "./graphLoader.js";
import { writeGraphToNormalizedTables } from "./backfillGraphTables.js";
import { assembleGraphFromTables } from "./normalizedGraphRepository.js";
import { snapshotRevision } from "./revisionRepository.js";
import { ProjectRepository } from "./projectRepository.js";
import { SubflowRepository } from "./subflowRepository.js";

type WorkflowRow = {
  id: string;
  project_id: string | null;
  browser_profile_id: string | null;
  browser_profile_name?: string | null;
  name: string;
  description: string;
  tags_json: string;
  settings_json: string | null;
  created_at: string;
  updated_at: string;
};

export class WorkflowRepository {
  private readonly projectRepo: ProjectRepository;
  private readonly subflowRepo: SubflowRepository;

  constructor(private readonly database: DatabaseSync) {
    this.projectRepo = new ProjectRepository(this.database);
    this.subflowRepo = new SubflowRepository(this.database);
  }

  // --- Project & Browser Profile Delegations ---
  createProject(name: string, description = "", now = new Date()): Project {
    return this.projectRepo.createProject(name, description, now);
  }
  listProjects(): Project[] {
    return this.projectRepo.listProjects();
  }
  getProject(projectId: string): Project | null {
    return this.projectRepo.getProject(projectId);
  }
  updateProject(projectId: string, input: { name?: string; description?: string | null }, now = new Date()): Project | null {
    return this.projectRepo.updateProject(projectId, input, now);
  }
  deleteProject(projectId: string) {
    this.projectRepo.deleteProject(projectId);
  }
  createBrowserProfile(projectId: string, input: BrowserProfileInput & { browser_launch: BrowserProfile["browser_launch"] }, now = new Date()): BrowserProfile {
    return this.projectRepo.createBrowserProfile(projectId, input, now);
  }
  listBrowserProfiles(projectId: string): BrowserProfile[] {
    return this.projectRepo.listBrowserProfiles(projectId);
  }
  getBrowserProfile(profileId: string): BrowserProfile | null {
    return this.projectRepo.getBrowserProfile(profileId);
  }
  getDefaultBrowserProfile(projectId: string): BrowserProfile | null {
    return this.projectRepo.getDefaultBrowserProfile(projectId);
  }
  updateBrowserProfile(profileId: string, input: Partial<BrowserProfileInput>, now = new Date()): BrowserProfile | null {
    return this.projectRepo.updateBrowserProfile(profileId, input, now);
  }
  deleteBrowserProfile(profileId: string) {
    this.projectRepo.deleteBrowserProfile(profileId);
  }
  listWorkflowsUsingBrowserProfile(profileId: string): WorkflowSummary[] {
    return this.projectRepo.listWorkflowsUsingBrowserProfile(profileId);
  }

  // --- Subflow Delegations ---
  createSubflow(projectId: string, name: string, description: string, graph: WorkflowGraph, now = new Date()): Subflow {
    return this.subflowRepo.createSubflow(projectId, name, description, graph, now);
  }
  listSubflows(projectId: string): SubflowSummary[] {
    return this.subflowRepo.listSubflows(projectId);
  }
  getSubflow(subflowId: string): Subflow | null {
    return this.subflowRepo.getSubflow(subflowId);
  }
  getSubflowGraph(subflowId: string): WorkflowGraph | null {
    return this.subflowRepo.getSubflowGraph(subflowId);
  }
  updateSubflow(subflowId: string, input: { name?: string; description?: string | null }, now = new Date()): Subflow | null {
    return this.subflowRepo.updateSubflow(subflowId, input, now);
  }
  saveSubflowGraph(subflowId: string, graph: WorkflowGraph, options: { comment?: string | null; tag?: string | null } = {}, now = new Date()) {
    this.subflowRepo.saveSubflowGraph(subflowId, graph, options, now);
  }
  duplicateSubflow(subflowId: string, name: string, now = new Date()): Subflow | null {
    return this.subflowRepo.duplicateSubflow(subflowId, name, now);
  }
  deleteSubflow(subflowId: string) {
    this.subflowRepo.deleteSubflow(subflowId);
  }
  getSubflowUsage(subflowId: string): SubflowUsage[] {
    return this.subflowRepo.getSubflowUsage(subflowId);
  }

  // --- Workflow Methods ---
  createWorkflow(
    name: string,
    graph: WorkflowGraph,
    now = new Date(),
    ownership: { projectId?: string | null; browserProfileId?: string | null } = {},
  ): Workflow {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    const profileId = ownership.browserProfileId ?? null;
    this.database
      .prepare(
        `INSERT INTO workflows (
          id,
          project_id,
          browser_profile_id,
          name,
          description,
          tags_json,
          settings_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, '', '[]', NULL, ?, ?)`,
      )
      .run(
        id,
        ownership.projectId ?? null,
        profileId,
        name,
        timestamp,
        timestamp,
      );
    writeGraphToNormalizedTables(this.database, graph, "workflow", id, timestamp);
    return {
      id,
      name,
      project_id: ownership.projectId ?? null,
      browser_profile_id: profileId,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  listWorkflows(): WorkflowSummary[] {
    return this.database
      .prepare(
        `SELECT workflows.id,
                workflows.project_id,
                workflows.browser_profile_id,
                browser_profiles.name AS browser_profile_name,
                workflows.name,
                workflows.created_at,
                workflows.updated_at
         FROM workflows
         LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
         ORDER BY workflows.updated_at DESC, workflows.name ASC`,
      )
      .all()
      .map((row) => rowToSummary(row as WorkflowRow));
  }

  getWorkflow(id: string): WorkflowDetail | null {
    const row = this.getWorkflowRow(id);
    if (!row) return null;

    return {
      workflow: rowToWorkflow(row),
      steps: [],
    };
  }

  getWorkflowSummary(id: string): WorkflowSummary | null {
    const row = this.getWorkflowRow(id);
    return row ? rowToSummary(row) : null;
  }

  renameWorkflow(id: string, name: string, now = new Date()) {
    this.database
      .prepare("UPDATE workflows SET name = ?, updated_at = ? WHERE id = ?")
      .run(name, now.toISOString(), id);
  }

  assignWorkflowProject(
    id: string,
    projectId: string,
    now = new Date(),
  ) {
    this.database
      .prepare(
        "UPDATE workflows SET project_id = ?, browser_profile_id = NULL, updated_at = ? WHERE id = ?",
      )
      .run(projectId, now.toISOString(), id);
  }

  assignWorkflowBrowserProfile(
    id: string,
    profileId: string,
    now = new Date(),
  ): Workflow | null {
    const workflow = this.getWorkflow(id)?.workflow ?? null;
    if (!workflow) return null;
    this.database
      .prepare("UPDATE workflows SET browser_profile_id = ?, updated_at = ? WHERE id = ?")
      .run(profileId, now.toISOString(), id);
    return this.getWorkflow(id)?.workflow ?? null;
  }

  deleteWorkflow(id: string) {
    this.database.prepare("DELETE FROM workflows WHERE id = ?").run(id);
  }

  getWorkflowGraph(id: string): WorkflowGraph | null {
    const fromTables = assembleGraphFromTables(this.database, id);
    if (!fromTables) return null;
    const result = processGraphOnLoad(fromTables);
    if (result.migrationsApplied > 0 && !result.migrationFailed) {
      this.saveWorkflowGraph(id, result.graph);
    }
    return result.graph;
  }

  saveWorkflowGraph(
    id: string,
    graph: WorkflowGraph,
    options: { comment?: string | null; tag?: string | null } = {},
    now = new Date(),
  ) {
    const timestamp = now.toISOString();
    this.database
      .prepare("UPDATE workflows SET updated_at = ? WHERE id = ?")
      .run(timestamp, id);
    writeGraphToNormalizedTables(this.database, graph, "workflow", id, timestamp);
    snapshotRevision(this.database, "workflow", id, graph, {
      createdAt: timestamp,
      comment: options.comment,
      tag: options.tag,
    });
  }

  getWorkflowSettings(id: string): WorkflowSettings | null {
    const row = this.getWorkflowRow(id);
    if (!row?.settings_json) return null;
    return parseJson<WorkflowSettings>(row.settings_json);
  }

  saveWorkflowSettings(id: string, settings: WorkflowSettings, now = new Date()) {
    const timestamp = now.toISOString();
    this.database
      .prepare(
        `UPDATE workflows
         SET name = ?, description = ?, tags_json = ?, settings_json = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        settings.general.name,
        settings.general.description,
        JSON.stringify(settings.general.tags),
        JSON.stringify(settings),
        timestamp,
        id,
      );
  }

  private getWorkflowRow(id: string): WorkflowRow | null {
    return (
      (this.database
        .prepare(
          `SELECT workflows.id,
                  workflows.project_id,
                  workflows.browser_profile_id,
                  browser_profiles.name AS browser_profile_name,
                  workflows.name,
                  workflows.description,
                  workflows.tags_json,
                  workflows.settings_json,
                  workflows.created_at,
                  workflows.updated_at
           FROM workflows
           LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
           WHERE workflows.id = ?`,
        )
        .get(id) as WorkflowRow | undefined) ?? null
    );
  }
}

function rowToWorkflow(row: WorkflowRow): Workflow {
  return {
    id: row.id,
    name: row.name,
    project_id: row.project_id,
    browser_profile_id: row.browser_profile_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function rowToSummary(row: WorkflowRow): WorkflowSummary {
  return {
    ...rowToWorkflow(row),
    step_count: 0,
    browser_profile_name: row.browser_profile_name ?? null,
  };
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}
