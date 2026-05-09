import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, ipcMain } from "electron";
import {
  createWorkflowCommandHandlers,
  serializeCommandError,
  type WorkflowCommandHandlers,
} from "./backend/commands.js";
import { createAppPaths, initializeDatabase } from "./backend/database.js";
import {
  workflowIpcChannels,
  type WorkflowIpcChannelName,
} from "./ipc.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      preload: path.join(currentDir, "preload.js"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    void mainWindow.loadFile(path.join(currentDir, "../../dist/index.html"));
  }
}

function registerWorkflowIpc(handlers: WorkflowCommandHandlers) {
  for (const [methodName, channel] of Object.entries(workflowIpcChannels) as Array<
    [WorkflowIpcChannelName, string]
  >) {
    ipcMain.handle(channel, async (_event, ...args: unknown[]) => {
      try {
        const handler = handlers[methodName] as (...handlerArgs: unknown[]) => unknown;
        const value = await handler(...args);
        return { ok: true, value };
      } catch (error) {
        return { ok: false, error: serializeCommandError(error) };
      }
    });
  }
}

app.whenReady().then(() => {
  const appPaths = createAppPaths(app.getPath("appData"));
  const database = initializeDatabase(appPaths);
  registerWorkflowIpc(createWorkflowCommandHandlers({ appPaths, database }));
  createMainWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
