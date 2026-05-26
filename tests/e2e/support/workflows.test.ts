import fs from "node:fs";
import path from "node:path";
import { describe, expect, test } from "vitest";
import { e2eWorkflowRuntimeOverrides } from "./workflows";

const packageJson = JSON.parse(
  fs.readFileSync(path.join(process.cwd(), "package.json"), "utf8"),
) as { scripts: Record<string, string> };

describe("E2E workflow runtime overrides", () => {
  test("keeps the default full E2E lane headless and auto-closing", () => {
    expect(e2eWorkflowRuntimeOverrides({})).toEqual({
      browserRetention: "close",
      headless: true,
      observeAfterRunMs: 0,
    });
  });

  test("shows and retains the workflow browser in visible E2E mode", () => {
    expect(e2eWorkflowRuntimeOverrides({ E2E_VISIBLE_BROWSER: "1" })).toEqual({
      browserRetention: "retain",
      headless: false,
      observeAfterRunMs: 1500,
    });
  });

  test("allows the visible-mode observation pause to be overridden", () => {
    expect(
      e2eWorkflowRuntimeOverrides({
        E2E_VISIBLE_BROWSER: "true",
        E2E_OBSERVE_MS: "3000",
      }),
    ).toMatchObject({
      observeAfterRunMs: 3000,
    });
  });

  test("runs only browser-observable suites in visible E2E mode", () => {
    const script = packageJson.scripts["test:e2e:visible"];

    expect(script).toContain("E2E_VISIBLE_BROWSER=1");
    expect(script).toContain("--headed");

    for (const file of [
      "tests/e2e/browser-context-storage.e2e.ts",
      "tests/e2e/capture-network.e2e.ts",
      "tests/e2e/core-execution.e2e.ts",
      "tests/e2e/extended-form-actions.e2e.ts",
      "tests/e2e/keyboard-dialog.e2e.ts",
      "tests/e2e/navigation-actions.e2e.ts",
      "tests/e2e/pointer-actions.e2e.ts",
      "tests/e2e/wait-assertion-actions.e2e.ts",
    ]) {
      expect(script, `${file} should be visible-browser runnable`).toContain(file);
    }

    for (const file of [
      "tests/e2e/coverage-matrix.e2e.ts",
      "tests/e2e/electron-isolation.e2e.ts",
      "tests/e2e/workflow-package.e2e.ts",
      "tests/e2e/workflow-user-journeys.e2e.ts",
    ]) {
      expect(script, `${file} should stay out of the default visible browser lane`)
        .not.toContain(file);
    }
  });

  test("does not expose an owned-staging E2E lane without configured targets", () => {
    expect(packageJson.scripts["test:e2e:staging"]).toBeUndefined();
    expect(packageJson.scripts["test:e2e:staging:preflight"]).toBeUndefined();
  });
});
