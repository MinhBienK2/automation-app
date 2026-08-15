import { createContext, useContext } from "react";
import type { ExecutionSurfaceKind } from "../../../types/workflow";

/**
 * The Execution Surface of the workflow currently open in the graph editor.
 *
 * A context rather than a prop because of where it is read: the only consumer
 * is the action-type picker, six components deep inside the inspector, and
 * nothing between here and there has any other use for it. Threading it would
 * add a parameter to five components that would immediately pass it on
 * untouched.
 *
 * The default is `web` because every workflow that predates the Desktop Surface
 * is one, so a component rendered outside a provider — a test, a storybook —
 * behaves exactly as it did before the surface existed.
 */
const WorkflowSurfaceContext = createContext<ExecutionSurfaceKind>("web");

export const WorkflowSurfaceProvider = WorkflowSurfaceContext.Provider;

export function useWorkflowSurface(): ExecutionSurfaceKind {
  return useContext(WorkflowSurfaceContext);
}
