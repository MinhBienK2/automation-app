import type { WorkflowStep, WorkflowSummary } from "../../types/workflow";

export const workflow: WorkflowSummary = {
  surface: "web" as const,
  id: "workflow-1",
  name: "Login flow",
  step_count: 0,
  created_at: "1",
  updated_at: "1",
};

export const newWorkflow: WorkflowSummary = {
  surface: "web" as const,
  id: "workflow-2",
  name: "Checkout flow",
  step_count: 0,
  created_at: "2",
  updated_at: "2",
};

export const sleepStep: WorkflowStep = {
  id: "step-1",
  name: "Wait for page",
  workflow_id: "workflow-1",
  order_index: 0,
  action_type: "wait",
  config: { type: "wait", config: { condition: "duration", duration_ms: 1000 } },
  created_at: "1",
  updated_at: "1",
};
