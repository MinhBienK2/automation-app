import { contextBridge, ipcRenderer } from "electron";

const api = {
  workflows: {
    list: () => ipcRenderer.invoke("workflow.list"),
    get: (input: { id: string }) => ipcRenderer.invoke("workflow.get", input),
    create: (input: { name: string }) => ipcRenderer.invoke("workflow.create", input),
    rename: (input: { id: string; name: string }) => ipcRenderer.invoke("workflow.rename", input),
    delete: (input: { id: string }) => ipcRenderer.invoke("workflow.delete", input),
    duplicate: (input: { workflowId: string; name: string }) =>
      ipcRenderer.invoke("workflow.duplicate", input),
  },
  settings: {
    get: (input: { workflowId: string }) => ipcRenderer.invoke("settings.get", input),
    save: (input: unknown) => ipcRenderer.invoke("settings.save", input),
    saveSection: (input: unknown) => ipcRenderer.invoke("settings.saveSection", input),
    validate: (input: unknown) => ipcRenderer.invoke("settings.validate", input),
    validateRun: (input: { workflowId: string }) =>
      ipcRenderer.invoke("settings.validateRun", input),
    getBrowserConfig: (input: { workflowId: string }) =>
      ipcRenderer.invoke("settings.getBrowserConfig", input),
    saveBrowserConfig: (input: unknown) =>
      ipcRenderer.invoke("settings.saveBrowserConfig", input),
  },
  graphs: {
    loadActive: (input: { workflowId: string }) => ipcRenderer.invoke("graph.loadActive", input),
    save: (input: unknown) => ipcRenderer.invoke("graph.save", input),
    validate: (input: unknown) => ipcRenderer.invoke("graph.validate", input),
    compile: (input: unknown) => ipcRenderer.invoke("graph.compile", input),
  },
  runs: {
    start: (input: { workflowId: string }) => ipcRenderer.invoke("run.start", input),
    stop: () => ipcRenderer.invoke("run.stop"),
    getState: () => ipcRenderer.invoke("run.getState"),
  },
};

contextBridge.exposeInMainWorld("cloakBrowser", api);
