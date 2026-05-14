import type { WorkflowElectronBridge } from "../src/types/electron.js";
import type { workflowIpcChannels as mainWorkflowIpcChannels } from "./ipc.js";

const { contextBridge, ipcRenderer } = require("electron") as typeof import("electron");

type IpcResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { message: string; field?: string | null } };

const workflowIpcChannels = {
  listWorkflows: "workflow:listWorkflows",
  getWorkflow: "workflow:getWorkflow",
  getWorkflowBrowserConfig: "workflow:getWorkflowBrowserConfig",
  saveWorkflowBrowserConfig: "workflow:saveWorkflowBrowserConfig",
  getWorkflowSettings: "workflow:getWorkflowSettings",
  saveWorkflowSettings: "workflow:saveWorkflowSettings",
  saveWorkflowSettingsSection: "workflow:saveWorkflowSettingsSection",
  validateWorkflowSettings: "workflow:validateWorkflowSettings",
  validateWorkflowRun: "workflow:validateWorkflowRun",
  createWorkflow: "workflow:createWorkflow",
  renameWorkflow: "workflow:renameWorkflow",
  deleteWorkflow: "workflow:deleteWorkflow",
  duplicateWorkflow: "workflow:duplicateWorkflow",
  getWorkflowGraph: "workflow:getWorkflowGraph",
  saveWorkflowGraph: "workflow:saveWorkflowGraph",
  validateWorkflowGraph: "workflow:validateWorkflowGraph",
  compileWorkflowGraph: "workflow:compileWorkflowGraph",
  runWorkflow: "workflow:runWorkflow",
  runWorkflowFromNode: "workflow:runWorkflowFromNode",
  stopRun: "workflow:stopRun",
  getRunState: "workflow:getRunState",
  validateSchedule: "workflow:validateSchedule",
  exportWorkflow: "workflow:exportWorkflow",
  importWorkflow: "workflow:importWorkflow",
  exportWorkflowPackage: "workflow:exportWorkflowPackage",
  previewWorkflowPackage: "workflow:previewWorkflowPackage",
  importWorkflowPackage: "workflow:importWorkflowPackage",
  runBatchWorkflow: "workflow:runBatchWorkflow",
  suggestSelectors: "workflow:suggestSelectors",
  normalizeRecordedEvents: "workflow:normalizeRecordedEvents",
  dryRunValidateConfig: "workflow:dryRunValidateConfig",
  saveWorkflowPackageFile: "workflow:saveWorkflowPackageFile",
} as const satisfies typeof mainWorkflowIpcChannels;

async function invokeWorkflow<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = (await ipcRenderer.invoke(channel, ...args)) as IpcResult<T>;
  if (!result.ok) {
    throw result.error;
  }
  return result.value;
}

const workflowApi: WorkflowElectronBridge = {
  listWorkflows: () => invokeWorkflow(workflowIpcChannels.listWorkflows),
  getWorkflow: (id) => invokeWorkflow(workflowIpcChannels.getWorkflow, id),
  getWorkflowBrowserConfig: (workflowId) =>
    invokeWorkflow(workflowIpcChannels.getWorkflowBrowserConfig, workflowId),
  saveWorkflowBrowserConfig: (workflowId, config) =>
    invokeWorkflow(
      workflowIpcChannels.saveWorkflowBrowserConfig,
      workflowId,
      config,
    ),
  getWorkflowSettings: (workflowId) =>
    invokeWorkflow(workflowIpcChannels.getWorkflowSettings, workflowId),
  saveWorkflowSettings: (workflowId, settings) =>
    invokeWorkflow(workflowIpcChannels.saveWorkflowSettings, workflowId, settings),
  saveWorkflowSettingsSection: (workflowId, section, sectionValue) =>
    invokeWorkflow(
      workflowIpcChannels.saveWorkflowSettingsSection,
      workflowId,
      section,
      sectionValue,
    ),
  validateWorkflowSettings: (settings) =>
    invokeWorkflow(workflowIpcChannels.validateWorkflowSettings, settings),
  validateWorkflowRun: (workflowId) =>
    invokeWorkflow(workflowIpcChannels.validateWorkflowRun, workflowId),
  createWorkflow: (name) =>
    invokeWorkflow(workflowIpcChannels.createWorkflow, name),
  renameWorkflow: (id, name) =>
    invokeWorkflow(workflowIpcChannels.renameWorkflow, id, name),
  deleteWorkflow: (id) =>
    invokeWorkflow(workflowIpcChannels.deleteWorkflow, id),
  duplicateWorkflow: (workflowId, name) =>
    invokeWorkflow(workflowIpcChannels.duplicateWorkflow, workflowId, name),
  getWorkflowGraph: (workflowId) =>
    invokeWorkflow(workflowIpcChannels.getWorkflowGraph, workflowId),
  saveWorkflowGraph: (workflowId, graph) =>
    invokeWorkflow(workflowIpcChannels.saveWorkflowGraph, workflowId, graph),
  validateWorkflowGraph: (graph) =>
    invokeWorkflow(workflowIpcChannels.validateWorkflowGraph, graph),
  compileWorkflowGraph: (graph) =>
    invokeWorkflow(workflowIpcChannels.compileWorkflowGraph, graph),
  runWorkflow: (workflowId) =>
    invokeWorkflow(workflowIpcChannels.runWorkflow, workflowId),
  runWorkflowFromNode: (workflowId, startNodeId) =>
    invokeWorkflow(workflowIpcChannels.runWorkflowFromNode, workflowId, startNodeId),
  stopRun: () => invokeWorkflow(workflowIpcChannels.stopRun),
  getRunState: () => invokeWorkflow(workflowIpcChannels.getRunState),
  validateSchedule: (schedule) =>
    invokeWorkflow(workflowIpcChannels.validateSchedule, schedule),
  exportWorkflow: (workflowId) =>
    invokeWorkflow(workflowIpcChannels.exportWorkflow, workflowId),
  importWorkflow: (exported) =>
    invokeWorkflow(workflowIpcChannels.importWorkflow, exported),
  exportWorkflowPackage: (workflowId, options) =>
    invokeWorkflow(workflowIpcChannels.exportWorkflowPackage, workflowId, options),
  previewWorkflowPackage: (packageValue) =>
    invokeWorkflow(workflowIpcChannels.previewWorkflowPackage, packageValue),
  importWorkflowPackage: (packageValue, options) =>
    invokeWorkflow(
      workflowIpcChannels.importWorkflowPackage,
      packageValue,
      options,
    ),
  runBatchWorkflow: (workflowId, request) =>
    invokeWorkflow(workflowIpcChannels.runBatchWorkflow, workflowId, request),
  suggestSelectors: (snapshot) =>
    invokeWorkflow(workflowIpcChannels.suggestSelectors, snapshot),
  normalizeRecordedEvents: (events) =>
    invokeWorkflow(workflowIpcChannels.normalizeRecordedEvents, events),
  dryRunValidateConfig: (config) =>
    invokeWorkflow(workflowIpcChannels.dryRunValidateConfig, config),
  saveWorkflowPackageFile: (packageValue) =>
    invokeWorkflow(workflowIpcChannels.saveWorkflowPackageFile, packageValue),
};

contextBridge.exposeInMainWorld("workflowApi", workflowApi);
