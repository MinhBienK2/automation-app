import { mkdtemp, readdir, readFile, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { promisify } from "node:util";
import { describe, expect, test } from "vitest";

const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const yaml = require("js-yaml") as {
  load: (source: string) => unknown;
};

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workflowsDir = path.join(currentDir, ".github/workflows");
const ciWorkflowPath = path.join(workflowsDir, "desktop-ci.yml");
const releaseWorkflowPath = path.join(workflowsDir, "desktop-release.yml");
const codeqlWorkflowPath = path.join(workflowsDir, "codeql.yml");
const dependabotPath = path.join(currentDir, ".github/dependabot.yml");
const releaseGovernancePath = path.join(currentDir, "docs/release-governance.md");
const packageJsonPath = path.join(currentDir, "package.json");
const packageLockPath = path.join(currentDir, "package-lock.json");
const backendDir = path.join(currentDir, "electron/backend");
const preloadPath = path.join(currentDir, "electron/preload.cts");
const releaseManifestScriptPath = path.join(currentDir, "scripts/generate-release-manifest.mjs");
const releaseSbomScriptPath = path.join(currentDir, "scripts/generate-release-sbom.mjs");

async function readYamlFile(filePath: string) {
  const source = await readFile(filePath, "utf8");
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

function collectUses(value: unknown): string[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectUses(entry));
  }

  const record = value as Record<string, unknown>;
  const ownUses = typeof record.uses === "string" ? [record.uses] : [];

  return ownUses.concat(Object.values(record).flatMap((entry) => collectUses(entry)));
}

function collectSetupNodeVersions(value: unknown): unknown[] {
  if (typeof value !== "object" || value === null) {
    return [];
  }

  if (Array.isArray(value)) {
    return value.flatMap((entry) => collectSetupNodeVersions(entry));
  }

  const record = value as Record<string, unknown>;
  const ownVersion =
    typeof record.uses === "string" && record.uses.startsWith("actions/setup-node@")
      ? [getRecord(record.with)["node-version"]]
      : [];

  return ownVersion.concat(Object.values(record).flatMap((entry) => collectSetupNodeVersions(entry)));
}

describe("desktop CI/CD", () => {
  test("pins the audited CloakBrowser wrapper exactly in package metadata", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
    };
    const packageLock = JSON.parse(await readFile(packageLockPath, "utf8")) as {
      packages?: Record<string, { version?: string; dependencies?: Record<string, string> }>;
    };
    const auditedVersion = "0.3.30";

    expect(packageJson.dependencies?.cloakbrowser).toBe(auditedVersion);
    expect(packageLock.packages?.[""]?.dependencies?.cloakbrowser).toBe(auditedVersion);
    expect(packageLock.packages?.["node_modules/cloakbrowser"]?.version).toBe(auditedVersion);
  });

  test("runs GitHub Actions quality gates on Node.js 24", async () => {
    const workflows = [
      await readYamlFile(ciWorkflowPath),
      await readYamlFile(releaseWorkflowPath),
      await readYamlFile(codeqlWorkflowPath),
    ];
    const nodeVersions = workflows.flatMap((workflow) => collectSetupNodeVersions(workflow));

    expect(nodeVersions).toHaveLength(4);
    expect(nodeVersions).toEqual(nodeVersions.map(() => 24));
  });

  test("checks main and pull requests without producing release artifacts", async () => {
    const workflow = await readYamlFile(ciWorkflowPath);
    const triggers = getWorkflowTriggers(workflow);
    const push = getRecord(triggers.push);
    const pullRequest = getRecord(triggers.pull_request);
    const jobs = getRecord(workflow.jobs);
    const quality = getRecord(jobs.quality);
    const steps = getArray(quality.steps).map((step) => getRecord(step));
    const runCommands = steps.map((step) => step.run).filter(Boolean);

    expect(getArray(push.branches)).toContain("main");
    expect(getArray(pullRequest.branches)).toContain("main");
    expect(runCommands).toEqual(expect.arrayContaining(["npm ci", "npx tsc --noEmit", "npm test", "npm run build"]));
    expect(jobs).not.toHaveProperty("package");
    expect(jobs).not.toHaveProperty("publish");
  });

  test("runs governed desktop releases only from tags or manual dispatch", async () => {
    const workflow = await readYamlFile(releaseWorkflowPath);
    const triggers = getWorkflowTriggers(workflow);
    const push = getRecord(triggers.push);
    const jobs = getRecord(workflow.jobs);
    const quality = getRecord(jobs.quality);
    const packageJob = getRecord(jobs.package);
    const publish = getRecord(jobs.publish);
    const permissions = getRecord(workflow.permissions);
    const steps = getArray(quality.steps).map((step) => getRecord(step));
    const runCommands = steps.map((step) => step.run).filter(Boolean);

    expect(getArray(push.tags)).toContain("v*");
    expect(push).not.toHaveProperty("branches");
    expect(triggers).toHaveProperty("workflow_dispatch");
    expect(packageJob.environment).toBe("internal-release");
    expect(publish.environment).toBe("internal-release");
    expect(permissions.contents).toBe("write");
    expect(permissions["id-token"]).toBe("write");
    expect(permissions.attestations).toBe("write");
    expect(quality["runs-on"]).toBe("ubuntu-latest");
    expect(runCommands).toContain("npm ci");
    expect(runCommands).toContain("npx tsc --noEmit");
    expect(runCommands).toContain("npm test");
  });

  test("packages macOS, Windows, and Ubuntu/Linux artifacts", async () => {
    const workflow = await readYamlFile(releaseWorkflowPath);
    const jobs = getRecord(workflow.jobs);
    const packageJob = getRecord(jobs.package);
    const strategy = getRecord(packageJob.strategy);
    const matrix = getRecord(strategy.matrix);
    const include = getArray(matrix.include).map((entry) => getRecord(entry));
    const packageScripts = include.map((entry) => entry.package_script);
    const runners = include.map((entry) => entry.os);
    const artifactNames = include.map((entry) => entry.artifact_name);
    const steps = getArray(packageJob.steps).map((step) => getRecord(step));
    const uploadStep = steps.find((step) => typeof step.uses === "string" && step.uses.includes("actions/upload-artifact@"));
    const uploadWith = getRecord(uploadStep?.with);

    expect(packageJob.needs).toBe("quality");
    expect(runners).toEqual(expect.arrayContaining(["macos-latest", "windows-latest", "ubuntu-latest"]));
    expect(packageScripts).toEqual(
      expect.arrayContaining(["electron:pack:mac", "electron:pack:win", "electron:pack:linux"]),
    );
    expect(artifactNames).toEqual(
      expect.arrayContaining(["automation-app-macos", "automation-app-windows", "automation-app-ubuntu-linux"]),
    );
    expect(steps.some((step) => typeof step.uses === "string" && step.uses.includes("actions/upload-artifact@"))).toBe(
      true,
    );
    expect(uploadWith.path).toContain("!release/*-unpacked/**");
  });

  test("release artifacts include checksums, SBOM, provenance attestation, and GitHub release publishing", async () => {
    const workflow = await readYamlFile(releaseWorkflowPath);
    const jobs = getRecord(workflow.jobs);
    const packageJob = getRecord(jobs.package);
    const publish = getRecord(jobs.publish);
    const packageSteps = getArray(packageJob.steps).map((step) => getRecord(step));
    const publishSteps = getArray(publish.steps).map((step) => getRecord(step));
    const packageRuns = packageSteps.map((step) => step.run).filter(Boolean);
    const publishRuns = publishSteps.map((step) => step.run).filter(Boolean);

    expect(packageRuns).toContain("npm run release:sbom");
    expect(packageRuns).toContain("npm run release:manifest");
    expect(
      packageSteps.some((step) => typeof step.uses === "string" && step.uses.includes("actions/attest-build-provenance@")),
    ).toBe(true);
    expect(packageSteps.some((step) => typeof step.uses === "string" && step.uses.includes("actions/attest-sbom@"))).toBe(
      true,
    );
    expect(publishSteps.some((step) => typeof step.uses === "string" && step.uses.includes("actions/download-artifact@"))).toBe(
      true,
    );
    expect(publishRuns.some((command) => typeof command === "string" && command.includes("gh release create"))).toBe(true);
    expect(publishRuns.some((command) => typeof command === "string" && command.includes("gh release upload"))).toBe(true);
  });

  test("uses OS-specific attestation subjects so missing platform files do not fail packaging", async () => {
    const workflow = await readYamlFile(releaseWorkflowPath);
    const jobs = getRecord(workflow.jobs);
    const packageJob = getRecord(jobs.package);
    const strategy = getRecord(packageJob.strategy);
    const matrix = getRecord(strategy.matrix);
    const include = getArray(matrix.include).map((entry) => getRecord(entry));
    const mac = getRecord(include.find((entry) => entry.label === "macOS"));
    const windows = getRecord(include.find((entry) => entry.label === "Windows"));
    const linux = getRecord(include.find((entry) => entry.label === "Ubuntu Linux"));
    const steps = getArray(packageJob.steps).map((step) => getRecord(step));
    const provenanceStep = getRecord(
      steps.find((step) => typeof step.uses === "string" && step.uses.includes("actions/attest-build-provenance@")),
    );
    const sbomStep = getRecord(steps.find((step) => typeof step.uses === "string" && step.uses.includes("actions/attest-sbom@")));

    expect(mac.release_subject_paths).toContain("release/*.dmg");
    expect(mac.release_subject_paths).not.toContain("release/*.deb");
    expect(mac.release_subject_paths).not.toContain("release/*.exe");
    expect(windows.release_subject_paths).toContain("release/*.exe");
    expect(windows.release_subject_paths).not.toContain("release/*.dmg");
    expect(windows.release_subject_paths).not.toContain("release/*.AppImage");
    expect(linux.release_subject_paths).toContain("release/*.AppImage");
    expect(linux.release_subject_paths).toContain("release/*.deb");
    expect(linux.release_subject_paths).toContain("release/*.tar.gz");
    expect(getRecord(provenanceStep.with)["subject-path"]).toBe("${{ matrix.release_subject_paths }}");
    expect(getRecord(sbomStep.with)["subject-path"]).toBe("${{ matrix.artifact_subject_paths }}");
  });

  test("does not block macOS or Windows packaging when signing secrets are absent", async () => {
    const workflow = await readYamlFile(releaseWorkflowPath);
    const jobs = getRecord(workflow.jobs);
    const packageJob = getRecord(jobs.package);
    const steps = getArray(packageJob.steps).map((step) => getRecord(step));
    const stepNames = steps.map((step) => step.name);
    const runCommands = steps.map((step) => step.run).filter(Boolean);
    const packageStep = getRecord(steps.find((step) => step.name === "Package desktop app"));

    expect(stepNames).not.toContain("Validate signing secrets");
    expect(stepNames).toContain("Configure optional signing environment");
    expect(runCommands.join("\n")).not.toContain("test -n \"$MAC_CSC_LINK\"");
    expect(runCommands.join("\n")).not.toContain("test -n \"$WIN_CSC_LINK\"");
    expect(packageStep).not.toHaveProperty("env");
  });

  test("pins every GitHub Action to an immutable commit SHA", async () => {
    const workflows = [
      await readYamlFile(ciWorkflowPath),
      await readYamlFile(releaseWorkflowPath),
      await readYamlFile(codeqlWorkflowPath),
    ];

    for (const action of workflows.flatMap((workflow) => collectUses(workflow))) {
      expect(action).toMatch(/@[a-f0-9]{40}$/);
    }
  });

  test("adds CodeQL and Dependabot security automation", async () => {
    const codeql = await readYamlFile(codeqlWorkflowPath);
    const dependabot = await readYamlFile(dependabotPath);
    const codeqlUses = collectUses(codeql);
    const updates = getArray(dependabot.updates).map((entry) => getRecord(entry));

    expect(codeqlUses.some((action) => action.startsWith("github/codeql-action/init@"))).toBe(true);
    expect(codeqlUses.some((action) => action.startsWith("github/codeql-action/analyze@"))).toBe(true);
    expect(updates.map((entry) => entry["package-ecosystem"])).toEqual(expect.arrayContaining(["npm", "github-actions"]));
  });

  test("keeps CloakBrowser out of grouped Dependabot churn and documents its upgrade gate", async () => {
    const dependabot = await readYamlFile(dependabotPath);
    const updates = getArray(dependabot.updates).map((entry) => getRecord(entry));
    const npmUpdate = updates.find((entry) => entry["package-ecosystem"] === "npm");
    expect(npmUpdate).toBeDefined();
    const groups = getRecord(npmUpdate?.groups);
    const minorPatchGroup = getRecord(groups["npm-minor-and-patch"]);
    const excludePatterns = getArray(minorPatchGroup["exclude-patterns"]);
    const releaseGovernance = await readFile(releaseGovernancePath, "utf8");

    expect(excludePatterns).toContain("cloakbrowser");
    expect(releaseGovernance).toContain("CloakBrowser upgrade gate");
    expect(releaseGovernance).toContain("browser identity");
    expect(releaseGovernance).toContain("owned staging smoke");
    expect(releaseGovernance).toContain("run evidence comparison");
    expect(releaseGovernance).toContain("rollback");
  });

  test("documents required repository governance settings", async () => {
    const source = await readFile(releaseGovernancePath, "utf8");

    expect(source).toContain("branch protection");
    expect(source).toContain("required status checks");
    expect(source).toContain("internal-release");
    expect(source).toContain("required reviewers");
    expect(source).toContain("secret scanning");
    expect(source).toContain("push protection");
    expect(source).toContain("APPLE_ID");
    expect(source).toContain("CSC_LINK");
  });

  test("declares electron-builder package targets for every supported desktop OS", async () => {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
      author?: string | { name?: string; email?: string };
      scripts: Record<string, string>;
      build: {
        mac?: { hardenedRuntime?: boolean; target?: string[] };
        win?: { target?: string[] };
        linux?: { target?: string[]; maintainer?: string };
      };
    };

    expect(packageJson.scripts["electron:pack:mac"]).toContain("--mac");
    expect(packageJson.scripts["electron:pack:win"]).toContain("--win");
    expect(packageJson.scripts["electron:pack:linux"]).toContain("--linux");
    expect(packageJson.scripts["release:sbom"]).toContain("generate-release-sbom.mjs");
    expect(packageJson.scripts["release:manifest"]).toContain("generate-release-manifest.mjs");
    expect(packageJson.scripts.deploy).toBe("node scripts/deploy-release.mjs");
    expect(packageJson.build.mac?.target).toEqual(expect.arrayContaining(["dmg", "zip"]));
    expect(packageJson.build.mac?.hardenedRuntime).toBe(true);
    expect(packageJson.build.win?.target).toEqual(expect.arrayContaining(["nsis", "zip"]));
    expect(packageJson.build.linux?.target).toEqual(expect.arrayContaining(["AppImage", "deb", "tar.gz"]));
    expect(packageJson.build.linux?.maintainer ?? packageJson.author).toBeTruthy();
  });

  test("derives preload IPC channels instead of duplicating runtime string maps", async () => {
    const source = await readFile(preloadPath, "utf8");

    expect(source).not.toContain("const workflowIpcChannels = {");
    expect(source).not.toMatch(/["']workflow:/);
    expect(source).toContain("workflowChannel");
    expect(source).toContain("keyof typeof mainWorkflowIpcChannels");
  });

  test("keeps Electron backend files grouped by ownership", async () => {
    const entries = await readdir(backendDir, { withFileTypes: true });
    const topLevelFiles = entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
    const topLevelDirectories = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

    expect(topLevelFiles).toEqual(["commands.test.ts", "commands.ts"]);
    expect(topLevelDirectories).toEqual(
      expect.arrayContaining(["actions", "browser", "evidence", "graph", "persistence", "runtime", "scheduling", "services"]),
    );
  });

  test("generates a reproducible checksum manifest for release files", async () => {
    const releaseDir = await mkdtemp(path.join(os.tmpdir(), "automation-release-"));
    const filePath = path.join(releaseDir, "Automation App-0.1.0-linux-x64.tar.gz");
    const contents = "release artifact";

    await writeFile(filePath, contents);
    await execFileAsync("node", [releaseManifestScriptPath, releaseDir], { cwd: currentDir });

    const expectedHash = createHash("sha256").update(contents).digest("hex");
    const checksums = await readFile(path.join(releaseDir, "SHA256SUMS"), "utf8");
    const manifest = JSON.parse(await readFile(path.join(releaseDir, "release-manifest.json"), "utf8")) as {
      generated_at: string;
      reproducible_epoch: string;
      artifacts: Array<{ name: string; sha256: string; size: number }>;
    };

    expect(checksums).toContain(`${expectedHash}  Automation App-0.1.0-linux-x64.tar.gz`);
    expect(manifest.generated_at).not.toBe(new Date(0).toISOString());
    expect(manifest.reproducible_epoch).toBe(new Date(0).toISOString());
    expect(manifest.artifacts).toEqual([
      { name: "Automation App-0.1.0-linux-x64.tar.gz", sha256: expectedHash, size: contents.length },
    ]);
  });

  test("runs npm sbom through Node on Windows instead of spawning the npm.cmd shim", async () => {
    const { createNpmSbomCommand } = (await import(pathToFileURL(releaseSbomScriptPath).href)) as {
      createNpmSbomCommand: (context: {
        platform: NodeJS.Platform;
        env: NodeJS.ProcessEnv;
        execPath: string;
      }) => {
        command: string;
        args: string[];
        options: { shell?: boolean };
      };
    };
    const npmExecPath = String.raw`C:\hostedtoolcache\windows\node\24.15.0\x64\node_modules\npm\bin\npm-cli.js`;
    const nodeExecPath = String.raw`C:\hostedtoolcache\windows\node\24.15.0\x64\node.exe`;

    const command = createNpmSbomCommand({
      platform: "win32",
      env: { npm_execpath: npmExecPath, npm_node_execpath: nodeExecPath },
      execPath: "node",
    });

    expect(command).toEqual({
      command: nodeExecPath,
      args: [npmExecPath, "sbom", "--sbom-format", "cyclonedx", "--omit", "dev"],
      options: {},
    });
  });
});
