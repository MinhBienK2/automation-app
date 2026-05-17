import { describe, expect, test } from "vitest";
import {
  buildReleasePlan,
  bumpVersion,
  parseDeployArgs,
} from "./deploy-release.mjs";

describe("deploy release script", () => {
  test("bumps patch versions by default", () => {
    expect(bumpVersion("0.1.2", "patch")).toBe("0.1.3");
    expect(bumpVersion("0.1.2", "minor")).toBe("0.2.0");
    expect(bumpVersion("0.1.2", "major")).toBe("1.0.0");
  });

  test("parses deploy flags", () => {
    expect(parseDeployArgs([])).toEqual({
      bump: "patch",
      dryRun: false,
      skipChecks: false,
      remote: "origin",
    });
    expect(parseDeployArgs(["--minor", "--dry-run", "--skip-checks", "--remote", "upstream"])).toEqual({
      bump: "minor",
      dryRun: true,
      skipChecks: true,
      remote: "upstream",
    });
  });

  test("builds a guarded release command plan", () => {
    const plan = buildReleasePlan({
      currentVersion: "0.1.2",
      bump: "patch",
      branch: "main",
      remote: "origin",
      skipChecks: false,
    });

    expect(plan.nextVersion).toBe("0.1.3");
    expect(plan.tagName).toBe("v0.1.3");
    expect(plan.commitMessage).toContain("chore: bump project version to 0.1.3");
    expect(plan.commands.map((command) => command.label)).toEqual([
      "Run tests",
      "Build app",
      "Bump package version",
      "Stage version files",
      "Commit version bump",
      "Create release tag",
      "Push branch",
      "Push tag",
    ]);
    expect(plan.commands.at(-1)).toMatchObject({
      command: "git",
      args: ["push", "origin", "v0.1.3"],
    });
  });
});
