import { app, BrowserWindow, ipcMain, shell } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createAppApi } from "./appApi.js";
import { registerIpcHandlers } from "./ipc.js";
import { createRunnerSupervisor } from "./runnerSupervisor.js";
import { createStorageService } from "./storage.js";
import { createCloakBrowserAdapter } from "../runner/cloakBrowserAdapter.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow: BrowserWindow | null = null;

type RendererEntry =
  | { kind: "url"; value: string }
  | { kind: "file"; value: string };

function rendererEntry(): RendererEntry {
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) {
    return { kind: "url", value: rendererUrl };
  }
  return { kind: "file", value: path.join(app.getAppPath(), "dist", "index.html") };
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 960,
    minWidth: 1080,
    minHeight: 720,
    backgroundColor: "#171717",
    title: "CloakBrowser Automation Lab",
    webPreferences: {
      preload: path.join(__dirname, "..", "preload", "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: "deny" };
  });

  const entry = rendererEntry();
  if (entry.kind === "url") {
    await mainWindow.loadURL(entry.value);
  } else {
    await mainWindow.loadFile(entry.value);
  }
}

function bootstrapServices() {
  const storage = createStorageService({ appDataDir: app.getPath("userData") });
  storage.initialize();
  const runner = createRunnerSupervisor({
    runnerEntry: path.join(__dirname, "..", "runner", "stdioRunner.js"),
  });
  const api = createAppApi({
    storage,
    appDataDir: app.getPath("userData"),
    createAdapter: createCloakBrowserAdapter,
    runner,
  });
  registerIpcHandlers(ipcMain, api);

  app.on("before-quit", () => {
    void runner.shutdown();
    storage.close();
  });
}

void app.whenReady().then(async () => {
  bootstrapServices();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
