/**
 * Desktop Target commands.
 *
 * A sibling of the Browser Profile commands rather than more of them, because
 * the validation is different in the one way that matters: a Browser Profile is
 * ours end to end, while a Desktop Target names something on the operator's
 * machine that we neither install nor own. The only thing worth refusing here
 * is a target that could not possibly launch — an empty executable — and the
 * rest is left to fail at launch, where the error can name the application.
 *
 * Spec: `docs/domain/desktop/desktop-target.md`.
 */

import type { CommandError } from "../../runtime/runManager.js";
import type { DesktopTargetRepository } from "./desktopTargetRepository.js";
import type {
  DesktopTarget,
  DesktopTargetInput,
} from "../../../../src/types/desktopTargets.js";
import type { Workflow, WorkflowSummary } from "../../../../src/types/workflow.js";

export type DesktopTargetCommandDeps = {
  desktopTargets: DesktopTargetRepository;
  requireProject: (projectId: string) => Promise<unknown>;
  requireWorkflow: (workflowId: string) => Promise<WorkflowSummary>;
  assignWorkflowDesktopTarget: (
    workflowId: string,
    targetId: string,
  ) => Promise<Workflow | null>;
  /**
   * Refuses to change a target while a run is driving it — the lock is at the
   * Desktop Target, and editing a launch spec mid-run would describe an
   * application the run is not actually using.
   */
  activeDesktopTargetConflict: (targetId: string) => CommandError | null;
};

export function createDesktopTargetCommands(deps: DesktopTargetCommandDeps) {
  const { desktopTargets } = deps;

  async function listDesktopTargets(projectId: string): Promise<DesktopTarget[]> {
    await deps.requireProject(projectId);
    return await desktopTargets.listDesktopTargets(projectId);
  }

  async function createDesktopTarget(
    projectId: string,
    input: DesktopTargetInput,
  ): Promise<DesktopTarget> {
    await deps.requireProject(projectId);
    const name = input.name?.trim() ?? "";
    if (!name) throw commandError("Desktop Target name is required", "name");

    const value = input.launch?.value?.trim() ?? "";
    if (!value) {
      throw commandError(
        "Name the application to launch — an app id like `calc`, or the full path to an executable.",
        "launch.value",
      );
    }

    return await desktopTargets.createDesktopTarget(projectId, {
      ...input,
      name,
      description: input.description?.trim() ?? "",
      launch: { ...input.launch, value },
    });
  }

  async function updateDesktopTarget(
    targetId: string,
    input: Partial<DesktopTargetInput>,
  ): Promise<DesktopTarget> {
    const conflict = deps.activeDesktopTargetConflict(targetId);
    if (conflict) throw conflict;

    if (input.name !== undefined && !input.name.trim()) {
      throw commandError("Desktop Target name is required", "name");
    }
    if (input.launch !== undefined && !input.launch.value?.trim()) {
      throw commandError("Name the application to launch", "launch.value");
    }

    const updated = await desktopTargets.updateDesktopTarget(targetId, input);
    if (!updated) throw commandError("Desktop Target not found", "desktop_target_id");
    return updated;
  }

  async function deleteDesktopTarget(targetId: string): Promise<void> {
    const conflict = deps.activeDesktopTargetConflict(targetId);
    if (conflict) throw conflict;
    await desktopTargets.deleteDesktopTarget(targetId);
  }

  /**
   * Refuses a web workflow outright rather than storing an id it would never
   * read. ADR-0001 fixes a workflow's surface at creation, so this is a bug in
   * the caller, not a choice the operator should be allowed to make.
   */
  async function setWorkflowDesktopTarget(
    workflowId: string,
    targetId: string,
  ): Promise<Workflow> {
    const workflow = await deps.requireWorkflow(workflowId);
    if (workflow.surface !== "desktop") {
      throw commandError(
        "Only a desktop workflow can drive a Desktop Target. A workflow's surface is fixed when it is created.",
        "workflowId",
      );
    }

    const target = await desktopTargets.getDesktopTarget(targetId);
    if (!target) throw commandError("Desktop Target not found", "desktop_target_id");
    if (!workflow.project_id || workflow.project_id !== target.project_id) {
      throw commandError(
        "Desktop Target must belong to the workflow project",
        "desktop_target_id",
      );
    }

    const updated = await deps.assignWorkflowDesktopTarget(workflow.id, target.id);
    if (!updated) throw commandError("Workflow not found", "workflowId");
    return updated;
  }

  return {
    listDesktopTargets,
    createDesktopTarget,
    updateDesktopTarget,
    deleteDesktopTarget,
    setWorkflowDesktopTarget,
  };
}

function commandError(message: string, field?: string): CommandError {
  return { message, field };
}
