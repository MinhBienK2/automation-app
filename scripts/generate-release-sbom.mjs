import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

function npmExecutable() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

async function runNpmSbom() {
  return new Promise((resolvePromise, rejectPromise) => {
    const child = spawn(npmExecutable(), ["sbom", "--sbom-format", "cyclonedx", "--omit", "dev"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", rejectPromise);
    child.on("close", (code) => {
      if (code === 0) {
        resolvePromise(Buffer.concat(stdout).toString("utf8"));
        return;
      }

      rejectPromise(new Error(Buffer.concat(stderr).toString("utf8") || `npm sbom exited with code ${code}`));
    });
  });
}

export async function generateReleaseSbom(outputPath) {
  const absoluteOutputPath = resolve(outputPath);
  const sbom = await runNpmSbom();

  JSON.parse(sbom);
  await mkdir(dirname(absoluteOutputPath), { recursive: true });
  await writeFile(absoluteOutputPath, sbom);

  return absoluteOutputPath;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const outputPath = process.argv[2] ?? "release/sbom.cyclonedx.json";
  await generateReleaseSbom(outputPath);
}
