import type { DbAdapter } from "./dbAdapter.js";
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

  constructor(private readonly database: DbAdapter) {
    this.projectRepo = new ProjectRepository(this.database);
    this.subflowRepo = new SubflowRepository(this.database);
  }

  // --- Project & Browser Profile Delegations ---
  async createProject(name: string, description = "", now = new Date()): Promise<Project> {
    return await this.projectRepo.createProject(name, description, now);
  }
  async listProjects(): Promise<Project[]> {
    return await this.projectRepo.listProjects();
  }
  async getProject(projectId: string): Promise<Project | null> {
    return await this.projectRepo.getProject(projectId);
  }
  async updateProject(projectId: string, input: { name?: string; description?: string | null }, now = new Date()): Promise<Project | null> {
    return await this.projectRepo.updateProject(projectId, input, now);
  }
  async deleteProject(projectId: string): Promise<void> {
    await this.projectRepo.deleteProject(projectId);
  }
  async createBrowserProfile(projectId: string, input: BrowserProfileInput & { browser_launch: BrowserProfile["browser_launch"] }, now = new Date()): Promise<BrowserProfile> {
    return await this.projectRepo.createBrowserProfile(projectId, input, now);
  }
  async listBrowserProfiles(projectId: string): Promise<BrowserProfile[]> {
    return await this.projectRepo.listBrowserProfiles(projectId);
  }
  async getBrowserProfile(profileId: string): Promise<BrowserProfile | null> {
    return await this.projectRepo.getBrowserProfile(profileId);
  }
  async getDefaultBrowserProfile(projectId: string): Promise<BrowserProfile | null> {
    return await this.projectRepo.getDefaultBrowserProfile(projectId);
  }
  async updateBrowserProfile(profileId: string, input: Partial<BrowserProfileInput>, now = new Date()): Promise<BrowserProfile | null> {
    return await this.projectRepo.updateBrowserProfile(profileId, input, now);
  }
  async deleteBrowserProfile(profileId: string): Promise<void> {
    await this.projectRepo.deleteBrowserProfile(profileId);
  }
  async listWorkflowsUsingBrowserProfile(profileId: string): Promise<WorkflowSummary[]> {
    return await this.projectRepo.listWorkflowsUsingBrowserProfile(profileId);
  }

  // --- Subflow Delegations ---
  async createSubflow(projectId: string, name: string, description: string, graph: WorkflowGraph, now = new Date()): Promise<Subflow> {
    return await this.subflowRepo.createSubflow(projectId, name, description, graph, now);
  }
  async listSubflows(projectId: string): Promise<SubflowSummary[]> {
    return await this.subflowRepo.listSubflows(projectId);
  }
  async getSubflow(subflowId: string): Promise<Subflow | null> {
    return await this.subflowRepo.getSubflow(subflowId);
  }
  async getSubflowGraph(subflowId: string): Promise<WorkflowGraph | null> {
    return await this.subflowRepo.getSubflowGraph(subflowId);
  }
  async updateSubflow(subflowId: string, input: { name?: string; description?: string | null }, now = new Date()): Promise<Subflow | null> {
    return await this.subflowRepo.updateSubflow(subflowId, input, now);
  }
  async saveSubflowGraph(subflowId: string, graph: WorkflowGraph, options: { comment?: string | null; tag?: string | null } = {}, now = new Date()): Promise<void> {
    await this.subflowRepo.saveSubflowGraph(subflowId, graph, options, now);
  }
  async duplicateSubflow(subflowId: string, name: string, now = new Date()): Promise<Subflow | null> {
    return await this.subflowRepo.duplicateSubflow(subflowId, name, now);
  }
  async deleteSubflow(subflowId: string): Promise<void> {
    await this.subflowRepo.deleteSubflow(subflowId);
  }
  async getSubflowUsage(subflowId: string): Promise<SubflowUsage[]> {
    return await this.subflowRepo.getSubflowUsage(subflowId);
  }

  // --- Workflow Methods ---
  async createWorkflow(
    name: string,
    graph: WorkflowGraph,
    now = new Date(),
    ownership: { projectId?: string | null; browserProfileId?: string | null } = {},
  ): Promise<Workflow> {
    const timestamp = now.toISOString();
    const id = crypto.randomUUID();
    const profileId = ownership.browserProfileId ?? null;
    await this.database.execute(
      `INSERT INTO workflows (
        id,
        project_id,
        browser_profile_id,
        name,
        description,
        tags_json,
        settings_json,
        created_at,
        updated_at,
        owner_id
      ) VALUES ($1, $2, $3, $4, '', '[]', NULL, $5, $6, $7)`,
      [
        id,
        ownership.projectId ?? null,
        profileId,
        name,
        timestamp,
        timestamp,
        this.database.ownerId,
      ],
    );
    await writeGraphToNormalizedTables(this.database, graph, "workflow", id, timestamp);
    return {
      id,
      name,
      project_id: ownership.projectId ?? null,
      browser_profile_id: profileId,
      created_at: timestamp,
      updated_at: timestamp,
    };
  }

  async listWorkflows(): Promise<WorkflowSummary[]> {
    const rows = await this.database.query(
      `SELECT workflows.id,
              workflows.project_id,
              workflows.browser_profile_id,
              browser_profiles.name AS browser_profile_name,
              workflows.name,
              workflows.created_at,
              workflows.updated_at
       FROM workflows
       LEFT JOIN browser_profiles ON browser_profiles.id = workflows.browser_profile_id
       WHERE workflows.owner_id = $1
       ORDER BY workflows.updated_at DESC, workflows.name ASC`,
      [this.database.ownerId],
    );
    return rows.map((row) => rowToSummary(row as WorkflowRow));
  }

  async getWorkflow(id: string): Promise<WorkflowDetail | null> {
    const row = await this.getWorkflowRow(id);
    if (!row) return null;

    return {
      workflow: rowToWorkflow(row),
      steps: [],
    };
  }

  async getWorkflowSummary(id: string): Promise<WorkflowSummary | null> {
    const row = await this.getWorkflowRow(id);
    return row ? rowToSummary(row) : null;
  }

  async renameWorkflow(id: string, name: string, now = new Date()): Promise<void> {
    await this.database.execute(
      "UPDATE workflows SET name = $1, updated_at = $2 WHERE id = $3 AND owner_id = $4",
      [name, now.toISOString(), id, this.database.ownerId],
    );
  }

  async assignWorkflowProject(
    id: string,
    projectId: string,
    now = new Date(),
  ): Promise<void> {
    await this.database.execute(
      "UPDATE workflows SET project_id = $1, browser_profile_id = NULL, updated_at = $2 WHERE id = $3 AND owner_id = $4",
      [projectId, now.toISOString(), id, this.database.ownerId],
    );
  }

  async assignWorkflowBrowserProfile(
    id: string,
    profileId: string,
    now = new Date(),
  ): Promise<Workflow | null> {
    const workflowDetail = await this.getWorkflow(id);
    const workflow = workflowDetail?.workflow ?? null;
    if (!workflow) return null;
    await this.database.execute(
      "UPDATE workflows SET browser_profile_id = $1, updated_at = $2 WHERE id = $3 AND owner_id = $4",
      [profileId, now.toISOString(), id, this.database.ownerId],
    );
    const updatedDetail = await this.getWorkflow(id);
    return updatedDetail?.workflow ?? null;
  }

  async deleteWorkflow(id: string): Promise<void> {
    await this.database.execute(
      "DELETE FROM workflows WHERE id = $1 AND owner_id = $2",
      [id, this.database.ownerId],
    );
  }

  async getWorkflowGraph(id: string): Promise<WorkflowGraph | null> {
    const fromTables = await assembleGraphFromTables(this.database, id);
    if (!fromTables) return null;
    const result = processGraphOnLoad(fromTables);
    if (result.migrationsApplied > 0 && !result.migrationFailed) {
      await this.saveWorkflowGraph(id, result.graph, { skipRevision: true });
    }
    return result.graph;
  }

  async saveWorkflowGraph(
    id: string,
    graph: WorkflowGraph,
    options: { comment?: string | null; tag?: string | null; skipRevision?: boolean } = {},
    now = new Date(),
  ): Promise<void> {
    const timestamp = now.toISOString();
    await this.database.execute(
      "UPDATE workflows SET updated_at = $1 WHERE id = $2 AND owner_id = $3",
      [timestamp, id, this.database.ownerId],
    );
    await writeGraphToNormalizedTables(this.database, graph, "workflow", id, timestamp);
    if (!options.skipRevision) {
      await snapshotRevision(this.database, "workflow", id, graph, {
        createdAt: timestamp,
        comment: options.comment,
        tag: options.tag,
      });
    }
  }

  async getWorkflowSettings(id: string): Promise<WorkflowSettings | null> {
    const row = await this.getWorkflowRow(id);
    if (!row?.settings_json) return null;
    return parseJson<WorkflowSettings>(row.settings_json);
  }

  async saveWorkflowSettings(id: string, settings: WorkflowSettings, now = new Date()): Promise<void> {
    const timestamp = now.toISOString();
    await this.database.execute(
      `UPDATE workflows
       SET name = $1, description = $2, tags_json = $3, settings_json = $4, updated_at = $5
       WHERE id = $6 AND owner_id = $7`,
      [
        settings.general.name,
        settings.general.description,
        JSON.stringify(settings.general.tags),
        JSON.stringify(settings),
        timestamp,
        id,
        this.database.ownerId,
      ],
    );
  }

  private async getWorkflowRow(id: string): Promise<WorkflowRow | null> {
    return (
      (await this.database.queryOne(
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
         WHERE workflows.id = $1 AND workflows.owner_id = $2`,
        [id, this.database.ownerId],
      ) as WorkflowRow | null) ?? null
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
