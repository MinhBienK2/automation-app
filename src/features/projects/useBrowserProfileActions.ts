import type {
  BrowserProfile,
  BrowserProfileInput,
} from "../../types/workflow";
import {
  createBrowserProfile as createBrowserProfileCommand,
  deleteBrowserProfile as deleteBrowserProfileCommand,
  listBrowserProfiles,
  resetBrowserProfileIdentity as resetBrowserProfileIdentityCommand,
  updateBrowserProfile as updateBrowserProfileCommand,
} from "../../lib/workflowApi";
import { commandMessage } from "../../lib/workflowUi";

type UseBrowserProfileActionsOptions = {
  setAppError: (message: string) => void;
  setBrowserProfiles: (profiles: BrowserProfile[]) => void;
  showToast: (message: string) => void;
};

export function useBrowserProfileActions({
  setAppError,
  setBrowserProfiles,
  showToast,
}: UseBrowserProfileActionsOptions) {
  async function createBrowserProfile(
    projectId: string,
    input: BrowserProfileInput,
  ) {
    setAppError("");
    try {
      const created = await createBrowserProfileCommand(projectId, input);
      setBrowserProfiles(await listBrowserProfiles(created.project_id));
      showToast("Browser profile created.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function updateBrowserProfile(
    profileId: string,
    input: Partial<BrowserProfileInput>,
  ) {
    setAppError("");
    try {
      const updated = await updateBrowserProfileCommand(profileId, input);
      setBrowserProfiles(await listBrowserProfiles(updated.project_id));
      showToast("Browser profile updated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteBrowserProfile(profileId: string, projectId?: string | null) {
    setAppError("");
    try {
      await deleteBrowserProfileCommand(profileId);
      if (projectId) {
        setBrowserProfiles(await listBrowserProfiles(projectId));
      }
      showToast("Browser profile deleted.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function resetBrowserProfileIdentity(profileId: string) {
    setAppError("");
    try {
      const updated = await resetBrowserProfileIdentityCommand(profileId);
      setBrowserProfiles(await listBrowserProfiles(updated.project_id));
      showToast("Browser profile identity regenerated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  return {
    createBrowserProfile,
    updateBrowserProfile,
    deleteBrowserProfile,
    resetBrowserProfileIdentity,
  };
}
