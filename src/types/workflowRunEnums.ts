/**
 * Run status/mode enums and the small value shapes that action configs assign.
 */

export type RunStatus = "idle" | "running" | "success" | "failed" | "stopped";
export type RunMode = "none" | "run_workflow" | "test_step";
export type VariableValueType = "text" | "json" | "number" | "boolean";
export type VariableAssignment = {
  name: string;
  value_type: VariableValueType;
  value: string;
};
export type ObjectFieldAssignment = {
  key: string;
  value_type: VariableValueType;
  value: string;
};

export type ScrollMode = "page" | "into_view" | "until_element_visible";
export type ScrollDirection = "up" | "down" | "left" | "right";
export type ScrollStyle = "human_like" | "smooth_single";
export type DragTargetPosition =
  | { mode: "center" }
  | { mode: "percent"; x_percent: number; y_percent: number }
  | { mode: "offset"; x_px: number; y_px: number };
