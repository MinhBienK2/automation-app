import { invoke } from "@tauri-apps/api/core";
import type {
  ActionConfig,
  ActionType,
  BatchRunRequest,
  BatchRunSummary,
  OrchestrationSchedule,
  RunState,
  Workflow,
  WorkflowDetail,
  WorkflowExport,
  WorkflowStep,
  WorkflowSummary,
} from "../types/workflow";

export function listWorkflows() {
  return invoke<WorkflowSummary[]>("list_workflows");
}

export function getWorkflow(id: string) {
  return invoke<WorkflowDetail | null>("get_workflow", { id });
}

export function createWorkflow(name: string) {
  return invoke<Workflow>("create_workflow", { name });
}

export function renameWorkflow(id: string, name: string) {
  return invoke("rename_workflow", { id, name });
}

export function deleteWorkflow(id: string) {
  return invoke("delete_workflow", { id });
}

export function addStep(workflowId: string, actionType: ActionType) {
  return invoke<WorkflowStep>("add_step", { workflowId, actionType });
}

export function updateStep(stepId: string, name: string, config: ActionConfig) {
  return invoke("update_step", { stepId, name, config });
}

export function deleteStep(stepId: string) {
  return invoke("delete_step", { stepId });
}

export function reorderSteps(workflowId: string, orderedStepIds: string[]) {
  return invoke("reorder_steps", { workflowId, orderedStepIds });
}

export function runWorkflow(workflowId: string) {
  return invoke<RunState>("run_workflow", { workflowId });
}

export function testStep(workflowId: string, stepId: string) {
  return invoke<RunState>("test_step", { workflowId, stepId });
}

export function stopRun() {
  return invoke<RunState>("stop_run");
}

export function getRunState() {
  return invoke<RunState>("get_run_state");
}

export function validateSchedule(schedule: OrchestrationSchedule) {
  return invoke<OrchestrationSchedule>("validate_schedule", { schedule });
}

export function exportWorkflow(workflowId: string) {
  return invoke<WorkflowExport>("export_workflow", { workflowId });
}

export function importWorkflow(exported: WorkflowExport) {
  return invoke<WorkflowDetail>("import_workflow", { exported });
}

export function runBatchWorkflow(workflowId: string, request: BatchRunRequest) {
  return invoke<BatchRunSummary>("run_batch_workflow", { workflowId, request });
}
