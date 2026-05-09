import { spawn } from "node:child_process";

const processes = [];

function start(command, args, options = {}) {
  const child = spawn(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    ...options,
  });
  processes.push(child);
  return child;
}

function stopAll() {
  for (const child of processes) {
    if (!child.killed) child.kill();
  }
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

process.on("SIGINT", () => {
  stopAll();
  process.exit(130);
});
process.on("SIGTERM", () => {
  stopAll();
  process.exit(143);
});

const rendererUrl = "http://127.0.0.1:1420";
start("npx", ["tsc", "-p", "tsconfig.electron.json", "--watch", "--preserveWatchOutput"]);
start("npx", ["vite", "--host", "127.0.0.1"]);

await waitForRenderer(rendererUrl);

const electron = start("npx", ["electron", "."], {
  env: {
    ...process.env,
    VITE_DEV_SERVER_URL: rendererUrl,
  },
});

electron.on("exit", (code) => {
  stopAll();
  process.exit(code ?? 0);
});
