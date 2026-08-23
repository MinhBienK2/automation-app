import { randomUUID } from "node:crypto";
import { commandError, createDraftGraph } from "../commandHelpers.js";
import type { CommandContext } from "./types.js";
import type {
  BrowserProfile,
  Project,
  Workflow,
  WorkflowCreateOptions,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type { WorkflowRepository } from "./workflows/workflowRepository.js";
import type { RunManager } from "../runtime/runManager.js";
import type { WorkflowSettingsService } from "./workflows/workflowSettingsService.js";

export type ProjectBootstrapHelpers = {
  ensureProjectModelReady: () => Promise<void>;
  ensureDefaultProject: () => Promise<Project>;
  ensureDefaultBrowserProfile: (project: Project) => Promise<BrowserProfile>;
  defaultProfileBrowserLaunch: (name: string) => Promise<WorkflowSettings["browser_launch"]>;
  requireProject: (projectId: string) => Promise<Project>;
  requireBrowserProfile: (browserProfileId: string) => Promise<BrowserProfile>;
  createWorkflow: (name: string, options?: WorkflowCreateOptions) => Promise<Workflow>;
};

export function createProjectBootstrapHelpers(
  context: CommandContext,
  deps: {
    repository: WorkflowRepository;
    runManager: RunManager;
    settingsService: WorkflowSettingsService;
  },
): ProjectBootstrapHelpers {
  const { repository, runManager, settingsService } = deps;

  async function ensureProjectModelReady() {
    if (!context.database.ownerId) return;
    await runManager.recoverInterruptedRuns();
    const list = await repository.listProjects();
    const project = list[0];
    if (project) {
      await ensureDefaultBrowserProfile(project);
      const workflows = await repository.listWorkflows();
      for (const workflow of workflows) {
        const projectId = workflow.project_id ?? project.id;
        if (!workflow.project_id) {
          await repository.assignWorkflowProject(workflow.id, projectId);
        }
        const current = await repository.getWorkflowSummary(workflow.id);
        if (!current?.browser_profile_id) {
          const ownerProject = (await repository.getProject(projectId)) ?? project;
          const browserProfile = await ensureDefaultBrowserProfile(ownerProject);
          await repository.assignWorkflowBrowserProfile(workflow.id, browserProfile.id);
        }
      }
    }
  }

  async function ensureDefaultProject(): Promise<Project> {
    const list = await repository.listProjects();
    const existing = list[0];
    if (existing) return existing;
    throw commandError("No projects available. Please create a project first.", "projectId");
  }

  async function ensureDefaultBrowserProfile(project: Project): Promise<BrowserProfile> {
    const existing = await repository.getDefaultBrowserProfile(project.id);
    if (existing) return existing;
    const launchConfig = await defaultProfileBrowserLaunch("Project browser profile");
    return await repository.createBrowserProfile(project.id, {
      name: "Project browser profile",
      description: "Project-owned browser profile with persistent storage and fingerprint identity",
      browser_launch: launchConfig,
      is_default: true,
    });
  }

  async function defaultProfileBrowserLaunch(name: string): Promise<WorkflowSettings["browser_launch"]> {
    const now = new Date().toISOString();
    const defaultSettings = await settingsService.defaultWorkflowSettings(
      {
        id: `profile-${randomUUID()}`,
        name,
        created_at: now,
        updated_at: now,
      },
      { randomizeIdentity: true },
    );
    return defaultSettings.browser_launch;
  }

  async function requireProject(projectId: string): Promise<Project> {
    const project = await repository.getProject(projectId);
    if (!project) throw commandError("Project not found", "projectId");
    return project;
  }

  async function requireBrowserProfile(browserProfileId: string): Promise<BrowserProfile> {
    const browserProfile = await repository.getBrowserProfile(browserProfileId);
    if (!browserProfile) {
      throw commandError("Browser profile not found", "browserProfileId");
    }
    return browserProfile;
  }

  async function createWorkflow(name: string, options: WorkflowCreateOptions = {}): Promise<Workflow> {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const project = options.project_id
      ? await requireProject(options.project_id)
      : await ensureDefaultProject();
    const browserProfile = options.browser_profile_id
      ? await requireBrowserProfile(options.browser_profile_id)
      : await ensureDefaultBrowserProfile(project);
    const workflow = await repository.createWorkflow(
      normalized,
      createDraftGraph(),
      new Date(),
      { projectId: project.id, browserProfileId: browserProfile.id },
    );
    const defaultSettings = settingsService.defaultWorkflowSettings(workflow, {
      randomizeIdentity: true,
    });
    await repository.saveWorkflowSettings(workflow.id, {
      ...defaultSettings,
      browser_launch: browserProfile.browser_launch,
    });
    return {
      ...workflow,
      project_id: project.id,
      browser_profile_id: browserProfile.id,
    };
  }

  return {
    ensureProjectModelReady,
    ensureDefaultProject,
    ensureDefaultBrowserProfile,
    defaultProfileBrowserLaunch,
    requireProject,
    requireBrowserProfile,
    createWorkflow,
  };
}
