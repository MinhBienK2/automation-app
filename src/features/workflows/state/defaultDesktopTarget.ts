import type { DesktopTarget } from "../../../types/workflow";

/**
 * The Desktop Target a new workflow in `projectId` should start out pointed at.
 *
 * Filters by project before choosing, rather than trusting the loaded list to
 * already be scoped. It usually is — but it is refreshed asynchronously on
 * every project switch, and during that window it holds the previous project's
 * applications. Returning nothing is the right answer there: an empty picker
 * asks the operator a question, a wrong default answers it for them.
 */
export function defaultDesktopTargetFor(
  targets: readonly DesktopTarget[],
  projectId: string | null,
): DesktopTarget | null {
  if (!projectId) return null;
  const owned = targets.filter((target) => target.project_id === projectId);
  return owned.find((target) => target.is_default) ?? owned[0] ?? null;
}
