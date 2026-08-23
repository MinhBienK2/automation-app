import { commandError } from "../commandHelpers.js";
import type {
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import type { WorkflowRepository } from "./workflows/workflowRepository.js";
import type { RunManager } from "../runtime/runManager.js";
import type { WorkflowSettingsService } from "./workflows/workflowSettingsService.js";

export type SettingsLifecycleHelpers = {
  requireWorkflow: (workflowId: string) => Promise<WorkflowSummary>;
  getSettings: (workflowId: string) => Promise<WorkflowSettings>;
  saveSettings: (
    workflowId: string,
    settings: WorkflowSettings,
  ) => Promise<WorkflowSettings>;
};

export function createSettingsLifecycleHelpers(deps: {
  repository: WorkflowRepository;
  runManager: RunManager;
  settingsService: WorkflowSettingsService;
}): SettingsLifecycleHelpers {
  const { repository, runManager, settingsService } = deps;

  async function requireWorkflow(workflowId: string): Promise<WorkflowSummary> {
    const workflow = await repository.getWorkflowSummary(workflowId);
    if (!workflow) {
      throw commandError("Workflow not found", "workflowId");
    }
    return workflow;
  }

  async function getSettings(workflowId: string): Promise<WorkflowSettings> {
    const persisted = await repository.getWorkflowSettings(workflowId);
    const workflow = await requireWorkflow(workflowId);
    const normalized = persisted
      ? settingsService.normalizeWorkflowSettings(persisted, workflow)
      : settingsService.defaultWorkflowSettings(workflow);

    let browserProfile = workflow.browser_profile_id
      ? await repository.getBrowserProfile(workflow.browser_profile_id)
      : null;

    if (!browserProfile || browserProfile.project_id !== workflow.project_id) {
      if (workflow.project_id) {
        const defaultProfile = await repository.getDefaultBrowserProfile(workflow.project_id);
        if (defaultProfile) {
          browserProfile = defaultProfile;
        }
      }
    }

    if (!browserProfile) return normalized;

    return settingsService.normalizeWorkflowSettings(
      {
        ...normalized,
        browser_launch: browserProfile.browser_launch,
      },
      workflow,
    );
  }

  async function assertCanChangeBrowserIdentityProfile(
    workflowId: string,
    nextSettings: WorkflowSettings,
  ) {
    const currentSettings = await getSettings(workflowId);
    runManager.assertCanChangeBrowserIdentityProfile(workflowId, currentSettings, nextSettings);
  }

  async function saveSelectedProfileBrowserLaunch(
    workflow: WorkflowSummary,
    browserLaunch: WorkflowSettings["browser_launch"],
  ) {
    const profileId = workflow.browser_profile_id;
    if (!profileId) return browserLaunch;
    const browserProfile = await repository.getBrowserProfile(profileId);
    if (!browserProfile || browserProfile.project_id !== workflow.project_id) {
      return browserLaunch;
    }
    const updated = await repository.updateBrowserProfile(browserProfile.id, {
      browser_launch: browserLaunch,
    });
    return updated?.browser_launch ?? browserLaunch;
  }

  async function saveSettings(workflowId: string, settings: WorkflowSettings) {
    const workflow = await requireWorkflow(workflowId);
    const activeSettings = settingsService.normalizeWorkflowSettings(settings, workflow);
    await assertCanChangeBrowserIdentityProfile(workflowId, activeSettings);
    const issues = settingsService.validateSettings(activeSettings);
    const firstError = issues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(
        firstError.message,
        firstError.field
          ? `${firstError.section}.${firstError.field}`
          : firstError.section,
      );
    }

    const browserLaunch = await saveSelectedProfileBrowserLaunch(
      workflow,
      activeSettings.browser_launch,
    );
    const timestamp = new Date().toISOString();
    const normalized: WorkflowSettings = {
      ...activeSettings,
      workflow_id: workflowId,
      version: 2,
      general: {
        ...activeSettings.general,
        name: activeSettings.general.name.trim(),
        updated_at: timestamp,
        created_at: activeSettings.general.created_at ?? workflow.created_at,
      },
      browser_launch: browserLaunch,
      migration_notes: activeSettings.migration_notes,
      updated_at: timestamp,
      created_at: activeSettings.created_at ?? workflow.created_at,
    };
    await repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  return {
    requireWorkflow,
    getSettings,
    saveSettings,
  };
}
