import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";

const validBumps = new Set(["patch", "minor", "major"]);
const coAuthorTrailer = "Co-Authored-By: Codex <codex@openai.com>";

function usage() {
  return [
    "Usage: npm run deploy -- [--patch|--minor|--major] [--dry-run] [--skip-checks] [--remote <name>]",
    "",
    "Creates a version bump commit, creates a v* tag, pushes the branch, then pushes the tag.",
    "The release workflow runs from the pushed tag.",
  ].join("\n");
}

export function parseDeployArgs(argv) {
  const options = {
    bump: "patch",
    dryRun: false,
    skipChecks: false,
    remote: "origin",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      return { ...options, help: true };
    }

    if (arg === "--dry-run") {
      options.dryRun = true;
      continue;
    }

    if (arg === "--skip-checks") {
      options.skipChecks = true;
      continue;
    }

    if (arg === "--patch" || arg === "--minor" || arg === "--major") {
      options.bump = arg.slice(2);
      continue;
    }

    if (arg === "--remote") {
      const remote = argv[index + 1];
      if (!remote || remote.startsWith("-")) {
        throw new Error("--remote requires a remote name.");
      }
      options.remote = remote;
      index += 1;
      continue;
    }

    throw new Error(`Unknown deploy option: ${arg}`);
  }

  return options;
}

export function bumpVersion(version, bump) {
  if (!validBumps.has(bump)) {
    throw new Error(`Unsupported version bump: ${bump}`);
  }

  const parts = version.split(".").map((part) => Number(part));
  if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
    throw new Error(`Expected a semver version like 1.2.3, got ${version}`);
  }

  const [major, minor, patch] = parts;
  if (bump === "major") return `${major + 1}.0.0`;
  if (bump === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

export function buildReleasePlan({
  currentVersion,
  bump,
  branch,
  remote,
  skipChecks,
}) {
  const nextVersion = bumpVersion(currentVersion, bump);
  const tagName = `v${nextVersion}`;
  const commitMessage = [
    `chore: bump project version to ${nextVersion}`,
    "",
    coAuthorTrailer,
  ].join("\n");
  const commands = [];

  if (!skipChecks) {
    commands.push(
      { label: "Run tests", command: "npm", args: ["test"] },
      { label: "Build app", command: "npm", args: ["run", "build"] },
    );
  }

  commands.push(
    {
      label: "Bump package version",
      command: "npm",
      args: ["version", nextVersion, "--no-git-tag-version"],
    },
    {
      label: "Stage version files",
      command: "git",
      args: ["add", "package.json", "package-lock.json"],
    },
    {
      label: "Commit version bump",
      command: "git",
      args: ["commit", "-m", commitMessage],
    },
    {
      label: "Create release tag",
      command: "git",
      args: ["tag", tagName],
    },
    {
      label: "Push branch",
      command: "git",
      args: ["push", remote, branch],
    },
    {
      label: "Push tag",
      command: "git",
      args: ["push", remote, tagName],
    },
  );

  return { nextVersion, tagName, commitMessage, commands };
}

async function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      shell: false,
    });
    let stdout = "";
    let stderr = "";

    if (child.stdout) {
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
    }
    if (child.stderr) {
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}${stderr ? `\n${stderr}` : ""}`));
    });
  });
}

async function readPackageVersion() {
  const packageJson = JSON.parse(await readFile("package.json", "utf8"));
  if (typeof packageJson.version !== "string") {
    throw new Error("package.json must contain a string version.");
  }
  return packageJson.version;
}

async function getCurrentBranch() {
  const { stdout } = await run("git", ["branch", "--show-current"], { capture: true });
  const branch = stdout.trim();
  if (!branch) {
    throw new Error("Cannot deploy from a detached HEAD. Check out a branch first.");
  }
  return branch;
}

async function assertCleanWorktree() {
  const { stdout } = await run("git", ["status", "--porcelain"], { capture: true });
  if (stdout.trim()) {
    throw new Error("Worktree is not clean. Commit or stash changes before running deploy.");
  }
}

async function assertTagDoesNotExist(tagName, remote) {
  const local = await run("git", ["tag", "--list", tagName], { capture: true });
  if (local.stdout.trim()) {
    throw new Error(`Tag ${tagName} already exists locally.`);
  }

  const remoteTag = await run("git", ["ls-remote", "--tags", remote, tagName], { capture: true });
  if (remoteTag.stdout.trim()) {
    throw new Error(`Tag ${tagName} already exists on ${remote}.`);
  }
}

async function main(argv) {
  const options = parseDeployArgs(argv);
  if (options.help) {
    console.log(usage());
    return;
  }

  await run("git", ["rev-parse", "--is-inside-work-tree"], { capture: true });
  if (!options.dryRun) {
    await assertCleanWorktree();
  }

  const currentVersion = await readPackageVersion();
  const branch = await getCurrentBranch();
  const plan = buildReleasePlan({
    currentVersion,
    bump: options.bump,
    branch,
    remote: options.remote,
    skipChecks: options.skipChecks,
  });

  await assertTagDoesNotExist(plan.tagName, options.remote);

  console.log(`Deploy release ${plan.tagName} from ${branch} to ${options.remote}.`);
  for (const item of plan.commands) {
    console.log(`- ${item.label}: ${item.command} ${item.args.join(" ")}`);
  }

  if (options.dryRun) {
    console.log("Dry run only. No commands were executed.");
    return;
  }

  for (const item of plan.commands) {
    console.log(`\n> ${item.label}`);
    await run(item.command, item.args);
  }

  console.log(`\nRelease ${plan.tagName} pushed. GitHub Actions will build and publish the release.`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
