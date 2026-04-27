import type { WorkflowStep, WorkflowSummary } from "../../types/workflow";

export const workflow: WorkflowSummary = {
  id: "workflow-1",
  name: "Login flow",
  step_count: 0,
  created_at: "1",
  updated_at: "1",
};

export const newWorkflow: WorkflowSummary = {
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
  action_type: "sleep",
  config: { type: "sleep", config: { seconds: 1 } },
  created_at: "1",
  updated_at: "1",
};

export const clickStep: WorkflowStep = {
  id: "step-2",
  name: "Click login button",
  workflow_id: "workflow-1",
  order_index: 1,
  action_type: "click",
  config: { type: "click", config: { xpath: '//*[@id="submit"]' } },
  created_at: "1",
  updated_at: "1",
};
