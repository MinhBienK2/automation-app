// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createWorkflowCommandHandlers,
  serializeCommandError,
} from "./commands";
import {
  createAppPaths,
  initializeDatabase,
  type AppPaths,
} from "./database";
import type {
  CompiledWorkflowGraph,
  RunState,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowSettings,
} from "../../src/types/workflow";

vi.mock("electron", () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("Electron workflow command handlers", () => {
  test("persists workflow CRUD, graph, and settings in SQLite", async () => {
    const { handlers, database } = await createTestHandlers();

    const created = handlers.createWorkflow("Login flow");
    const row = database
      .prepare("SELECT id, name, graph_json, settings_json FROM workflows WHERE id = ?")
      .get(created.id) as
      | {
          id: string;
          name: string;
          graph_json: string;
          settings_json: string | null;
        }
      | undefined;

    expect(row).toMatchObject({
      id: created.id,
      name: "Login flow",
    });
    expect(JSON.parse(row?.graph_json ?? "{}")).toMatchObject({
      version: 2,
      nodes: expect.arrayContaining([
        expect.objectContaining({ id: "start", node_type: "start" }),
        expect.objectContaining({ id: "new-node", node_type: "action" }),
      ]),
    });

    const graph: WorkflowGraph = {
      version: 1,
      nodes: [],
      edges: [],
      viewport: { x: 10, y: 20, zoom: 1.5 },
    };
    handlers.saveWorkflowGraph(created.id, graph);
    expect(handlers.getWorkflowGraph(created.id)).toMatchObject({
      ...graph,
      version: 2,
    });

    const settings = handlers.getWorkflowSettings(created.id);
    const saved = handlers.saveWorkflowSettings(created.id, {
      ...settings,
      general: {
        ...settings.general,
        name: "Renamed flow",
        tags: ["qa"],
      },
    });

    expect(saved.general.name).toBe("Renamed flow");
    expect(handlers.listWorkflows()[0]).toMatchObject({
      id: created.id,
      name: "Renamed flow",
      step_count: 0,
    });
    expect(
      database
        .prepare("SELECT settings_json FROM workflows WHERE id = ?")
        .get(created.id),
    ).toMatchObject({
      settings_json: expect.stringContaining("Renamed flow"),
    });

    handlers.deleteWorkflow(created.id);
    expect(handlers.getWorkflow(created.id)).toBeNull();
  });

  test("migrates legacy workflow graphs on load and persists the upgraded action contract", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Legacy graph");
    const legacyGraph: WorkflowGraph = {
      version: 1,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: null,
          ports: [{ id: "out", label: "Out", direction: "output" }],
        },
        {
          id: "click-submit",
          node_type: "action",
          label: "Click Submit",
          position: { x: 200, y: 0 },
          config: {
            type: "click",
            config: {
              xpath: "//*[@id='submit']",
              timeout_ms: 5000,
              wait_until: "clickable",
            },
          },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    database
      .prepare("UPDATE workflows SET graph_json = ? WHERE id = ?")
      .run(JSON.stringify(legacyGraph), workflow.id);

    const migrated = handlers.getWorkflowGraph(workflow.id);

    expect(migrated).toMatchObject({
      version: 2,
      nodes: [
        expect.any(Object),
        expect.objectContaining({
          config: {
            type: "click",
            config: {
              target: {
                locators: [{ kind: "xpath", value: "//*[@id='submit']" }],
              },
            },
          },
        }),
      ],
      migration_notes: expect.arrayContaining([
        expect.objectContaining({ path: "nodes.click-submit.config.xpath", action: "converted" }),
        expect.objectContaining({ path: "nodes.click-submit.config.timeout_ms", action: "dropped" }),
      ]),
    });
    const persisted = JSON.parse(
      String(
        (
          database
            .prepare("SELECT graph_json FROM workflows WHERE id = ?")
            .get(workflow.id) as { graph_json: string }
        ).graph_json,
      ),
    );
    expect(persisted.version).toBe(2);
    expect(persisted.nodes[1].config.config).not.toHaveProperty("xpath");
    expect(persisted.nodes[1].config.config).not.toHaveProperty("timeout_ms");
  });

  test("validates settings and maps browser config through simplified launch section", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Browser flow");

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        general: {
          ...handlers.getWorkflowSettings(workflow.id).general,
          name: " ",
        },
      }),
    ).toEqual([
      expect.objectContaining({
        section: "general",
        field: "name",
        level: "error",
      }),
    ]);

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          proxy_enabled: true,
          proxy_server: null,
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "proxy_server",
        level: "error",
      }),
    );

    handlers.saveWorkflowBrowserConfig(workflow.id, {
      workflow_id: workflow.id,
      profile_name: "qa-profile",
      proxy_enabled: true,
      proxy_server: "http://proxy.local:8080",
      proxy_username: "agent",
      proxy_password: "secret",
      headless: false,
    });

    expect(handlers.getWorkflowSettings(workflow.id).browser_launch).toMatchObject({
      session_mode: "persistent_profile",
      profile_name: "qa-profile",
      proxy_enabled: true,
      proxy_server: "http://proxy.local:8080",
      proxy_password: "secret",
    });
  });

  test("validates run policy numeric ranges and ignores legacy fingerprint gate settings", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Settings validation");
    const settings = handlers.getWorkflowSettings(workflow.id);

    expect(settings).not.toHaveProperty("owned_test_gates");

    expect(
      handlers.validateWorkflowSettings({
        ...settings,
        run_policy: {
          ...settings.run_policy,
          batch_concurrency_limit: 0,
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "run_policy",
          field: "batch_concurrency_limit",
          level: "error",
        }),
      ]),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...settings,
        owned_test_gates: {
          fingerprint_preflight_enabled: true,
          fingerprint_probe_url: "https://probe.owned.test/verdict",
          fingerprint_profile_id: "",
          fingerprint_allowed_origins: ["https://other.owned.test"],
        },
      } as WorkflowSettings),
    ).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          section: "owned_test_gates",
        }),
      ]),
    );

    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      owned_test_gates: {
        fingerprint_preflight_enabled: true,
        fingerprint_probe_url: "https://probe.owned.test/verdict",
        fingerprint_profile_id: "owned-profile",
        fingerprint_allowed_origins: ["https://probe.owned.test"],
      },
    } as WorkflowSettings);
    expect(handlers.getWorkflowSettings(workflow.id)).not.toHaveProperty("owned_test_gates");
    expect(handlers.getWorkflowSettings(workflow.id).migration_notes).toContainEqual(
      expect.objectContaining({
        path: "owned_test_gates",
        action: "dropped",
      }),
    );
  });

  test("exports sanitized packages and imports selected flow/settings as a new workflow", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Export me");
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        proxy_password: "secret",
      },
    });

    const packageValue = handlers.exportWorkflowPackage(workflow.id, {
      include_flow: true,
      settings_sections: ["general", "browser_launch", "environment"],
    });

    expect(packageValue.settings?.browser_launch?.proxy_password).toBeNull();
    expect(packageValue.omitted_fields).toEqual(
      expect.arrayContaining(["settings.browser_launch.proxy_password"]),
    );
    expect(
      handlers.previewWorkflowPackage({
        ...packageValue,
        included_sections: ["settings.general", "settings.owned_test_gates"],
        settings: {
          ...packageValue.settings,
          owned_test_gates: {
            fingerprint_preflight_enabled: true,
            fingerprint_probe_url: "https://legacy.example.test/probe",
            fingerprint_profile_id: "legacy",
            fingerprint_allowed_origins: ["https://legacy.example.test"],
          },
        } as WorkflowPackage["settings"],
      }),
    ).toMatchObject({
      settings_sections: ["general"],
    });

    const importedPackage: WorkflowPackage = {
      ...packageValue,
      workflow: { name: "Imported package" },
      settings: {
        general: {
          name: "Imported package",
          description: "Shared",
          tags: ["imported"],
          notes: "",
        },
      },
    };
    const imported = handlers.importWorkflowPackage(importedPackage, {
      include_flow: true,
      settings_sections: ["general"],
    });

    expect(imported.workflow.name).toBe("Imported package (imported)");
    expect(handlers.getWorkflowSettings(imported.workflow.id).general).toMatchObject({
      name: "Imported package (imported)",
      description: "Shared",
      tags: ["imported"],
    });
  });

  test("rejects invalid workflow package imports without creating orphan workflows", async () => {
    const { handlers } = await createTestHandlers();
    const existing = handlers.createWorkflow("Existing");
    const baseSettings = handlers.getWorkflowSettings(existing.id);
    const initialCount = handlers.listWorkflows().length;
    const invalidSettingsPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Bad Settings" },
      included_sections: ["settings.browser_launch"],
      omitted_fields: [],
      flow: null,
      settings: {
        browser_launch: {
          ...baseSettings.browser_launch,
          proxy_enabled: true,
          proxy_server: null,
        },
      },
    };

    let settingsError: unknown;
    try {
      handlers.importWorkflowPackage(invalidSettingsPackage, {
        include_flow: false,
        settings_sections: ["browser_launch"],
      });
    } catch (error) {
      settingsError = error;
    }
    expect(settingsError).toMatchObject({
      field: "browser_launch.proxy_server",
    });
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const invalidFlowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Bad Flow" },
      included_sections: ["flow"],
      omitted_fields: [],
      flow: {
        version: 99,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      settings: null,
    };

    let flowError: unknown;
    try {
      handlers.importWorkflowPackage(invalidFlowPackage, {
        include_flow: true,
        settings_sections: [],
      });
    } catch (error) {
      flowError = error;
    }
    expect(flowError).toMatchObject({
      field: "package.flow",
    });
    expect(handlers.listWorkflows()).toHaveLength(initialCount);
  });

  test("serializes command errors with message and optional field", () => {
    expect(
      serializeCommandError({ message: "Name required", field: "name" }),
    ).toEqual({ message: "Name required", field: "name" });
    expect(serializeCommandError(new Error("Boom"))).toEqual({
      message: "Boom",
    });
  });

  test("dry-run validates action configs through backend validation", async () => {
    const { handlers } = await createTestHandlers();

    expect(() =>
      handlers.dryRunValidateConfig({
        type: "navigate",
        config: { url: " " },
      }),
    ).toThrow("URL is required");

    expect(() =>
      handlers.dryRunValidateConfig({
        type: "set_json_variables",
        config: { json: "[1,2,3]" },
      }),
    ).toThrow("JSON variables must be an object");
  });

  test("normalizes recorded events into structured target action configs", async () => {
    const { handlers } = await createTestHandlers();

    expect(
      handlers.normalizeRecordedEvents([
        { type: "click", xpath: "//*[@data-testid='save']" },
        { type: "input", xpath: "//*[@name='email']", text: "qa@example.test" },
      ]),
    ).toEqual([
      {
        type: "click",
        config: {
          target: {
            locators: [{ kind: "xpath", value: "//*[@data-testid='save']" }],
          },
        },
      },
      {
        type: "input_text",
        config: {
          target: {
            locators: [{ kind: "xpath", value: "//*[@name='email']" }],
          },
          text: "qa@example.test",
          clear_before_input: true,
        },
      },
    ]);
  });

  test("runs saved workflow graph through the Electron browser runner", async () => {
    const runnerCalls: Array<{
      graph: CompiledWorkflowGraph;
      settings: WorkflowSettings;
      mode: string;
    }> = [];
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: {
          graph: CompiledWorkflowGraph;
          settings: WorkflowSettings;
          mode: string;
        }): Promise<RunState> {
          runnerCalls.push(request);
          return {
            status: "success",
            mode: "run_workflow",
            target_step_id: null,
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: ["visit"],
            outputs: { title: "Fixture" },
            error: null,
          };
        },
      },
    });
    const workflow = handlers.createWorkflow("Runnable");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      environment: {
        ...settings.environment,
        initial_variables: [
          { name: "baseUrl", value_type: "text", value: "https://owned.test" },
        ],
      },
    });

    const result = await handlers.runWorkflow(workflow.id);

    expect(result).toMatchObject({
      status: "running",
      mode: "run_workflow",
    });
    expect(runnerCalls).toHaveLength(1);
    expect(runnerCalls[0]?.mode).toBe("run_workflow");
    expect(runnerCalls[0]?.settings.workflow_id).toBe(workflow.id);
    expect(runnerCalls[0]?.graph.steps).toEqual([
      expect.objectContaining({
        node_id: "__settings:inputs:variables",
        config: {
          type: "set_variable",
          config: {
            name: null,
            value: null,
            value_type: null,
            variables: [
              { name: "baseUrl", value_type: "text", value: "https://owned.test" },
            ],
          },
        },
      }),
      expect.objectContaining({
        node_id: "visit",
        config: {
          type: "navigate",
          config: {
            url: "https://owned.test",
          },
        },
      }),
    ]);
  });

  test("runs when IPC invokes command handlers without object binding", async () => {
    const runner = {
      run: vi.fn(async (): Promise<RunState> => ({
        status: "success",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["visit"],
        outputs: {},
        error: null,
      })),
    };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("Runnable through IPC");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const runWorkflow = handlers.runWorkflow;

    await expect(runWorkflow(workflow.id)).resolves.toMatchObject({
      status: "running",
      mode: "run_workflow",
    });
    expect(runner.run).toHaveBeenCalledOnce();
  });

  test("rejects graph runs with no executable graph steps before starting the runner", async () => {
    const runner = { run: vi.fn() };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("Draft");
    handlers.saveWorkflowGraph(workflow.id, startOnlyGraph());

    await expect(handlers.runWorkflow(workflow.id)).rejects.toMatchObject({
      message: "Workflow graph has no executable steps",
      field: "graph",
    });
    expect(runner.run).not.toHaveBeenCalled();
  });

  test("keeps one active run, exposes running state, and persists terminal evidence", async () => {
    let finishRun: ((state: RunState) => void) | null = null;
    let observedRunId: string | null | undefined = null;
    const { handlers, database } = await createTestHandlers({
      runner: {
        async run(request: { runId?: string | null }): Promise<RunState> {
          observedRunId = request.runId;
          return new Promise((resolve) => {
            finishRun = resolve;
          });
        },
      },
    });
    const workflow = handlers.createWorkflow("Lifecycle");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    await expect(handlers.runWorkflow(workflow.id)).resolves.toMatchObject({
      status: "running",
      mode: "run_workflow",
    });
    expect(handlers.getRunState()).toMatchObject({
      status: "running",
      mode: "run_workflow",
    });
    await expect(handlers.runWorkflow(workflow.id)).rejects.toMatchObject({
      message: "A workflow run is already active",
      field: "run",
    });

    finishRun?.({
      status: "success",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: ["visit"],
      outputs: {
        title: "Fixture",
        __evidence: [
          {
            run_id: observedRunId,
            node_id: "visit",
            step_number: 1,
            action_type: "navigate",
            artifact_kind: "screenshot",
            path: `runs/${observedRunId}/screenshots/001-visit-failure.png`,
          },
        ],
        __action_traces: [
          {
            node_id: "visit",
            action_type: "navigate",
            status: "success",
            mode: "browser",
          },
        ],
      },
      error: null,
    });

    await waitForRunStatus(handlers, "success");
    expect(handlers.getRunState()).toMatchObject({
      status: "success",
      completed_step_ids: ["visit"],
      outputs: { title: "Fixture" },
    });

    const runRows = database
      .prepare("SELECT id, workflow_id, status, outputs_json, error_json FROM runs")
      .all() as Array<Record<string, string | null>>;
    expect(runRows).toHaveLength(1);
    expect(runRows[0]).toMatchObject({
      id: observedRunId,
      workflow_id: workflow.id,
      status: "success",
      error_json: null,
    });
    expect(JSON.parse(runRows[0]?.outputs_json ?? "{}")).toMatchObject({
      title: "Fixture",
      __evidence: [
        expect.objectContaining({
          run_id: runRows[0]?.id,
          node_id: "visit",
          path: `runs/${runRows[0]?.id}/screenshots/001-visit-failure.png`,
        }),
      ],
    });

    const stepRows = database
      .prepare("SELECT node_id, step_number, action_type, status, trace_json FROM run_steps")
      .all() as Array<Record<string, string | number | null>>;
    expect(stepRows).toEqual([
      expect.objectContaining({
        node_id: "visit",
        step_number: 1,
        action_type: "navigate",
        status: "success",
      }),
    ]);
    expect(JSON.parse(String(stepRows[0]?.trace_json))).toMatchObject({
      node_id: "visit",
      action_type: "navigate",
    });
  });

  test("maps runner progress into getRunState while a run is active", async () => {
    let finishRun: ((state: RunState) => void) | null = null;
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: {
          onProgress?: (state: Partial<RunState>) => void;
        }): Promise<RunState> {
          request.onProgress?.({
            current_step_id: "visit",
            current_step_number: 1,
            completed_step_ids: [],
          });
          return new Promise((resolve) => {
            finishRun = resolve;
          });
        },
      },
    });
    const workflow = handlers.createWorkflow("Progress");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    await handlers.runWorkflow(workflow.id);

    expect(handlers.getRunState()).toMatchObject({
      status: "running",
      current_step_id: "visit",
      current_step_number: 1,
      completed_step_ids: [],
    });

    finishRun?.({
      status: "success",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: ["visit"],
      outputs: {},
      error: null,
    });
    await waitForRunStatus(handlers, "success");
  });

  test("fails an overlong run through max workflow duration timeout", async () => {
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: { signal?: AbortSignal }): Promise<RunState> {
          await new Promise<void>((resolve) => {
            request.signal?.addEventListener("abort", resolve, { once: true });
          });
          return {
            status: "stopped",
            mode: "run_workflow",
            target_step_id: null,
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: [],
            outputs: {},
            error: null,
          };
        },
      },
    });
    const workflow = handlers.createWorkflow("Timeout");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        max_workflow_duration_ms: 1,
      },
    });

    await expect(handlers.runWorkflow(workflow.id)).resolves.toMatchObject({
      status: "running",
      mode: "run_workflow",
    });
    const result = await waitForRunStatus(handlers, "failed");

    expect(result).toMatchObject({
      status: "failed",
      error: {
        reason: "Workflow exceeded maximum duration of 1 ms",
      },
    });
  });

  test("runs batch rows sequentially with row variables and stop-on-first-failed-row", async () => {
    const runnerCalls: CompiledWorkflowGraph[] = [];
    const runnerSettings: WorkflowSettings[] = [];
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: {
          graph: CompiledWorkflowGraph;
          settings: WorkflowSettings;
        }): Promise<RunState> {
          runnerCalls.push(request.graph);
          runnerSettings.push(request.settings);
          const rowIndex = runnerCalls.length - 1;
          return {
            status: rowIndex === 0 ? "success" : "failed",
            mode: "run_workflow",
            target_step_id: null,
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: rowIndex === 0 ? ["visit"] : [],
            outputs: rowIndex === 0 ? { ok: true } : {},
            error:
              rowIndex === 0
                ? null
                : {
                    step_id: "visit",
                    step_number: 1,
                    action_type: "navigate",
                    reason: "row failed",
                  },
          };
        },
      },
    });
    const workflow = handlers.createWorkflow("Batch");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        batch_stop_on_first_failed_row: true,
      },
      environment: {
        ...settings.environment,
        initial_variables: [
          { name: "fixture", value_type: "text", value: "batch" },
        ],
      },
    });

    await expect(
      handlers.runBatchWorkflow(workflow.id, {
        rows: [{ name: "A" }],
        concurrency_limit: 2,
      }),
    ).rejects.toMatchObject({
      field: "concurrency_limit",
    });

    const summary = await handlers.runBatchWorkflow(workflow.id, {
      rows: [{ name: "A" }, { name: "B" }, { name: "C" }],
    });

    expect(summary).toEqual({
      total: 3,
      succeeded: 1,
      failed: 1,
      results: [
        { row_index: 0, status: "success", error: null },
        { row_index: 1, status: "failed", error: "row failed" },
      ],
    });
    expect(runnerCalls).toHaveLength(2);
    expect(runnerSettings[0]?.run_policy.browser_retention).toBe("close");
    expect(runnerSettings[1]?.run_policy.browser_retention).toBe("close");
    expect(runnerCalls[0]?.steps[0]).toMatchObject({
      node_id: "batch-row-0",
      config: {
        type: "set_variable",
        config: {
          variables: [{ name: "name", value_type: "text", value: "A" }],
        },
      },
    });
    expect(runnerCalls[0]?.steps[1]).toMatchObject({
      node_id: "__settings:inputs:variables",
      config: {
        type: "set_variable",
        config: {
          variables: [{ name: "fixture", value_type: "text", value: "batch" }],
        },
      },
    });
    expect(runnerCalls[0]?.steps[2]).toMatchObject({
      node_id: "visit",
      config: {
        type: "navigate",
        config: { url: "https://owned.test" },
      },
    });
    expect(runnerCalls[1]?.steps[0]).toMatchObject({
      node_id: "batch-row-1",
      config: {
        type: "set_variable",
        config: {
          variables: [{ name: "name", value_type: "text", value: "B" }],
        },
      },
    });
  });

  test("keeps batch runs under the active run lifecycle and stops before the next row", async () => {
    let activeRunSignal: AbortSignal | null = null;
    const runnerCalls: CompiledWorkflowGraph[] = [];
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: {
          graph: CompiledWorkflowGraph;
          signal?: AbortSignal;
        }): Promise<RunState> {
          runnerCalls.push(request.graph);
          activeRunSignal = request.signal ?? null;
          await new Promise<void>((resolve) => {
            request.signal?.addEventListener("abort", resolve, { once: true });
          });
          return {
            status: "stopped",
            mode: "run_workflow",
            target_step_id: null,
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: [],
            outputs: {},
            error: null,
          };
        },
        async closeRetainedContext() {},
      },
    });
    const workflow = handlers.createWorkflow("Batch lifecycle");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    const batchPromise = handlers.runBatchWorkflow(workflow.id, {
      rows: [{ name: "A" }, { name: "B" }],
    });
    await waitFor(() => activeRunSignal !== null);

    expect(handlers.getRunState()).toMatchObject({
      status: "running",
      mode: "run_workflow",
      outputs: expect.objectContaining({
        batch_total: 2,
        batch_current_row_index: 0,
      }),
    });
    await expect(handlers.runWorkflow(workflow.id)).rejects.toMatchObject({
      message: "A workflow run is already active",
      field: "run",
    });

    await expect(handlers.stopRun()).resolves.toMatchObject({
      status: "stopped",
      mode: "run_workflow",
    });
    expect(activeRunSignal?.aborted).toBe(true);
    await expect(batchPromise).resolves.toEqual({
      total: 2,
      succeeded: 0,
      failed: 0,
      results: [{ row_index: 0, status: "stopped", error: null }],
    });
    expect(runnerCalls).toHaveLength(1);
  });
});

function runnableGraph(): WorkflowGraph {
  return {
    version: 1,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
      {
        id: "visit",
        node_type: "action",
        label: "Visit",
        position: { x: 200, y: 0 },
        config: { type: "navigate", config: { url: "https://owned.test" } },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "start-visit",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "visit",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function startOnlyGraph(): WorkflowGraph {
  return {
    version: 1,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

async function createTestHandlers(
  overrides: Partial<Parameters<typeof createWorkflowCommandHandlers>[0]> = {},
) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-app-"));
  tempRoots.push(tempRoot);
  const appPaths = createAppPaths(tempRoot);
  const database = initializeDatabase(appPaths);
  const handlers = createWorkflowCommandHandlers({ appPaths, database, ...overrides });
  return { appPaths, database, handlers };
}

async function waitForRunStatus(
  handlers: { getRunState(): RunState },
  status: RunState["status"],
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = handlers.getRunState();
    if (state.status === status) return state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for run status ${status}`);
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for predicate");
}
