import type {
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type { WorkflowRepository } from "./workflows/workflowRepository.js";
import type { RunManager } from "../runtime/runManager.js";
import {
  createHighEntropyBrowserIdentityId,
  deriveFingerprintSeedFromIdentityId,
} from "./workflows/workflowSettingsService.js";

export type IdentityRotationHelpers = {
  duplicateBrowserProfileLaunch: (
    browserLaunch: WorkflowSettings["browser_launch"],
    exceptWorkflowId?: string,
  ) => Promise<WorkflowSettings["browser_launch"]>;
  rotateBrowserIdentity: (workflowId: string) => Promise<WorkflowSettings>;
};

export function createIdentityRotationHelpers(deps: {
  repository: WorkflowRepository;
  runManager: RunManager;
  getSettings: (workflowId: string) => Promise<WorkflowSettings>;
  saveSettings: (workflowId: string, settings: WorkflowSettings) => Promise<WorkflowSettings>;
}): IdentityRotationHelpers {
  const { repository, runManager, getSettings, saveSettings } = deps;

  function assertCanResetBrowserIdentity(workflowId: string, settings: WorkflowSettings) {
    runManager.assertCanResetBrowserIdentity(workflowId, settings);
  }

  async function usedFingerprintSeeds(exceptWorkflowId?: string) {
    const list = await repository.listWorkflows();
    const filtered = list.filter((workflow) => workflow.id !== exceptWorkflowId);
    const seeds = new Set<string>();
    for (const w of filtered) {
      const s = await getSettings(w.id);
      if (s.browser_launch.fingerprint_seed) {
        seeds.add(s.browser_launch.fingerprint_seed);
      }
    }
    return seeds;
  }

  async function usedBrowserProfileFingerprintSeeds(exceptWorkflowId?: string) {
    const seeds = await usedFingerprintSeeds(exceptWorkflowId);
    const projects = await repository.listProjects();
    for (const project of projects) {
      const profiles = await repository.listBrowserProfiles(project.id);
      for (const profile of profiles) {
        const seed = profile.browser_launch.fingerprint_seed;
        if (seed) seeds.add(seed);
      }
    }
    return seeds;
  }

  async function duplicateBrowserProfileLaunch(
    browserLaunch: WorkflowSettings["browser_launch"],
    exceptWorkflowId?: string,
  ): Promise<WorkflowSettings["browser_launch"]> {
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds(exceptWorkflowId);
    return {
      ...browserLaunch,
      identity_id: identityId,
      profile_dir: identityId,
      profile_name:
        browserLaunch.session_mode === "persistent_profile" ? identityId : null,
      fingerprint_seed: deriveFingerprintSeedFromIdentityId(
        identityId,
        seeds,
      ),
    };
  }

  async function rotateBrowserIdentity(workflowId: string): Promise<WorkflowSettings> {
    const settings = await getSettings(workflowId);
    assertCanResetBrowserIdentity(workflowId, settings);
    const identityId = createHighEntropyBrowserIdentityId();
    const seeds = await usedBrowserProfileFingerprintSeeds(workflowId);
    const fingerprintSeed = deriveFingerprintSeedFromIdentityId(
      identityId,
      seeds,
    );
    const timestamp = new Date().toISOString();
    return await saveSettings(workflowId, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        run_from_selected_enabled: false,
      },
      browser_launch: {
        ...settings.browser_launch,
        identity_id: identityId,
        profile_dir: identityId,
        profile_name:
          settings.browser_launch.session_mode === "persistent_profile"
            ? identityId
            : null,
        fingerprint_seed: fingerprintSeed,
      },
      migration_notes: [
        ...settings.migration_notes,
        {
          path: "browser_launch.identity_id",
          action: "rotated",
          message: `Browser identity rotated from ${settings.browser_launch.identity_id} to ${identityId} at ${timestamp}`,
        },
      ],
    });
  }

  return {
    duplicateBrowserProfileLaunch,
    rotateBrowserIdentity,
  };
}
