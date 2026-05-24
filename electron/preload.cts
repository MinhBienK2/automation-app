import type { WorkflowElectronBridge } from "../src/types/electron.js";
import type { workflowIpcChannels as mainWorkflowIpcChannels } from "./ipc.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { message: string; field?: string | null } };

type WorkflowIpcMethod = keyof typeof mainWorkflowIpcChannels;

function workflowChannel<TMethod extends WorkflowIpcMethod>(
  methodName: TMethod,
): (typeof mainWorkflowIpcChannels)[TMethod] {
  return `workflow:${methodName}` as (typeof mainWorkflowIpcChannels)[TMethod];
}

async function invokeWorkflow<T>(
  methodName: WorkflowIpcMethod,
  ...args: unknown[]
): Promise<T> {
  const result = (await ipcRenderer.invoke(workflowChannel(methodName), ...args)) as IpcResult<T>;
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

const workflowApi: WorkflowElectronBridge = {
  listWorkflows: () => invokeWorkflow("listWorkflows"),
  getWorkflow: (id) => invokeWorkflow("getWorkflow", id),
  getWorkflowBrowserConfig: (workflowId) =>
    invokeWorkflow("getWorkflowBrowserConfig", workflowId),
  saveWorkflowBrowserConfig: (workflowId, config) =>
    invokeWorkflow(
      "saveWorkflowBrowserConfig",
      workflowId,
      config,
    ),
  getWorkflowSettings: (workflowId) =>
    invokeWorkflow("getWorkflowSettings", workflowId),
  resetWorkflowBrowserIdentity: (workflowId) =>
    invokeWorkflow("resetWorkflowBrowserIdentity", workflowId),
  saveWorkflowSettings: (workflowId, settings) =>
    invokeWorkflow("saveWorkflowSettings", workflowId, settings),
  saveWorkflowSettingsSection: (workflowId, section, sectionValue) =>
    invokeWorkflow(
      "saveWorkflowSettingsSection",
      workflowId,
      section,
      sectionValue,
    ),
  validateWorkflowSettings: (settings) =>
    invokeWorkflow("validateWorkflowSettings", settings),
  getCloakBrowserDiagnostics: () =>
    invokeWorkflow("getCloakBrowserDiagnostics"),
  installCloakBrowserBinary: () =>
    invokeWorkflow("installCloakBrowserBinary"),
  cleanupOrphanedBrowserProfiles: () =>
    invokeWorkflow("cleanupOrphanedBrowserProfiles"),
  validateWorkflowRun: (workflowId) =>
    invokeWorkflow("validateWorkflowRun", workflowId),
  createWorkflow: (name) =>
    invokeWorkflow("createWorkflow", name),
  renameWorkflow: (id, name) =>
    invokeWorkflow("renameWorkflow", id, name),
  deleteWorkflow: (id, options) =>
    invokeWorkflow("deleteWorkflow", id, options),
  duplicateWorkflow: (workflowId, name) =>
    invokeWorkflow("duplicateWorkflow", workflowId, name),
  getWorkflowGraph: (workflowId) =>
    invokeWorkflow("getWorkflowGraph", workflowId),
  saveWorkflowGraph: (workflowId, graph) =>
    invokeWorkflow("saveWorkflowGraph", workflowId, graph),
  validateWorkflowGraph: (graph) =>
    invokeWorkflow("validateWorkflowGraph", graph),
  compileWorkflowGraph: (graph) =>
    invokeWorkflow("compileWorkflowGraph", graph),
  runWorkflow: (workflowId) =>
    invokeWorkflow("runWorkflow", workflowId),
  runWorkflowFromNode: (workflowId, startNodeId) =>
    invokeWorkflow("runWorkflowFromNode", workflowId, startNodeId),
  stopRun: (runId) => invokeWorkflow("stopRun", runId),
  getRunState: () => invokeWorkflow("getRunState"),
  listRunStates: () => invokeWorkflow("listRunStates"),
  listSchedules: () => invokeWorkflow("listSchedules"),
  getSchedule: (scheduleId) =>
    invokeWorkflow("getSchedule", scheduleId),
  createSchedule: (input) =>
    invokeWorkflow("createSchedule", input),
  updateSchedule: (scheduleId, patch) =>
    invokeWorkflow("updateSchedule", scheduleId, patch),
  deleteSchedule: (scheduleId) =>
    invokeWorkflow("deleteSchedule", scheduleId),
  enableSchedule: (scheduleId) =>
    invokeWorkflow("enableSchedule", scheduleId),
  disableSchedule: (scheduleId) =>
    invokeWorkflow("disableSchedule", scheduleId),
  listScheduleEvents: (filter) =>
    invokeWorkflow("listScheduleEvents", filter),
  validateSchedule: (schedule) =>
    invokeWorkflow("validateSchedule", schedule),
  exportWorkflow: (workflowId) =>
    invokeWorkflow("exportWorkflow", workflowId),
  importWorkflow: (exported) =>
    invokeWorkflow("importWorkflow", exported),
  exportWorkflowPackage: (workflowId, options) =>
    invokeWorkflow("exportWorkflowPackage", workflowId, options),
  previewWorkflowPackage: (packageValue) =>
    invokeWorkflow("previewWorkflowPackage", packageValue),
  importWorkflowPackage: (packageValue, options) =>
    invokeWorkflow(
      "importWorkflowPackage",
      packageValue,
      options,
    ),
  runBatchWorkflow: (workflowId, request) =>
    invokeWorkflow("runBatchWorkflow", workflowId, request),
  suggestSelectors: (snapshot) =>
    invokeWorkflow("suggestSelectors", snapshot),
  normalizeRecordedEvents: (events) =>
    invokeWorkflow("normalizeRecordedEvents", events),
  dryRunValidateConfig: (config) =>
    invokeWorkflow("dryRunValidateConfig", config),
  saveWorkflowPackageFile: (packageValue) =>
    invokeWorkflow("saveWorkflowPackageFile", packageValue),
};

contextBridge.exposeInMainWorld("workflowApi", workflowApi);
