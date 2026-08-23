import { createContext, useContext } from "react";
import type { ExecutionSurfaceKind } from "../../../types/workflow";

/**
 * What the workflow currently open in the graph editor runs against.
 *
 * A context rather than a prop because of where it is read: the consumers are
 * the action-type picker and the element picker, both six components deep
 * inside the inspector, and nothing between here and there has any other use
 * for it. Threading it would add a parameter to five components that would
 * immediately pass it on untouched.
 *
 * It carries the Desktop Target as well as the surface because the element
 * picker has to launch the application to read a tree out of it, and the
 * application is a property of the workflow, not of the step.
 *
 * The default is `web` with no target, because every workflow that predates the
 * Desktop Surface is one: a component rendered outside a provider — a test, a
 * storybook — behaves exactly as it did before the surface existed.
 */
export type WorkflowSurfaceValue = {
  kind: ExecutionSurfaceKind;
  desktopTargetId: string | null;
  desktopTargetName?: string;
};

const WEB_ONLY: WorkflowSurfaceValue = { kind: "web", desktopTargetId: null };

const WorkflowSurfaceContext = createContext<WorkflowSurfaceValue>(WEB_ONLY);

export const WorkflowSurfaceProvider = WorkflowSurfaceContext.Provider;

export function useWorkflowSurface(): WorkflowSurfaceValue {
  return useContext(WorkflowSurfaceContext);
}

/** For the many readers that only care which family of actions is legal. */
export function useWorkflowSurfaceKind(): ExecutionSurfaceKind {
  return useContext(WorkflowSurfaceContext).kind;
}
