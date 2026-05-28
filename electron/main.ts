import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import {
  createWorkflowCommandHandlers,
  serializeCommandError,
  type WorkflowCommandHandlers,
} from "./backend/commands.js";
import { createAppPaths, initializeDatabase } from "./backend/persistence/database.js";
import {
  workflowIpcChannels,
  type WorkflowIpcChannelName,
} from "./ipc.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
let mainWindow: BrowserWindow | null = null;

function configureLinuxGraphicsWorkarounds() {
  if (process.platform !== "linux") return;

  app.commandLine.appendSwitch(
    "disable-features",
    "VaapiVideoDecoder,VaapiVideoEncoder",
  );
  app.commandLine.appendSwitch("disable-accelerated-video-decode");
  app.commandLine.appendSwitch("disable-accelerated-video-encode");
}

configureLinuxGraphicsWorkarounds();

const appDataOverride = process.env.AUTOMATION_APP_DATA_DIR;
if (appDataOverride) {
  app.setPath("appData", appDataOverride);
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 640,
    icon: getAppIconPath(),
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(currentDir, "preload.cjs"),
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow?.show();
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, targetUrl) => {
    if (!isAllowedRendererUrl(targetUrl, devServerUrl)) {
      event.preventDefault();
    }
  });

  if (devServerUrl) {
    void mainWindow.loadURL(devServerUrl);
    if (process.env.ELECTRON_OPEN_DEVTOOLS === "1") {
      mainWindow.webContents.openDevTools({ mode: "detach" });
    }
  } else {
    void mainWindow.loadFile(path.join(currentDir, "../../dist/index.html"));
  }
}

function getAppIconPath() {
  return app.isPackaged
    ? path.join(app.getAppPath(), "dist/app-logo.png")
    : path.join(app.getAppPath(), "public/app-logo.png");
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
  const handlers = createWorkflowCommandHandlers({
    appPaths,
    database,
    async saveWorkflowPackageFile(packageValue) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: path.join(
          appPaths.rootDir,
          `${filenameFromWorkflowName(packageValue.workflow.name)}.workflow.json`,
        ),
        filters: [{ name: "Workflow package", extensions: ["json"] }],
        title: "Export Workflow",
      });
      if (canceled || !filePath) return null;

      await fs.writeFile(filePath, JSON.stringify(packageValue, null, 2), "utf8");
      return filePath;
    },
    revealEvidenceArtifact(absolutePath) {
      shell.showItemInFolder(absolutePath);
    },
    async selectEvidenceBundleDirectory() {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        defaultPath: appPaths.rootDir,
        properties: ["openDirectory", "createDirectory"],
        title: "Export Evidence Bundle",
      });
      return canceled ? null : filePaths[0] ?? null;
    },
  });
  registerWorkflowIpc(handlers);
  const schedulerInterval = setInterval(() => {
    void handlers.runSchedulerTick().catch((error) => {
      console.error("Workflow scheduler tick failed", error);
    });
  }, 30_000);
  app.once("before-quit", () => clearInterval(schedulerInterval));
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

function filenameFromWorkflowName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "workflow";
}

function isAllowedRendererUrl(targetUrl: string, devServerUrl?: string) {
  try {
    const parsedTarget = new URL(targetUrl);
    if (devServerUrl) {
      return parsedTarget.origin === new URL(devServerUrl).origin;
    }
    return parsedTarget.protocol === "file:";
  } catch {
    return false;
  }
}
