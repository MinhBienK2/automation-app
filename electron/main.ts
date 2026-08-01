import path from "node:path";
import fs from "node:fs/promises";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import {
  createWorkflowCommandHandlers,
  serializeCommandError,
  type WorkflowCommandHandlers,
} from "./backend/commands.js";
import { createAppPaths } from "./backend/db/database.js";
import { initializeJwtSecret } from "./backend/db/pgSync.js";
import { loadAppConfig } from "./backend/config/appConfig.js";
import { initializePgPool } from "./backend/db/pgSync.js";
import { PgDbAdapter } from "./backend/db/dbAdapter.js";
import { PostgresDbConnection, checkMigrationsPending } from "./backend/db/migrations/migrationRunner.js";
import { migrations } from "./backend/db/migrations/migrations.js";
import { checkMongoMigrationsPending } from "./backend/db/mongo.js";

import pkg from "electron-updater";
const { autoUpdater } = pkg;
import {
  areFontsAlreadySetup,
  setupCloakBrowserFonts,
} from "./backend/diagnostics/setupFonts.js";
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
        // `WorkflowIpcContract` in ./ipcContract.ts proves every channel name is
        // a handler name, so this lookup is total. Without that proof a missing
        // handler surfaced here as an oblique TS7053 on the indexed access.
        const handler = handlers[methodName] as (...handlerArgs: unknown[]) => unknown;
        const value = await handler(...args);

        // Auto ensure default project/profiles model exists on login/me
        if (methodName === "login" || methodName === "me") {
          if (value) {
            await handlers.ensureProjectModelReady();
          }
        }

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

// eslint-disable-next-line max-lines-per-function
app.whenReady().then(async () => {
  loadEnvFile(app.getAppPath());
  const appPaths = createAppPaths(app.getPath("appData"));
  initializeJwtSecret(appPaths.rootDir);

  // Load config & assert PG URL
  const appConfig = loadAppConfig(appPaths.rootDir);
  if (!appConfig.publicDatabaseUrl) {
    dialog.showErrorBox(
      "Database Connection Required",
      "DATABASE_URL environment variable is not configured. The application requires PostgreSQL connection to run.",
    );
    app.quit();
    return;
  }

  let pool;
  try {
    console.log("[startup] Connecting to PG database...");
    pool = await initializePgPool(appConfig.publicDatabaseUrl);
    console.log("[startup] PG Pool initialized successfully.");

    // Check schema compatibility
    const conn = new PostgresDbConnection(pool);
    const pending = await checkMigrationsPending(conn, migrations);
    if (pending.length > 0) {
      console.error(`[startup] Database schema is out of date. Pending migrations: ${pending.join(", ")}`);
      dialog.showErrorBox(
        "Database Schema Out of Date",
        "Your database schema is outdated. Please run \"npm run db:migrate\" to update the database schema before launching the application."
      );
      app.quit();
      return;
    }
    console.log("[startup] Database schema check completed. Schema is up to date.");

    // Check MongoDB migrations
    try {
      const pendingMongo = await checkMongoMigrationsPending(app.getAppPath());
      if (pendingMongo.length > 0) {
        console.error(`[startup] MongoDB schema is out of date. Pending migrations: ${pendingMongo.join(", ")}`);
        dialog.showErrorBox(
          "MongoDB Schema Out of Date",
          "Your MongoDB schema is outdated. Please run \"npm run db:migrate-mongo:up\" to update the database schema before launching the application."
        );
        app.quit();
        return;
      }
      console.log("[startup] MongoDB schema check completed. Schema is up to date.");
    } catch (mongoError) {
      console.error("[startup] Failed to check MongoDB migrations:", mongoError);
      dialog.showErrorBox(
        "MongoDB Connection Failed",
        `Failed to connect or check MongoDB migrations: ${mongoError instanceof Error ? mongoError.message : String(mongoError)}`,
      );
      app.quit();
      return;
    }

  } catch (error) {
    dialog.showErrorBox(
      "Database Connection Failed",
      `Failed to connect or migrate PostgreSQL: ${error instanceof Error ? error.message : String(error)}`,
    );
    app.quit();
    return;
  }

  const database = new PgDbAdapter(pool);

  if (process.platform === "linux") {
    try {
      const alreadySetup = await areFontsAlreadySetup(appPaths.rootDir);
      if (!alreadySetup) {
        console.log("[startup] Fonts not found in config dir. Initializing download/setup...");
        await setupCloakBrowserFonts({ repoRoot: appPaths.rootDir });
        console.log("[startup] Fonts setup completed.");
      } else {
        console.log("[startup] Fonts already present in config dir.");
      }
    } catch (error) {
      console.error("[startup] Failed to automatically setup fonts on startup:", error);
    }
  }

  const handlers = createWorkflowCommandHandlers({
    appPaths,
    database,
    defaultFingerprintFontsDir: path.join(appPaths.rootDir, ".local", "cloakbrowser-fonts", "linux"),
    async openPath(targetPath: string) {
      await shell.openPath(targetPath);
    },
    async saveWorkflowPackageFile(packageValue: any) {
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
    async saveProjectPackageFile(packageValue: any) {
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
    async saveSubflowPackageFile(packageValue: any) {
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
    void handlers.checkAndRunAutomaticBackup().catch((error) => {
      console.error("Automatic backup tick failed", error);
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
