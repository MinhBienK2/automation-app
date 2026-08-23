import type { WorkflowSettings } from "../../../src/types/workflow.js";

/**
 * Identity of a persistent browser profile derived from workflow settings.
 * `null` means the settings do not pin a persistent profile (ephemeral run).
 */
export function browserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return settings.browser_launch.profile_dir?.trim() || settings.browser_launch.profile_name?.trim() || null;
}
