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
  listProjects: () => invokeWorkflow("listProjects"),
  createProject: (input) => invokeWorkflow("createProject", input),
  updateProject: (projectId, input) =>
    invokeWorkflow("updateProject", projectId, input),
  duplicateProject: (projectId) =>
    invokeWorkflow("duplicateProject", projectId),
  exportProjectPackage: (projectId) =>
    invokeWorkflow("exportProjectPackage", projectId),
  previewProjectPackage: (packageValue) =>
    invokeWorkflow("previewProjectPackage", packageValue),
  importProjectPackage: (packageValue) =>
    invokeWorkflow("importProjectPackage", packageValue),
  deleteProject: (projectId) => invokeWorkflow("deleteProject", projectId),
  listProjectEnvironments: (projectId) =>
    invokeWorkflow("listProjectEnvironments", projectId),
  createProjectEnvironment: (projectId, input) =>
    invokeWorkflow("createProjectEnvironment", projectId, input),
  updateProjectEnvironment: (environmentId, input) =>
    invokeWorkflow("updateProjectEnvironment", environmentId, input),
  resetProjectEnvironmentBrowserIdentity: (environmentId) =>
    invokeWorkflow("resetProjectEnvironmentBrowserIdentity", environmentId),
  setWorkflowEnvironment: (workflowId, environmentId) =>
    invokeWorkflow("setWorkflowEnvironment", workflowId, environmentId),
  createSubflow: (projectId, input) =>
    invokeWorkflow("createSubflow", projectId, input),
  listSubflows: (projectId) =>
    invokeWorkflow("listSubflows", projectId),
  getSubflow: (subflowId) =>
    invokeWorkflow("getSubflow", subflowId),
  updateSubflow: (subflowId, input) =>
    invokeWorkflow("updateSubflow", subflowId, input),
  getSubflowGraph: (subflowId) =>
    invokeWorkflow("getSubflowGraph", subflowId),
  saveSubflowGraph: (subflowId, graph) =>
    invokeWorkflow("saveSubflowGraph", subflowId, graph),
  duplicateSubflow: (subflowId, name) =>
    invokeWorkflow("duplicateSubflow", subflowId, name),
  deleteSubflow: (subflowId) =>
    invokeWorkflow("deleteSubflow", subflowId),
  getSubflowUsage: (subflowId) =>
    invokeWorkflow("getSubflowUsage", subflowId),
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
  createWorkflow: (name, options) =>
    invokeWorkflow("createWorkflow", name, options),
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
  getOperationsOverview: (request) =>
    invokeWorkflow("getOperationsOverview", request),
  listEvidenceItems: (request) =>
    invokeWorkflow("listEvidenceItems", request),
  getEvidenceDetail: (evidenceId) =>
    invokeWorkflow("getEvidenceDetail", evidenceId),
  getEvidenceScreenshotPreview: (evidenceId) =>
    invokeWorkflow("getEvidenceScreenshotPreview", evidenceId),
  revealEvidenceArtifact: (evidenceId) =>
    invokeWorkflow("revealEvidenceArtifact", evidenceId),
  exportEvidenceBundle: (request) =>
    invokeWorkflow("exportEvidenceBundle", request),
  getIdentityLabOverview: (request) =>
    invokeWorkflow("getIdentityLabOverview", request),
  getIdentityLabDetail: (target) =>
    invokeWorkflow("getIdentityLabDetail", target),
  closeIdentityRetainedSession: (workflowId, profileName) =>
    invokeWorkflow("closeIdentityRetainedSession", workflowId, profileName),
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
  startRecordingSession: (input) =>
    invokeWorkflow("startRecordingSession", input),
  getRecordingSession: (sessionId) =>
    invokeWorkflow("getRecordingSession", sessionId),
  stopRecordingSession: (sessionId) =>
    invokeWorkflow("stopRecordingSession", sessionId),
  listRecordingEvents: (sessionId) =>
    invokeWorkflow("listRecordingEvents", sessionId),
  discardRecordingSession: (sessionId) =>
    invokeWorkflow("discardRecordingSession", sessionId),
  generateRecordingDraft: (sessionId, options) =>
    invokeWorkflow("generateRecordingDraft", sessionId, options),
  getRecordingDraft: (draftId) =>
    invokeWorkflow("getRecordingDraft", draftId),
  saveRecordingDraft: (draftId, input) =>
    invokeWorkflow("saveRecordingDraft", draftId, input),
  dryRunValidateConfig: (config) =>
    invokeWorkflow("dryRunValidateConfig", config),
  saveWorkflowPackageFile: (packageValue) =>
    invokeWorkflow("saveWorkflowPackageFile", packageValue),
  saveProjectPackageFile: (packageValue) =>
    invokeWorkflow("saveProjectPackageFile", packageValue),
};

contextBridge.exposeInMainWorld("workflowApi", workflowApi);
