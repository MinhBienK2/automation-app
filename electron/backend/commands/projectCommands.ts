import type {
  Project,
  BrowserProfile,
  BrowserProfileInput,
  Workflow,
} from "../../../src/types/workflow.js";
import { commandError, createDraftGraph } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { randomUUID } from "node:crypto";
import nodeFs from "node:fs";
import path from "node:path";
import { sanitizePathSegment } from "../evidence/artifacts.js";
import { getBrowserProfileKey } from "../projects/projectCommandCascades.js";
import { WorkflowRepository } from "../repositories/workflowRepository.js";

export function createProjectCommands(deps: CommandDeps) {
  const {
    repository,
    projectCascades,
    requireProject,
    requireBrowserProfile,
    requireWorkflow,
  } = deps;

  async function listProjects(): Promise<Project[]> {
    return await repository.listProjects();
  }

  async function createProject(input: { name: string; description?: string | null }): Promise<Project> {
    const name = input.name.trim();
    if (!name) throw commandError("Project name is required", "name");
    
    return await deps.context.database.transaction(async (tx) => {
      const txRepository = new WorkflowRepository(tx);
      const project = await txRepository.createProject(name, input.description?.trim() ?? "");
      
      const nowStr = new Date().toISOString();
      const defaultLaunch = deps.settingsService.defaultWorkflowSettings(
        {
          id: `profile-${randomUUID()}`,
          name: "Default Profile",
          created_at: nowStr,
          updated_at: nowStr,
        },
        { randomizeIdentity: true },
      ).browser_launch;

      const defaultProfile = await txRepository.createBrowserProfile(project.id, {
        name: "Default Profile",
        description: "System created default profile",
        is_default: true,
        browser_launch: defaultLaunch,
      });

      const createdWorkflow = await txRepository.createWorkflow("Main", createDraftGraph(), new Date(), {
        projectId: project.id,
        browserProfileId: defaultProfile.id,
      });

      const defaultSettings = deps.settingsService.defaultWorkflowSettings(createdWorkflow, { randomizeIdentity: true });
      await txRepository.saveWorkflowSettings(createdWorkflow.id, defaultSettings);

      return project;
    });
  }

  async function updateProject(
    projectId: string,
    input: { name?: string; description?: string | null },
  ): Promise<Project> {
    await requireProject(projectId);
    if (input.name != null && !input.name.trim()) {
      throw commandError("Project name is required", "name");
    }
    const updated = await repository.updateProject(projectId, {
      name: input.name?.trim(),
      description:
        input.description === undefined ? undefined : input.description?.trim() ?? "",
    });
    if (!updated) throw commandError("Project not found", "projectId");
    return updated;
  }

  async function duplicateProject(projectId: string): Promise<Project> {
    return await projectCascades.duplicateProjectCascade(projectId);
  }

  async function deleteProject(projectId: string): Promise<void> {
    await projectCascades.deleteProjectCascade(projectId);
  }

  async function listBrowserProfiles(projectId: string): Promise<BrowserProfile[]> {
    await requireProject(projectId);
    return await repository.listBrowserProfiles(projectId);
  }

  async function createBrowserProfile(
    projectId: string,
    input: BrowserProfileInput,
  ): Promise<BrowserProfile> {
    await requireProject(projectId);
    const name = input.name.trim();
    if (!name) throw commandError("Profile name is required", "name");
    
    const now = new Date().toISOString();
    const defaultLaunch = deps.settingsService.defaultWorkflowSettings(
      {
        id: `profile-${randomUUID()}`,
        name,
        created_at: now,
        updated_at: now,
      },
      { randomizeIdentity: true },
    ).browser_launch;

    return await repository.createBrowserProfile(projectId, {
      name,
      description: input.description?.trim() ?? "",
      is_default: Boolean(input.is_default),
      browser_launch: input.browser_launch ?? defaultLaunch,
      environment: input.environment,
    });
  }

  async function updateBrowserProfile(
    profileId: string,
    input: Partial<BrowserProfileInput>,
  ): Promise<BrowserProfile> {
    const current = await requireBrowserProfile(profileId);
    if (input.name != null && !input.name.trim()) {
      throw commandError("Profile name is required", "name");
    }
    const updated = await repository.updateBrowserProfile(profileId, {
      ...input,
      name: input.name?.trim(),
      description: input.description?.trim(),
    });
    if (!updated) throw commandError("Browser profile not found", "profileId");
    
    const defaultProfile = await repository.getDefaultBrowserProfile(current.project_id);
    if (!defaultProfile) {
      const restored = await repository.updateBrowserProfile(updated.id, { is_default: true });
      if (restored) return restored;
    }
    return updated;
  }

  async function deleteBrowserProfile(profileId: string): Promise<void> {
    const profile = await requireBrowserProfile(profileId);
    const usage = await repository.listWorkflowsUsingBrowserProfile(profile.id);
    if (usage.length > 0) {
      throw commandError("Browser profile is used by workflows", "profileId");
    }
    const profileDir = getBrowserProfileKey(profile);
    await repository.deleteBrowserProfile(profile.id);
    if (profileDir) {
      nodeFs.rmSync(path.join(deps.context.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)), {
        recursive: true,
        force: true,
      });
    }
  }

  async function setWorkflowBrowserProfile(
    workflowId: string,
    profileId: string,
  ): Promise<Workflow> {
    const workflow = await requireWorkflow(workflowId);
    const profile = await requireBrowserProfile(profileId);
    if (!workflow.project_id || workflow.project_id !== profile.project_id) {
      throw commandError("Browser profile must belong to the workflow project", "profileId");
    }
    const updated = await repository.assignWorkflowBrowserProfile(workflow.id, profile.id);
    if (!updated) throw commandError("Workflow not found", "workflowId");
    return updated;
  }

  async function resetBrowserProfileIdentity(profileId: string): Promise<BrowserProfile> {
    return await projectCascades.rotateBrowserProfileIdentity(profileId);
  }

  return {
    listProjects,
    createProject,
    updateProject,
    duplicateProject,
    deleteProject,
    listBrowserProfiles,
    createBrowserProfile,
    updateBrowserProfile,
    deleteBrowserProfile,
    setWorkflowBrowserProfile,
    resetBrowserProfileIdentity,
  };
}
