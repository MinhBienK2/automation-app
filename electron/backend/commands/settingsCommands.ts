import type {
  WorkflowBrowserConfig,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  SettingsValidationIssue,
  CloakBrowserDiagnostics,
  BrowserProfileCleanupResult,
  OperationsOverviewRequest,
  IdentityLabOverviewRequest,
  IdentityLabTarget,
} from "../../../src/types/workflow.js";
import { commandError } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { browserProfileKey } from "../runtime/runManager.js";
import { buildCloakBrowserDiagnostics, loadCloakBrowserDiagnosticsModule } from "../diagnostics/cloakBrowserDiagnostics.js";
import fs from "node:fs/promises";
import path from "node:path";

export function createSettingsCommands(deps: CommandDeps) {
  const {
    repository,
    settingsService,
    runManager,
    runner,
    identityRepository,
    operationsRepository,
    requireWorkflow,
    getSettings,
    saveSettings,
    rotateBrowserIdentity,
    activeRunConflict,
  } = deps;

  function lastRunAtForWorkflow(workflowId: string): string | null {
    const row = deps.context.database
      .prepare(
        `SELECT COALESCE(finished_at, started_at) AS last_run_at
         FROM runs
         WHERE workflow_id = ?
         ORDER BY started_at DESC
         LIMIT 1`,
      )
      .get(workflowId) as { last_run_at?: string | null } | undefined;
    return row?.last_run_at ?? null;
  }

  return {
    getWorkflowBrowserConfig(workflowId: string): WorkflowBrowserConfig {
      return settingsService.settingsBrowserToConfig(workflowId, getSettings(workflowId).browser_launch);
    },

    saveWorkflowBrowserConfig(
      workflowId: string,
      config: WorkflowBrowserConfig,
    ) {
      const settings = getSettings(workflowId);
      saveSettings(workflowId, {
        ...settings,
        browser_launch: {
          ...settings.browser_launch,
          ...settingsService.configToSettingsBrowserLaunch(config, {
            id: workflowId,
            name: settings.general.name,
          }),
          ...settingsService.browserIdentityPreferences(settings.browser_launch),
        },
      });
    },

    getWorkflowSettings(workflowId: string): WorkflowSettings {
      return getSettings(workflowId);
    },

    resetWorkflowBrowserIdentity(workflowId: string): WorkflowSettings {
      requireWorkflow(workflowId);
      return rotateBrowserIdentity(workflowId);
    },

    saveWorkflowSettings: saveSettings,

    saveWorkflowSettingsSection<Section extends WorkflowSettingsSectionId>(
      workflowId: string,
      section: Section,
      sectionValue: WorkflowSettings[Section],
    ): WorkflowSettings {
      return saveSettings(workflowId, {
        ...getSettings(workflowId),
        [section]: sectionValue,
      });
    },

    validateWorkflowSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
      return settingsService.validateSettings(settings);
    },

    async getCloakBrowserDiagnostics(): Promise<CloakBrowserDiagnostics> {
      return buildCloakBrowserDiagnostics({
        appPaths: deps.context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
    },

    async installCloakBrowserBinary(): Promise<CloakBrowserDiagnostics> {
      const cloakbrowser = await loadCloakBrowserDiagnosticsModule();
      await cloakbrowser.ensureBinary();
      return buildCloakBrowserDiagnostics({
        appPaths: deps.context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
    },

    async cleanupOrphanedBrowserProfiles(): Promise<BrowserProfileCleanupResult> {
      const diagnostics = await buildCloakBrowserDiagnostics({
        appPaths: deps.context.appPaths,
        workflows: repository.listWorkflows(),
        settingsForWorkflow: getSettings,
        lastRunAtForWorkflow,
        retainedProfileNames: runManager.retainedProfileNames(),
      });
      const result: BrowserProfileCleanupResult = {
        deleted_profiles: [],
        skipped_profiles: [],
        reclaimed_bytes: 0,
      };
      for (const profile of diagnostics.profiles) {
        if (profile.workflow_id || profile.active_session) {
          result.skipped_profiles.push(profile);
          continue;
        }
        await fs.rm(path.join(deps.context.appPaths.browserProfilesDir, profile.profile_dir), {
          recursive: true,
          force: true,
        });
        result.deleted_profiles.push(profile.profile_dir);
        result.reclaimed_bytes += profile.approximate_size_bytes;
      }
      result.deleted_profiles.sort((left, right) => left.localeCompare(right));
      return result;
    },

    getOperationsOverview(request: OperationsOverviewRequest) {
      return operationsRepository.getOverview(request, runManager.listRunStates());
    },



    getIdentityLabOverview(request: IdentityLabOverviewRequest = {}) {
      return identityRepository.getOverview(request);
    },

    getIdentityLabDetail(target: IdentityLabTarget) {
      return identityRepository.getDetail(target);
    },

    async closeIdentityRetainedSession(workflowId: string, profileName: string) {
      const settings = getSettings(workflowId);
      const currentProfile = browserProfileKey(settings);
      if (currentProfile !== profileName) {
        throw commandError("Identity profile does not match current workflow settings", "profileName");
      }
      const conflict = activeRunConflict(workflowId, settings);
      if (conflict) {
        throw commandError(conflict.message, conflict.field);
      }
      if (!runner.closeRetainedSession) {
        throw commandError("Retained session close is unavailable", "profileName");
      }
      await runner.closeRetainedSession(workflowId, profileName);
    },
  };
}
