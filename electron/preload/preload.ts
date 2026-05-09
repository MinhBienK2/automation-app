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
    getDefaults: (input: { workflowId: string }) => ipcRenderer.invoke("workflow.getDefaults", input),
    updateDefaults: (input: unknown) => ipcRenderer.invoke("workflow.updateDefaults", input),
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
    list: (input?: { workflowId?: string; limit?: number }) => ipcRenderer.invoke("run.list", input ?? {}),
    start: (input: { workflowId: string }) => ipcRenderer.invoke("run.start", input),
    stop: () => ipcRenderer.invoke("run.stop"),
    getState: () => ipcRenderer.invoke("run.getState"),
    onEvent: (handler: (event: unknown) => void) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => handler(payload);
      ipcRenderer.on("run.event", listener);
      return () => ipcRenderer.removeListener("run.event", listener);
    },
  },
  profiles: {
    list: () => ipcRenderer.invoke("profile.list"),
    get: (input: { id: string }) => ipcRenderer.invoke("profile.get", input),
    create: (input: unknown) => ipcRenderer.invoke("profile.create", input),
    update: (input: unknown) => ipcRenderer.invoke("profile.update", input),
    delete: (input: { id: string }) => ipcRenderer.invoke("profile.delete", input),
    validate: (input: unknown) => ipcRenderer.invoke("profile.validate", input),
    checkAvailability: (input: { id: string }) =>
      ipcRenderer.invoke("profile.checkAvailability", input),
  },
  evidence: {
    listEvents: (input: { runId: string }) => ipcRenderer.invoke("evidence.listEvents", input),
    listArtifacts: (input: { runId: string }) =>
      ipcRenderer.invoke("evidence.listArtifacts", input),
    exportRun: (input: { runId: string }) => ipcRenderer.invoke("evidence.exportRun", input),
    sanitize: (input: unknown) => ipcRenderer.invoke("evidence.sanitize", input),
  },
  policy: {
    get: () => ipcRenderer.invoke("policy.get"),
    save: (input: unknown) => ipcRenderer.invoke("policy.save", input),
  },
  runProfiles: {
    list: (input?: { workflowId?: string | null }) => ipcRenderer.invoke("runProfile.list", input ?? {}),
    get: (input: { id: string }) => ipcRenderer.invoke("runProfile.get", input),
    create: (input: unknown) => ipcRenderer.invoke("runProfile.create", input),
    update: (input: unknown) => ipcRenderer.invoke("runProfile.update", input),
    delete: (input: { id: string }) => ipcRenderer.invoke("runProfile.delete", input),
  },
  environments: {
    list: () => ipcRenderer.invoke("environment.list"),
    get: (input: { id: string }) => ipcRenderer.invoke("environment.get", input),
    create: (input: unknown) => ipcRenderer.invoke("environment.create", input),
    update: (input: unknown) => ipcRenderer.invoke("environment.update", input),
    delete: (input: { id: string }) => ipcRenderer.invoke("environment.delete", input),
  },
};

contextBridge.exposeInMainWorld("cloakBrowser", api);
