import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain } from "electron";
import {
  createWorkflowCommandHandlers,
  serializeCommandError,
  type WorkflowCommandHandlers,
} from "./backend/commands.js";
import { createAppPaths, initializeDatabase, dropGraphJsonColumn } from "./backend/persistence/database.js";
import { migrateAllGraphs } from "./backend/persistence/migrateAllGraphs.js";
import { backfillGraphTables } from "./backend/persistence/backfillGraphTables.js";
import { pruneRevisions } from "./backend/persistence/revisionRepository.js";
import { loadAppConfig } from "./backend/persistence/appConfig.js";
import { initializePgPool } from "./backend/persistence/pgSync.js";
import pkg from "electron-updater";
const { autoUpdater } = pkg;
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

function loadEnvFile(appPath: string) {
  const possiblePaths = [
    path.join(process.cwd(), ".env"),
    path.join(appPath, ".env"),
  ];
  for (const envPath of possiblePaths) {
    try {
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, "utf8");
        console.log(`[startup-env] Loading environment variables from ${envPath}`);
        for (const line of content.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (process.env[key] === undefined) {
              process.env[key] = val;
            }
          }
        }
        break;
      }
    } catch (e) {
      console.error(`[startup-env] Failed to read env file at ${envPath}:`, e);
    }
  }
}

app.whenReady().then(async () => {
  loadEnvFile(app.getAppPath());
  const appPaths = createAppPaths(app.getPath("appData"));
  
  // Load app config
  const appConfig = loadAppConfig(appPaths.rootDir);
  if (appConfig.mode === "public" && appConfig.publicDatabaseUrl) {
    try {
      console.log("[startup] Public mode enabled. Initializing PG Pool...");
      await initializePgPool(appConfig.publicDatabaseUrl);
      console.log("[startup] PG Pool initialized successfully.");
    } catch (error) {
      console.error("[startup] Failed to initialize PG Pool on startup:", error);
    }
  }

  const database = await initializeDatabase(appPaths);
  const backfillReport = backfillGraphTables(database);
  console.log("[startup] graph backfill report:", backfillReport);
  const migrationReport = migrateAllGraphs(database);
  console.log("[startup] graph migration report:", migrationReport);
  dropGraphJsonColumn(database);
  const workflowPrune = pruneRevisions(database, "workflow");
  const subflowPrune = pruneRevisions(database, "subflow");
  console.log("[startup] revision pruning:", { workflow: workflowPrune, subflow: subflowPrune });
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
    async saveProjectPackageFile(packageValue) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: path.join(
          appPaths.rootDir,
          `${filenameFromWorkflowName(packageValue.project.name)}.project.json`,
        ),
        filters: [{ name: "Project package", extensions: ["json"] }],
        title: "Export Project",
      });
      if (canceled || !filePath) return null;

      await fs.writeFile(filePath, JSON.stringify(packageValue, null, 2), "utf8");
      return filePath;
    },
    async saveSubflowPackageFile(packageValue) {
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: path.join(
          appPaths.rootDir,
          `${filenameFromWorkflowName(packageValue.subflow.name)}.subflow.json`,
        ),
        filters: [{ name: "Subflow package", extensions: ["json"] }],
        title: "Export Subflow",
      });
      if (canceled || !filePath) return null;

      await fs.writeFile(filePath, JSON.stringify(packageValue, null, 2), "utf8");
      return filePath;
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
  setupAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

function setupAutoUpdater() {
  if (!app.isPackaged) {
    console.log("[updater] Running in development mode. Skipping auto-updater.");
    return;
  }

  console.log("[updater] Initializing auto-updater...");

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on("checking-for-update", () => {
    console.log("[updater] Checking for update...");
  });

  autoUpdater.on("update-available", (info) => {
    console.log(`[updater] Update available: v${info.version}. Downloading in background...`);
  });

  autoUpdater.on("update-not-available", () => {
    console.log("[updater] Update not available. Running on latest version.");
  });

  autoUpdater.on("error", (err) => {
    console.error("[updater] Error in auto-updater:", err);
  });

  autoUpdater.on("update-downloaded", (info) => {
    console.log(`[updater] Update v${info.version} downloaded.`);

    const response = dialog.showMessageBoxSync({
      type: "info",
      buttons: ["Restart and Update", "Later"],
      defaultId: 0,
      cancelId: 1,
      title: "Update Available",
      message: `A new version of the app (v${info.version}) has been downloaded.`,
      detail: "The application needs to restart to apply the update now.",
    });

    if (response === 0) {
      autoUpdater.quitAndInstall();
    }
  });

  void autoUpdater.checkForUpdates().catch((err) => {
    console.error("[updater] Failed to check for updates:", err);
  });
}

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
