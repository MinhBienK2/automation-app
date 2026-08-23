import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach } from "vitest";
import { defaultWorkflowSettings } from "../commands.js";
import { createAppPaths } from "../db/database.js";
import type { WorkflowSettings } from "../../../src/types/workflow.js";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

export async function createTempAppPaths() {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-app-"));
  tempRoots.push(tempRoot);
  return createAppPaths(tempRoot);
}

export function makeSettings(
  overrides: {
    browser_launch?: Partial<WorkflowSettings["browser_launch"]>;
    environment?: Partial<WorkflowSettings["environment"]>;
    run_policy?: Partial<WorkflowSettings["run_policy"]>;
  } = {},
): WorkflowSettings {
  const base = defaultWorkflowSettings({
    id: "workflow-1",
    name: "Fixture",
    step_count: 0,
    created_at: "2026-05-09T00:00:00.000Z",
    updated_at: "2026-05-09T00:00:00.000Z",
  });
  return {
    ...base,
    browser_launch: { ...base.browser_launch, ...overrides.browser_launch },
    environment: { ...base.environment, ...overrides.environment },
    run_policy: { ...base.run_policy, ...overrides.run_policy },
  };
}
