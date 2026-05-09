import type { IpcMain } from "electron";
import type { AppApi } from "./appApi.js";

export function registerIpcHandlers(ipcMain: IpcMain, api: AppApi) {
  ipcMain.handle("workflow.list", () => api.workflows.list());
  ipcMain.handle("workflow.get", (_event, input: { id: string }) => api.workflows.get(input));
  ipcMain.handle("workflow.create", (_event, input: { name: string }) => api.workflows.create(input));
  ipcMain.handle("workflow.rename", (_event, input: { id: string; name: string }) =>
    api.workflows.rename(input),
  );
  ipcMain.handle("workflow.delete", (_event, input: { id: string }) => api.workflows.delete(input));
  ipcMain.handle("workflow.duplicate", (_event, input: { workflowId: string; name: string }) =>
    api.workflows.duplicate(input),
  );

  ipcMain.handle("settings.get", (_event, input: { workflowId: string }) => api.settings.get(input));
  ipcMain.handle("settings.save", (_event, input) => api.settings.save(input));
  ipcMain.handle("settings.saveSection", (_event, input) => api.settings.saveSection(input));
  ipcMain.handle("settings.validate", () => api.settings.validate());
  ipcMain.handle("settings.validateRun", (_event, input: { workflowId: string }) =>
    api.settings.validateRun(input),
  );
  ipcMain.handle("settings.getBrowserConfig", async (_event, input: { workflowId: string }) => {
    const settings = await api.settings.get(input);
    return { workflow_id: input.workflowId, ...settings.browser };
  });
  ipcMain.handle("settings.saveBrowserConfig", async (_event, input) => {
    return api.settings.saveSection({
      workflowId: input.workflowId,
      section: "browser",
      sectionValue: input.config,
    });
  });

  ipcMain.handle("graph.loadActive", (_event, input: { workflowId: string }) =>
    api.graphs.loadActive(input),
  );
  ipcMain.handle("graph.save", (_event, input) => api.graphs.save(input));
  ipcMain.handle("graph.validate", (_event, input) => api.graphs.validate(input));
  ipcMain.handle("graph.compile", (_event, input) => api.graphs.compile(input));

  ipcMain.handle("run.list", (_event, input: { workflowId?: string; limit?: number } = {}) =>
    api.runs.list(input),
  );
  ipcMain.handle("run.start", (_event, input: { workflowId: string }) => api.runs.start(input));
  ipcMain.handle("run.stop", () => api.runs.stop());
  ipcMain.handle("run.getState", () => api.runs.getState());

  ipcMain.handle("profile.list", () => api.profiles.list());
  ipcMain.handle("profile.get", (_event, input: { id: string }) => api.profiles.get(input));
  ipcMain.handle("profile.create", (_event, input) => api.profiles.create(input));
  ipcMain.handle("profile.update", (_event, input) => api.profiles.update(input));
  ipcMain.handle("profile.delete", (_event, input: { id: string }) => api.profiles.delete(input));
  ipcMain.handle("profile.validate", (_event, input) => api.profiles.validate(input));

  ipcMain.handle("evidence.listEvents", (_event, input: { runId: string }) =>
    api.evidence.listEvents(input),
  );
  ipcMain.handle("evidence.listArtifacts", (_event, input: { runId: string }) =>
    api.evidence.listArtifacts(input),
  );
  ipcMain.handle("evidence.exportRun", (_event, input: { runId: string }) =>
    api.evidence.exportRun(input),
  );
  ipcMain.handle("evidence.sanitize", (_event, input) => api.evidence.sanitize(input));

  ipcMain.handle("policy.get", () => api.policy.get());
  ipcMain.handle("policy.save", (_event, input) => api.policy.save(input));
}
