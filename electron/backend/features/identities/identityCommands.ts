import type {
  IdentityLabOverviewRequest,
  IdentityLabTarget,
} from "../../../../src/types/workflow.js";
import { commandError } from "../../commandHelpers.js";
import type { IdentityCommandsDeps } from "../types.js";
import { browserProfileKey } from "../../shared/browserProfileKey.js";

export function createIdentityCommands(deps: IdentityCommandsDeps) {
  const {
    identityRepository,
    runner,
    getSettings,
    activeRunConflict,
  } = deps;

  return {
    async getIdentityLabOverview(request: IdentityLabOverviewRequest = {}) {
      return identityRepository.getOverview(request);
    },

    async getIdentityLabDetail(target: IdentityLabTarget) {
      return identityRepository.getDetail(target);
    },

    async closeIdentityRetainedSession(workflowId: string, profileName: string) {
      const settings = await getSettings(workflowId);
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
