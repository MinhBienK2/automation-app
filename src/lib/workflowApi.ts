import { invoke } from "@tauri-apps/api/core";
import type {
  ActionConfig,
  BatchRunRequest,
  BatchRunSummary,
  CompiledWorkflowGraph,
  ElementSnapshot,
  GeneratedFixture,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordedEvent,
  RunState,
  SelectorCandidate,
  WorkflowGraph,
  Workflow,
  WorkflowDetail,
  WorkflowExport,
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

export function getWorkflowGraph(workflowId: string) {
  return invoke<WorkflowGraph>("get_workflow_graph", { workflowId });
}

export function saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
  return invoke("save_workflow_graph", { workflowId, graph });
}

export function validateWorkflowGraph(graph: WorkflowGraph) {
  return invoke<GraphValidationIssue[]>("validate_workflow_graph", { graph });
}

export function compileWorkflowGraph(graph: WorkflowGraph) {
  return invoke<CompiledWorkflowGraph>("compile_workflow_graph", { graph });
}

export function runWorkflow(workflowId: string) {
  return invoke<RunState>("run_workflow", { workflowId });
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

export function suggestSelectors(snapshot: ElementSnapshot) {
  return invoke<SelectorCandidate[]>("suggest_selectors", { snapshot });
}

export function normalizeRecordedEvents(events: RecordedEvent[]) {
  return invoke<ActionConfig[]>("normalize_recorded_events", { events });
}

export function dryRunValidateConfig(config: ActionConfig) {
  return invoke("dry_run_validate_config", { config });
}

export function generateFixture(path: string, bodyHtml: string) {
  return invoke<GeneratedFixture>("generate_fixture", { path, bodyHtml });
}
