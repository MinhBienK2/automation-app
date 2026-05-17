import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";

const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as {
  load: (source: string) => unknown;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workflowPath = path.join(currentDir, ".github/workflows/desktop-release.yml");
const packageJsonPath = path.join(currentDir, "package.json");

async function readDesktopReleaseWorkflow() {
  const source = await readFile(workflowPath, "utf8");
  return yaml.load(source) as Record<string, unknown>;
}

function getRecord(value: unknown) {
  expect(value).toBeTypeOf("object");
  expect(value).not.toBeNull();

  return value as Record<string, unknown>;
}

function getArray(value: unknown) {
  expect(value).toBeInstanceOf(Array);

  return value as unknown[];
}

function getWorkflowTriggers(workflow: Record<string, unknown>) {
  return getRecord(workflow.on);
}

describe("desktop CI/CD", () => {
  test("builds desktop artifacts when main receives new code", async () => {
    const workflow = await readDesktopReleaseWorkflow();
    const triggers = getWorkflowTriggers(workflow);
    const push = getRecord(triggers.push);

    expect(getArray(push.branches)).toContain("main");
    expect(triggers).toHaveProperty("workflow_dispatch");
  });

  test("runs quality gates before packaging", async () => {
    const workflow = await readDesktopReleaseWorkflow();
    const jobs = getRecord(workflow.jobs);
    const quality = getRecord(jobs.quality);
    const steps = getArray(getRecord(quality).steps).map((step) => getRecord(step));
    const runCommands = steps.map((step) => step.run).filter(Boolean);

    expect(quality["runs-on"]).toBe("ubuntu-latest");
    expect(runCommands).toContain("npm ci");
    expect(runCommands).toContain("npx tsc --noEmit");
    expect(runCommands).toContain("npm test");
  });

  test("packages macOS, Windows, and Ubuntu/Linux artifacts", async () => {
    const workflow = await readDesktopReleaseWorkflow();
    const jobs = getRecord(workflow.jobs);
    const packageJob = getRecord(jobs.package);
    const strategy = getRecord(packageJob.strategy);
    const matrix = getRecord(strategy.matrix);
    const include = getArray(matrix.include).map((entry) => getRecord(entry));
    const packageScripts = include.map((entry) => entry.package_script);
    const runners = include.map((entry) => entry.os);
    const artifactNames = include.map((entry) => entry.artifact_name);
    const steps = getArray(packageJob.steps).map((step) => getRecord(step));

    expect(packageJob.needs).toBe("quality");
    expect(runners).toEqual(expect.arrayContaining(["macos-latest", "windows-latest", "ubuntu-latest"]));
    expect(packageScripts).toEqual(
      expect.arrayContaining(["electron:pack:mac", "electron:pack:win", "electron:pack:linux"]),
    );
    expect(artifactNames).toEqual(
      expect.arrayContaining(["automation-app-macos", "automation-app-windows", "automation-app-ubuntu-linux"]),
    );
    expect(steps.some((step) => step.uses === "actions/upload-artifact@v4")).toBe(true);
  });

  test("declares electron-builder package targets for every supported desktop OS", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      author?: string | { name?: string; email?: string };
      scripts: Record<string, string>;
      build: {
        mac?: { target?: string[] };
        win?: { target?: string[] };
        linux?: { target?: string[]; maintainer?: string };
      };
    };

    expect(packageJson.scripts["electron:pack:mac"]).toContain("--mac");
    expect(packageJson.scripts["electron:pack:win"]).toContain("--win");
    expect(packageJson.scripts["electron:pack:linux"]).toContain("--linux");
    expect(packageJson.build.mac?.target).toEqual(expect.arrayContaining(["dmg", "zip"]));
    expect(packageJson.build.win?.target).toEqual(expect.arrayContaining(["nsis", "zip"]));
    expect(packageJson.build.linux?.target).toEqual(expect.arrayContaining(["AppImage", "deb", "tar.gz"]));
    expect(packageJson.build.linux?.maintainer ?? packageJson.author).toBeTruthy();
  });
});
