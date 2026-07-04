// @vitest-environment node

import { describe, expect, test } from "vitest";
import { WorkflowRepository } from "./workflowRepository.js";
import { ProjectRepository } from "./projectRepository.js";
import { SubflowRepository } from "./subflowRepository.js";
import { IdentityRepository } from "../identity/identityRepository.js";
import { OperationsRepository } from "../operations/operationsRepository.js";
import { RunManager } from "../runtime/runManager.js";
import { WorkflowScheduleRepository } from "../scheduling/workflowScheduleRepository.js";
import type { DbAdapter } from "./dbAdapter.js";

const mockDbAdapter = {
  query: async () => [],
  execute: async () => ({ changes: 0 }),
  queryOne: async () => null,
  transaction: async (fn: any) => fn(mockDbAdapter),
  ownerId: null,
} as unknown as DbAdapter;

describe("Repositories instantiation with null ownerId", () => {
  test("WorkflowRepository can be instantiated when ownerId is null", () => {
    const repo = new WorkflowRepository(mockDbAdapter);
    expect(repo).toBeDefined();
  });

  test("ProjectRepository can be instantiated when ownerId is null", () => {
    const repo = new ProjectRepository(mockDbAdapter);
    expect(repo).toBeDefined();
  });

  test("SubflowRepository can be instantiated when ownerId is null", () => {
    const repo = new SubflowRepository(mockDbAdapter);
    expect(repo).toBeDefined();
  });

  test("IdentityRepository can be instantiated when ownerId is null", () => {
    const repo = new IdentityRepository({
      database: mockDbAdapter,
      workflows: async () => [],
      settingsForWorkflow: async () => ({} as any),
      diagnostics: async () => ({} as any),
      runner: {} as any,
    });
    expect(repo).toBeDefined();
  });

  test("OperationsRepository can be instantiated when ownerId is null", () => {
    const repo = new OperationsRepository(mockDbAdapter);
    expect(repo).toBeDefined();
  });

  test("RunManager can be instantiated when ownerId is null", () => {
    const manager = new RunManager({
      database: mockDbAdapter,
      runner: {} as any,
    });
    expect(manager).toBeDefined();
  });

  test("WorkflowScheduleRepository can be instantiated when ownerId is null", () => {
    const repo = new WorkflowScheduleRepository(mockDbAdapter);
    expect(repo).toBeDefined();
  });
});
