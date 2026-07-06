import { useCallback } from "react";
import type {
  WorkflowSettingsStateAPI,
} from "../../../shared/types/workspaceContracts";
import type {
  WorkflowDetail,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  BrowserProfile,
  WorkflowSummary,
} from "../../../types/workflow";
import {
  setWorkflowBrowserProfile as setWorkflowBrowserProfileCommand,
  saveWorkflowSettingsSection,
  getWorkflowSettings,
  listBrowserProfiles,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import {
  cloneWorkflowSettings,
  settingsSaveStatuses,
  isWorkflowSettings,
  type WorkflowSettingsSaveStatus,
} from "../../../lib/appState";
import {
  withWorkflowSettingsDefaults,
  defaultWorkflowSettings,
} from "../lib/workflowSettings";

export interface WorkflowSettingsStateDeps {
  detail: WorkflowDetail | null;
  setDetail: React.Dispatch<React.SetStateAction<WorkflowDetail | null>>;
  workflows: WorkflowSummary[];
  setWorkflows: React.Dispatch<React.SetStateAction<WorkflowSummary[]>>;
  browserProfiles: BrowserProfile[];
  setBrowserProfiles: (profiles: BrowserProfile[]) => void;
  setSelectedProjectId: (id: string | null) => void;
  loadWorkflows: () => Promise<void>;
  setAppError: (error: string) => void;
  showToast: (message: string) => void;
  resolveWorkflowProfileId: (profileId: string | null | undefined, profiles: BrowserProfile[]) => string | null;

  workflowSettings: WorkflowSettings | null;
  setWorkflowSettings: (settings: WorkflowSettings | null) => void;
  workflowSettingsSavedSnapshot: WorkflowSettings | null;
  setWorkflowSettingsSavedSnapshot: (settings: WorkflowSettings | null) => void;
  workflowSettingsDialogOpen: boolean;
  setWorkflowSettingsDialogOpen: (open: boolean) => void;
  workflowSettingsActiveSection: WorkflowSettingsSectionId;
  setWorkflowSettingsActiveSection: (section: WorkflowSettingsSectionId) => void;
  workflowSettingsSaveStatuses: Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>;
  setWorkflowSettingsSaveStatuses: React.Dispatch<React.SetStateAction<Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>>>;
  workflowProfileDraftId: string | null;
  setWorkflowProfileDraftId: (id: string | null) => void;
  workflowProfileSavedId: string | null;
  setWorkflowProfileSavedId: (id: string | null) => void;
}

export function useWorkflowSettingsState(deps: WorkflowSettingsStateDeps): WorkflowSettingsStateAPI {
  const {
    detail: _detail,
    setDetail,
    workflows: _workflows,
    setWorkflows,
    browserProfiles,
    setBrowserProfiles,
    setSelectedProjectId,
    loadWorkflows,
    setAppError,
    showToast: _showToast,
    resolveWorkflowProfileId,

    workflowSettings,
    setWorkflowSettings,
    workflowSettingsSavedSnapshot,
    setWorkflowSettingsSavedSnapshot,
    workflowSettingsDialogOpen,
    setWorkflowSettingsDialogOpen,
    workflowSettingsActiveSection,
    setWorkflowSettingsActiveSection,
    workflowSettingsSaveStatuses,
    setWorkflowSettingsSaveStatuses,
    workflowProfileDraftId,
    setWorkflowProfileDraftId,
    workflowProfileSavedId,
    setWorkflowProfileSavedId,
  } = deps;

  const updateLoadedWorkflowName = useCallback((name: string) => {
    setDetail((current) =>
      current
        ? {
            ...current,
            workflow: {
              ...current.workflow,
              name,
            },
          }
        : current,
    );
    setWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowSettings?.workflow_id
          ? { ...workflow, name }
          : workflow,
      ),
    );
  }, [workflowSettings, setDetail, setWorkflows]);

  const changeWorkflowSettings = useCallback((nextSettings: WorkflowSettings) => {
    setWorkflowSettings(nextSettings);
    setWorkflowSettingsSaveStatuses((current) => ({
      ...current,
      [workflowSettingsActiveSection]: "unsaved",
    }));
  }, [workflowSettingsActiveSection, setWorkflowSettings, setWorkflowSettingsSaveStatuses]);

  const persistWorkflowSettingsSection = useCallback(async (
    section: WorkflowSettingsSectionId,
    settings: WorkflowSettings,
    { force = false } = {},
  ) => {
    if (!force && workflowSettingsSaveStatuses[section] === "saved") return true;
    setAppError("");
    setWorkflowSettingsSaveStatuses((current) => ({
      ...current,
      [section]: "saving",
    }));

    try {
      let nextSettings = settings;
      if (section === "browser_launch") {
        if (!workflowProfileDraftId) {
          throw { message: "Select a browser profile before saving.", field: "browser_launch" };
        }
        const updatedWorkflow = await setWorkflowBrowserProfileCommand(
          settings.workflow_id,
          workflowProfileDraftId,
        );
        setWorkflowProfileSavedId(updatedWorkflow.browser_profile_id ?? workflowProfileDraftId);
        setDetail((current) =>
          current && current.workflow.id === updatedWorkflow.id
            ? { ...current, workflow: { ...current.workflow, ...updatedWorkflow } }
            : current,
        );
        const refreshed = await getWorkflowSettings(settings.workflow_id);
        nextSettings = isWorkflowSettings(refreshed) ? refreshed : settings;
      } else {
        const saved = await saveWorkflowSettingsSection(
          settings.workflow_id,
          section,
          settings[section],
        );
        nextSettings = isWorkflowSettings(saved) ? saved : settings;
      }
      setWorkflowSettings(nextSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
      if (section === "general") {
        updateLoadedWorkflowName(nextSettings.general.name);
      }
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [section]: "saved",
      }));
      void loadWorkflows();
      return true;
    } catch (error) {
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [section]: "failed",
      }));
      setAppError(commandMessage(error));
      return false;
    }
  }, [
    workflowSettingsSaveStatuses,
    workflowProfileDraftId,
    setWorkflowProfileSavedId,
    setDetail,
    loadWorkflows,
    setAppError,
    setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot,
    updateLoadedWorkflowName,
    setWorkflowSettingsSaveStatuses,
  ]);

  const openWorkflowSettings = useCallback(async (
    workflow: WorkflowSummary,
    section: WorkflowSettingsSectionId = "general",
  ) => {
    setAppError("");
    setWorkflowSettingsActiveSection(section);
    setWorkflowSettings(null);
    setWorkflowSettingsSavedSnapshot(null);
    setWorkflowSettingsDialogOpen(true);

    if (workflow.project_id) {
      setSelectedProjectId(workflow.project_id);
    }

    const profilesPromise = workflow.project_id
      ? Promise.resolve(listBrowserProfiles(workflow.project_id)).catch(() => null)
      : Promise.resolve(null);

    const settingsPromise = Promise.resolve(getWorkflowSettings(workflow.id)).catch(() => null);

    const [profilesResult, settingsResult] = await Promise.all([
      profilesPromise,
      settingsPromise,
    ]);

    const workflowBrowserProfiles = profilesResult ?? browserProfiles;
    if (profilesResult) {
      setBrowserProfiles(profilesResult);
    }

    const profileId = resolveWorkflowProfileId(
      workflow.browser_profile_id,
      workflowBrowserProfiles,
    );
    setWorkflowProfileDraftId(profileId);
    setWorkflowProfileSavedId(profileId);

    if (settingsResult) {
      const normalizedSettings = withWorkflowSettingsDefaults(settingsResult, {
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      });
      const selectedProfile = workflowBrowserProfiles.find((profile) => profile.id === profileId);
      const nextSettings = selectedProfile
        ? { ...normalizedSettings, browser_launch: selectedProfile.browser_launch }
        : normalizedSettings;
      setWorkflowSettings(nextSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
    } else {
      const fallbackSettings = defaultWorkflowSettings({
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      });
      const selectedProfile = workflowBrowserProfiles.find((profile) => profile.id === profileId);
      const nextSettings = selectedProfile
        ? { ...fallbackSettings, browser_launch: selectedProfile.browser_launch }
        : fallbackSettings;
      setWorkflowSettings(nextSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
    }
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
  }, [
    browserProfiles,
    setSelectedProjectId,
    setBrowserProfiles,
    resolveWorkflowProfileId,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsSaveStatuses,
    setWorkflowSettingsDialogOpen,
    setAppError,
  ]);

  const closeWorkflowSettingsDialog = useCallback(() => {
    setWorkflowSettingsDialogOpen(false);
    setAppError("");
  }, [setWorkflowSettingsDialogOpen, setAppError]);

  const discardWorkflowSettingsChanges = useCallback(() => {
    if (workflowSettingsSavedSnapshot) {
      setWorkflowSettings(cloneWorkflowSettings(workflowSettingsSavedSnapshot));
    }
    setWorkflowProfileDraftId(workflowProfileSavedId);
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
    closeWorkflowSettingsDialog();
  }, [workflowSettingsSavedSnapshot, workflowProfileSavedId, setWorkflowSettings, setWorkflowProfileDraftId, setWorkflowSettingsSaveStatuses, closeWorkflowSettingsDialog]);

  const persistDirtyWorkflowSettings = useCallback(async () => {
    if (!workflowSettings) return true;
    for (const section of Object.keys(workflowSettingsSaveStatuses) as WorkflowSettingsSectionId[]) {
      if (workflowSettingsSaveStatuses[section] === "unsaved") {
        const saved = await persistWorkflowSettingsSection(section, workflowSettings, { force: true });
        if (!saved) return false;
      }
    }
    return true;
  }, [workflowSettings, workflowSettingsSaveStatuses, persistWorkflowSettingsSection]);

  const saveWorkflowSettingsAndClose = useCallback(async () => {
    const saved = await persistDirtyWorkflowSettings();
    if (!saved) return;
    closeWorkflowSettingsDialog();
  }, [persistDirtyWorkflowSettings, closeWorkflowSettingsDialog]);

  return {
    workflowSettings,
    workflowSettingsSavedSnapshot,
    workflowSettingsDialogOpen,
    workflowSettingsActiveSection,
    workflowSettingsSaveStatuses,
    workflowProfileDraftId,
    workflowProfileSavedId,
    setWorkflowSettings,
    setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsDialogOpen,
    setWorkflowSettingsActiveSection,
    setWorkflowSettingsSaveStatuses,
    setWorkflowProfileDraftId,
    setWorkflowProfileSavedId,
    persistWorkflowSettingsSection: (sectionId, settings) => persistWorkflowSettingsSection(sectionId, settings),
    changeWorkflowSettings,
    openWorkflowSettings,
    discardWorkflowSettingsChanges,
    closeWorkflowSettingsDialog,
    saveWorkflowSettingsAndClose,
  };
}
