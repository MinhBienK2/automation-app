import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import path from "node:path";
import electronPath from "electron";
import { createElectronWatchOutputHandler } from "./electron-dev-utils.mjs";

const processes = [];
let electronProcess = null;
let restartingElectron = false;
let restartTimeout = null;

let distWatcher = null;
let distWatcherStarted = false;
let distWatcherTimeout = null;

function startWatchingDist() {
  if (distWatcherStarted) return;
  distWatcherStarted = true;

  if (distWatcherTimeout) {
    clearTimeout(distWatcherTimeout);
    distWatcherTimeout = null;
  }

  const distDir = path.join(process.cwd(), "dist-electron");
  try {
    distWatcher = fs.watch(distDir, { recursive: true }, (eventType, filename) => {
      if (filename && (filename.endsWith(".js") || filename.endsWith(".cjs"))) {
        if (electronProcess) {
          lastRestartReason = `fs.watch file change: ${filename}`;
          scheduleElectronRestart();
        }
      }
    });
  } catch (err) {
    console.error("Failed to start fs.watch on dist-electron:", err);
  }
}

function scheduleStartWatchingDist(delayMs = 1000) {
  if (distWatcherTimeout) clearTimeout(distWatcherTimeout);
  distWatcherTimeout = setTimeout(() => {
    distWatcherTimeout = null;
    startWatchingDist();
  }, delayMs);
}

const electronWatchOutput = createElectronWatchOutputHandler({
  onInitialReady: () => {
    scheduleStartWatchingDist(1000);
  },
  onSuccessfulRebuild: () => {
    if (electronProcess) {
      lastRestartReason = "stdout successful watch rebuild";
      scheduleElectronRestart();
    }
  },
});

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  processes.push(child);
  return child;
}

function pipeOutput(child) {
  child.stdout?.on("data", (chunk) => {
    process.stdout.write(chunk);
    electronWatchOutput.handleStdoutChunk(chunk);
  });
  child.stderr?.on("data", (chunk) => {
    process.stderr.write(chunk);
  });
}

function runInitialElectronBuild() {
  const result = spawnSync("npx", ["tsc", "-p", "tsconfig.electron.json"], {
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`Electron main build failed with exit code ${result.status ?? "unknown"}`);
  }
}

function stopAll() {
  if (restartTimeout) {
    clearTimeout(restartTimeout);
    restartTimeout = null;
  }
  if (distWatcherTimeout) {
    clearTimeout(distWatcherTimeout);
    distWatcherTimeout = null;
  }

  if (distWatcher) {
    distWatcher.close();
    distWatcher = null;
  }
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
}

function startElectron(rendererUrl) {
  electronProcess = start(electronPath, ["."], {
    shell: false,
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: rendererUrl,
    },
  });

  electronProcess.on("exit", (code) => {
    if (restartingElectron) {
      restartingElectron = false;
      electronProcess = null;
      startElectron(rendererUrl);
      return;
    }

    stopAll();
    process.exit(code ?? 0);
  });
}

function restartElectron() {
  if (!electronProcess || electronProcess.killed) return;
  restartingElectron = true;
  electronProcess.kill();
}

let lastRestartReason = "";

function scheduleElectronRestart() {
  const reason = lastRestartReason || "unknown";
  console.log(`[dev-restart-trigger] Reason: ${reason}`);
  lastRestartReason = "";
  if (restartTimeout) clearTimeout(restartTimeout);
  restartTimeout = setTimeout(() => {
    restartTimeout = null;
    restartElectron();
  }, 150);
}

async function waitForRenderer(url) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Renderer is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }
  throw new Error(`Timed out waiting for renderer at ${url}`);
}

async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

async function findAvailablePort(startPort) {
  for (let port = startPort; port < startPort + 50; port += 1) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available renderer port found from ${startPort} to ${startPort + 49}`);
}

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

const rendererPort = await findAvailablePort(1420);
const rendererUrl = `http://127.0.0.1:${rendererPort}`;
await runInitialElectronBuild();
const tscWatch = start(
  "npx",
  ["tsc", "-p", "tsconfig.electron.json", "--watch", "--preserveWatchOutput"],
  { stdio: ["inherit", "pipe", "pipe"] },
);
pipeOutput(tscWatch);
start("npx", ["vite", "--host", "127.0.0.1", "--port", String(rendererPort), "--strictPort"]);

await waitForRenderer(rendererUrl);

startElectron(rendererUrl);
