// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createTestHandlers,
  runnableGraph,
  waitForRunStatus,
  waitForRunSnapshotStatus,
  waitFor,
  makeTemporary,
  startOnlyGraph,
  tempRoots,
  edgeForPackage,
  type ProjectWorkflow,
} from "../commands.testHelpers";
import type {
  CompiledWorkflowGraph,
  WorkflowGraph,
  WorkflowSettings,
  RunState,
} from "../../../src/types/workflow";
import { deriveFingerprintSeedFromIdentityId, finishRun } from "../commands";

vi.mock("electron", () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

describe("Workflow commands integration", () => {
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
    const persistedSettings = JSON.parse(row?.settings_json ?? "{}");
    expect(persistedSettings).toMatchObject({
      browser_launch: {
        session_mode: "persistent_profile",
        identity_id: expect.stringMatching(/^bi_/),
        display_name: "Project browser profile identity",
        persona_id: expect.any(String),
        persona: expect.objectContaining({
          behavioral_timing_profile: expect.any(String),
          viewport: expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number),
          }),
          window: expect.objectContaining({
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        }),
        profile_dir: expect.stringMatching(/^bi_/),
        fingerprint_seed: expect.stringMatching(/^\d{5}$/),
        fingerprint_fonts_dir: null,
        humanize: true,
      },
    });
    expect(persistedSettings.browser_launch.human_preset).toBe(
      persistedSettings.browser_launch.persona.behavioral_timing_profile,
    );
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
    expect(settings.browser_launch.profile_name).toBe(settings.browser_launch.profile_dir);
    expect(settings.browser_launch.display_name).toBe("Project browser profile identity");
    const initialSeed = settings.browser_launch.fingerprint_seed;
    const saved = handlers.saveWorkflowSettings(created.id, {
      ...settings,
      general: {
        ...settings.general,
        name: "Renamed flow",
        tags: ["qa"],
      },
      browser_launch: {
        ...settings.browser_launch,
        humanize: false,
        human_preset: "careful",
      },
    });

    expect(saved.general.name).toBe("Renamed flow");
    expect(saved.browser_launch.fingerprint_seed).toBe(initialSeed);
    expect(saved.browser_launch.display_name).toBe("Project browser profile identity");
    expect(saved.browser_launch.humanize).toBe(false);
    expect(saved.browser_launch.human_preset).toBe("careful");
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
    expect(JSON.parse(
      String(database.prepare("SELECT settings_json FROM workflows WHERE id = ?").get(created.id)?.settings_json ?? "{}"),
    ).browser_launch).toMatchObject({
      humanize: false,
      human_preset: "careful",
    });

    handlers.deleteWorkflow(created.id);
    expect(handlers.getWorkflow(created.id)).toBeNull();
  });

  test("creates a workflow using the specified browser profile ID", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as any;

    const project = projectHandlers.listProjects()[0];
    const customProfile = projectHandlers.createBrowserProfile(project.id, {
      name: "Custom Profile",
      description: "A custom profile for testing workflow creation",
    });

    const workflow = handlers.createWorkflow("My custom workflow", {
      project_id: project.id,
      browser_profile_id: customProfile.id,
    });

    expect(workflow).toMatchObject({
      project_id: project.id,
      browser_profile_id: customProfile.id,
    });

    const settings = handlers.getWorkflowSettings(workflow.id);
    expect(settings.browser_launch).toMatchObject({
      identity_id: customProfile.browser_launch.identity_id,
      fingerprint_seed: customProfile.browser_launch.fingerprint_seed,
    });
  });

  test("defaults new workflow browser launch fonts from the detected repo-local CloakBrowser bundle", async () => {
    const repoRoot = await fs.mkdtemp(path.join(os.tmpdir(), "repo-font-default-"));
    tempRoots.push(repoRoot);
    const defaultFontsDir = path.join(repoRoot, ".local", "cloakbrowser-fonts", "linux");
    await fs.mkdir(defaultFontsDir, { recursive: true });
    const cwd = vi.spyOn(process, "cwd").mockReturnValue(repoRoot);

    try {
      const { handlers } = await createTestHandlers({
        defaultFingerprintFontsDir: undefined,
      });
      const workflow = handlers.createWorkflow("Font defaults");
      const settings = handlers.getWorkflowSettings(workflow.id);
      const cleared = handlers.saveWorkflowSettings(workflow.id, {
        ...settings,
        browser_launch: {
          ...settings.browser_launch,
          fingerprint_fonts_dir: null,
        },
      });

      expect(settings.browser_launch.fingerprint_fonts_dir).toBe(defaultFontsDir);
      expect(cleared.browser_launch.fingerprint_fonts_dir).toBeNull();
    } finally {
      cwd.mockRestore();
    }
  });

  test("rolls back duplicate workflow when copied graph persistence fails", async () => {
    const { handlers, database } = await createTestHandlers();
    const source = handlers.createWorkflow("Source");
    handlers.saveWorkflowGraph(source.id, runnableGraph());
    const initialIds = handlers.listWorkflows().map((workflow) => workflow.id);
    database.exec(`
      CREATE TRIGGER fail_duplicate_graph_copy
      BEFORE UPDATE OF graph_json ON workflows
      WHEN OLD.id != '${source.id}'
      BEGIN
        SELECT RAISE(ABORT, 'graph copy failed');
      END;
    `);

    expect(() => handlers.duplicateWorkflow(source.id, "Copy of Source")).toThrow(
      "graph copy failed",
    );

    expect(handlers.listWorkflows().map((workflow) => workflow.id)).toEqual(initialIds);
  });

  test("duplicates workflow with the same selected browser profile", async () => {
    const { handlers } = await createTestHandlers();
    const source = handlers.createWorkflow("Source");
    handlers.saveWorkflowGraph(source.id, runnableGraph());
    const sourceSettings = handlers.getWorkflowSettings(source.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "workflow-fonts-"));
    tempRoots.push(fontsDir);
    handlers.saveWorkflowSettings(source.id, {
      ...sourceSettings,
      general: {
        ...sourceSettings.general,
        description: "Owned staging login flow",
        tags: ["staging", "identity"],
        notes: "Keep local credentials while duplicating the workflow.",
      },
      run_policy: {
        ...sourceSettings.run_policy,
        browser_retention: "retain",
        run_from_selected_enabled: true,
        run_from_selected_mode: "from_selected",
        batch_headless: true,
        batch_stop_on_first_failed_row: true,
      },
      browser_launch: {
        ...sourceSettings.browser_launch,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        proxy_username: "operator",
        proxy_password: "local-secret",
        locale: "vi-VN",
        timezone: "Asia/Ho_Chi_Minh",
        fingerprint_fonts_dir: fontsDir,
        humanize: false,
        human_preset: "careful",
      },
      environment: {
        initial_variables: [
          { name: "account.username", value_type: "text", value: "qa-user" },
        ],
      },
    });

    const duplicated = handlers.duplicateWorkflow(source.id, "Copy of Source").workflow;
    const copiedSettings = handlers.getWorkflowSettings(duplicated.id);
    const savedSourceSettings = handlers.getWorkflowSettings(source.id);

    expect(handlers.getWorkflowGraph(duplicated.id)).toMatchObject({
      version: 2,
      nodes: runnableGraph().nodes,
      edges: runnableGraph().edges,
      viewport: runnableGraph().viewport,
    });
    expect(copiedSettings.workflow_id).toBe(duplicated.id);
    expect(copiedSettings.general).toMatchObject({
      name: "Copy of Source",
      description: "Owned staging login flow",
      tags: ["staging", "identity"],
      notes: "Keep local credentials while duplicating the workflow.",
    });
    expect(copiedSettings.run_policy).toMatchObject({
      browser_retention: "retain",
      run_from_selected_enabled: false,
      run_from_selected_mode: "from_selected",
      batch_headless: true,
      batch_stop_on_first_failed_row: true,
    });
    expect(copiedSettings.environment.initial_variables).toEqual([
      { name: "account.username", value_type: "text", value: "qa-user" },
    ]);
    expect(copiedSettings.browser_launch).toMatchObject({
      session_mode: "persistent_profile",
      display_name: savedSourceSettings.browser_launch.display_name,
      profile_name: savedSourceSettings.browser_launch.profile_name,
      proxy_enabled: true,
      proxy_server: "http://proxy.local:8080",
      proxy_username: "operator",
      proxy_password: "local-secret",
      locale: "vi-VN",
      timezone: "Asia/Ho_Chi_Minh",
      fingerprint_fonts_dir: fontsDir,
      humanize: false,
      human_preset: "careful",
    });
    expect(copiedSettings.browser_launch.identity_id).toMatch(/^bi_/);
    expect(copiedSettings.browser_launch.identity_id).toBe(
      savedSourceSettings.browser_launch.identity_id,
    );
    expect(copiedSettings.browser_launch.profile_dir).toBe(
      savedSourceSettings.browser_launch.profile_dir,
    );
    expect(copiedSettings.browser_launch.profile_name).toBe(
      savedSourceSettings.browser_launch.profile_name,
    );
    expect(copiedSettings.browser_launch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(copiedSettings.browser_launch.fingerprint_seed).toBe(
      savedSourceSettings.browser_launch.fingerprint_seed,
    );
  });

  test("rejects workflow deletion while a run is active and allows it after finalization", async () => {
    const finishByRunId = new Map<string, (state: RunState) => void>();
    const { handlers, database } = await createTestHandlers({
      runner: {
        async run(request: { runId?: string | null }): Promise<RunState> {
          if (!request.runId) throw new Error("run id is required");
          return new Promise((resolve) => {
            finishByRunId.set(request.runId as string, resolve);
          });
        },
      },
    });
    const workflow = handlers.createWorkflow("Active delete guard");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    const snapshot = await handlers.runWorkflow(workflow.id);

    let deleteError: unknown;
    try {
      handlers.deleteWorkflow(workflow.id);
    } catch (error) {
      deleteError = error;
    }
    expect(deleteError).toMatchObject({
      message: "Stop the active workflow run before deleting this workflow",
      field: "workflowId",
    });
    expect(handlers.getWorkflow(workflow.id)).not.toBeNull();
    expect(
      database.prepare("SELECT workflow_id FROM runs WHERE id = ?").get(snapshot.run_id),
    ).toMatchObject({ workflow_id: workflow.id });

    finishByRunId.get(snapshot.run_id)?.({
      status: "success",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: ["visit"],
      outputs: {},
      error: null,
    });
    await waitForRunSnapshotStatus(handlers, snapshot.run_id, "success");

    handlers.deleteWorkflow(workflow.id);

    expect(handlers.getWorkflow(workflow.id)).toBeNull();
  });

  test("preserves workflow graphs on load and persists the current contract", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Legacy graph");
    const graph: WorkflowGraph = {
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
              target: {
                locators: [{ kind: "xpath", value: "//*[@id='submit']" }],
              },
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
      .run(JSON.stringify(graph), workflow.id);

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
      migration_notes: [],
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
    expect(persisted.nodes[1].config.config).toHaveProperty("target");
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

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          proxy_enabled: true,
          proxy_server: "ftp://proxy.local:8080",
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "proxy_server",
        level: "error",
        message: "Proxy server must use http, https, or socks5",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          proxy_enabled: true,
          proxy_server: "http://user:secret@proxy.local:8080",
          proxy_username: "agent",
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "proxy_username",
        level: "error",
        message: "Proxy credentials must be configured either in the proxy URL or the username/password fields, not both",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          proxy_enabled: true,
          proxy_server: "http://proxy.local:8080",
          timezone: null,
          locale: null,
          geoip: false,
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "timezone",
        level: "warning",
        message: "Proxy identities should define explicit timezone and locale or enable GeoIP so browser signals match the proxy region",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_seed: "",
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "fingerprint_seed",
        level: "error",
        message: "Persistent browser identities require a fingerprint seed",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_fonts_dir: path.join(os.tmpdir(), "missing-fingerprint-fonts"),
        } as WorkflowSettings["browser_launch"] & Record<string, unknown>,
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "fingerprint_fonts_dir",
        level: "error",
        message: "Fingerprint fonts directory must be readable",
      }),
    );

    const readableFontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "fingerprint-fonts-"));
    tempRoots.push(readableFontsDir);
    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_fonts_dir: readableFontsDir,
        } as WorkflowSettings["browser_launch"] & Record<string, unknown>,
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "fingerprint_fonts_dir",
        level: "warning",
        message: "Using the same fingerprint fonts directory across identities can create a stable font hash",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          geoip: true,
        },
      }),
    ).not.toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "geoip",
        level: "error",
        message: "GeoIP requires mmdb-lib to be installed",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          webrtc_policy: "explicit_ip",
          webrtc_ip: null,
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "webrtc_ip",
        level: "error",
        message: "Explicit WebRTC IP policy requires a WebRTC IP",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          webrtc_policy: "explicit_ip",
          webrtc_ip: "not-an-ip",
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "webrtc_ip",
        level: "error",
        message: "Explicit WebRTC IP must be a valid IPv4 or IPv6 address",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          webrtc_policy: "disabled_if_supported",
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "webrtc_policy",
        level: "error",
        message: "Disabled WebRTC policy is not supported by the installed CloakBrowser runtime",
      }),
    );

    const legacyOverrideSettings = {
      ...handlers.getWorkflowSettings(workflow.id),
      browser_launch: {
        ...handlers.getWorkflowSettings(workflow.id).browser_launch,
        browser_brand: "firefox" as never,
        viewport_width: 1366,
        viewport_height: 768,
        device_scale_factor: 2,
        mobile: true,
        touch: true,
        fingerprint_platform: "macos" as never,
        hardware_concurrency: 8,
        device_memory_gb: 16,
        fingerprint_fonts_dir: readableFontsDir,
        storage_quota_mb: 256,
        user_agent: "WorkflowBot/1.0",
      },
    };
    handlers.saveWorkflowSettings(workflow.id, legacyOverrideSettings);
    const normalizedLegacyBrowser = handlers.getWorkflowSettings(workflow.id).browser_launch;
    expect(normalizedLegacyBrowser).not.toHaveProperty("browser_brand");
    expect(normalizedLegacyBrowser).not.toHaveProperty("viewport_width");
    expect(normalizedLegacyBrowser).not.toHaveProperty("viewport_height");
    expect(normalizedLegacyBrowser).not.toHaveProperty("device_scale_factor");
    expect(normalizedLegacyBrowser).not.toHaveProperty("mobile");
    expect(normalizedLegacyBrowser).not.toHaveProperty("touch");
    expect(normalizedLegacyBrowser).not.toHaveProperty("fingerprint_platform");
    expect(normalizedLegacyBrowser).not.toHaveProperty("hardware_concurrency");
    expect(normalizedLegacyBrowser).not.toHaveProperty("device_memory_gb");
    expect(normalizedLegacyBrowser.fingerprint_fonts_dir).toBe(readableFontsDir);
    expect(normalizedLegacyBrowser).not.toHaveProperty("storage_quota_mb");
    expect(normalizedLegacyBrowser).not.toHaveProperty("user_agent");

    handlers.saveWorkflowSettings(workflow.id, {
      ...handlers.getWorkflowSettings(workflow.id),
      browser_launch: {
        ...handlers.getWorkflowSettings(workflow.id).browser_launch,
        timezone: "America/New_York",
        locale: "en-US",
      },
    });

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
      timezone: "America/New_York",
      locale: "en-US",
    });
  });

  test("validates run policy numeric ranges", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Settings validation");
    const settings = handlers.getWorkflowSettings(workflow.id);

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
  });

  test("labels graph default link wait validation as new link wait", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Settings validation");
    const settings = handlers.getWorkflowSettings(workflow.id);

    expect(
      handlers.validateWorkflowSettings({
        ...settings,
        graph_defaults: {
          ...settings.graph_defaults,
          default_edge_delay: {
            type: "random",
            min_ms: 5000,
            max_ms: 3000,
          },
        },
      }),
    ).toEqual([
      expect.objectContaining({
        section: "graph_defaults",
        field: "default_edge_delay",
        level: "error",
        message: "New link wait range is invalid",
      }),
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

  test("runs from a selected graph node only when a reusable retained session exists", async () => {
    const runnerCalls: Array<{
      graph: CompiledWorkflowGraph;
      reuseRetainedSession?: boolean;
      retainedSessionWorkflowId?: string | null;
    }> = [];
    const { handlers } = await createTestHandlers({
      runner: {
        hasReusableRetainedSession: vi.fn(() => true),
        async run(request: {
          graph: CompiledWorkflowGraph;
          reuseRetainedSession?: boolean;
          retainedSessionWorkflowId?: string | null;
        }): Promise<RunState> {
          runnerCalls.push(request);
          return {
            status: "success",
            mode: "run_workflow",
            target_step_id: "visit",
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: ["visit"],
            outputs: { continued: true },
            error: null,
            retained_session: {
              available: true,
              workflow_id: "workflow-1",
              profile_name: "qa-profile",
              reason: null,
            },
          };
        },
      },
    });
    const workflow = handlers.createWorkflow("Runnable");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
      },
      run_policy: {
        ...settings.run_policy,
        browser_retention: "retain",
        run_from_selected_enabled: true,
      },
    });

    const result = await handlers.runWorkflowFromNode(workflow.id, "visit");

    expect(result).toMatchObject({
      status: "running",
      mode: "run_workflow",
      target_step_id: "visit",
    });
    expect(runnerCalls).toHaveLength(1);
    expect(runnerCalls[0]).toMatchObject({
      reuseRetainedSession: true,
      retainedSessionWorkflowId: workflow.id,
    });
    expect(runnerCalls[0]?.graph.steps.map((step) => step.node_id)).toEqual(["visit"]);
  });

  test("runs only the selected node when Run Policy selects selected-only scope", async () => {
    const runnerCalls: Array<{ graph: CompiledWorkflowGraph }> = [];
    const { handlers } = await createTestHandlers({
      runner: {
        hasReusableRetainedSession: vi.fn(() => true),
        async run(request: { graph: CompiledWorkflowGraph }): Promise<RunState> {
          runnerCalls.push(request);
          return {
            status: "success",
            mode: "run_workflow",
            target_step_id: "visit",
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: ["visit"],
            outputs: {},
            error: null,
            retained_session: {
              available: true,
              workflow_id: "workflow-1",
              profile_name: "qa-profile",
              reason: null,
            },
          };
        },
      },
    });
    const workflow = handlers.createWorkflow("Selected-only");
    const graph = runnableGraph();
    graph.nodes.push({
      id: "after",
      node_type: "action",
      label: "After",
      position: { x: 400, y: 0 },
      config: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    });
    graph.edges.push({
      id: "visit-after",
      source_node_id: "visit",
      source_port: "out",
      target_node_id: "after",
      target_port: "in",
    });
    handlers.saveWorkflowGraph(workflow.id, graph);
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
      },
      run_policy: {
        ...settings.run_policy,
        browser_retention: "retain",
        run_from_selected_enabled: true,
        run_from_selected_mode: "selected_only",
      },
    });

    await handlers.runWorkflowFromNode(workflow.id, "visit");

    expect(runnerCalls[0]?.graph.steps.map((step) => step.node_id)).toEqual(["visit"]);
  });

  test("rejects run-from-selected when reuse session or retained browser state is unavailable", async () => {
    const runner = {
      hasReusableRetainedSession: vi.fn(() => false),
      run: vi.fn(),
    };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("No reusable session");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "Run from selected must be enabled in Workflow Settings",
      field: "run_policy.run_from_selected_enabled",
    });

    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        run_from_selected_enabled: true,
      },
      browser_launch: {
        ...settings.browser_launch,
        session_mode: "temporary",
        profile_name: null,
      },
    });
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "Run from selected requires a persistent browser profile",
      field: "browser_launch.session_mode",
    });

    handlers.saveWorkflowSettings(workflow.id, {
      ...handlers.getWorkflowSettings(workflow.id),
      browser_launch: {
        ...handlers.getWorkflowSettings(workflow.id).browser_launch,
        session_mode: "persistent_profile",
        profile_name: handlers.getWorkflowSettings(workflow.id).browser_launch.profile_dir,
      },
      run_policy: {
        ...handlers.getWorkflowSettings(workflow.id).run_policy,
        browser_retention: "close",
        run_from_selected_enabled: true,
      },
    });
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "Run from selected requires browser retention to be set to retain",
      field: "run_policy.browser_retention",
    });

    handlers.saveWorkflowSettings(workflow.id, {
      ...handlers.getWorkflowSettings(workflow.id),
      run_policy: {
        ...handlers.getWorkflowSettings(workflow.id).run_policy,
        browser_retention: "retain",
        run_from_selected_enabled: false,
      },
    });
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "Run from selected must be enabled in Workflow Settings",
      field: "run_policy.run_from_selected_enabled",
    });

    handlers.saveWorkflowSettings(workflow.id, {
      ...handlers.getWorkflowSettings(workflow.id),
      run_policy: {
        ...handlers.getWorkflowSettings(workflow.id).run_policy,
        run_from_selected_enabled: true,
      },
    });
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "No reusable browser session is available. Run the workflow again to create one.",
      field: "run",
    });
    expect(runner.run).not.toHaveBeenCalled();
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

  test("starts isolated workflow runs concurrently and lists each run snapshot", async () => {
    const finishByRunId = new Map<string, (state: RunState) => void>();
    const observedSignals = new Map<string, AbortSignal>();
    const runRunnerIds: string[] = [];
    let runRunnerCount = 0;
    const runner = {
      run: vi.fn(async () => {
        throw new Error("workflow runs should use an isolated runner instance");
      }),
      createIsolatedRunRunner: vi.fn(() => {
        runRunnerCount += 1;
        const runnerId = `runner-${runRunnerCount}`;
        return {
          async run(request: {
            runId?: string | null;
            settings: WorkflowSettings;
            signal?: AbortSignal;
            onProgress?: (state: Partial<RunState>) => void;
          }): Promise<RunState> {
            if (!request.runId) throw new Error("run id is required");
            runRunnerIds.push(runnerId);
            observedSignals.set(request.runId, request.signal as AbortSignal);
            request.onProgress?.({
              current_step_id: "visit",
              current_step_number: 1,
              completed_step_ids: [],
            });
            return new Promise((resolve) => {
              finishByRunId.set(request.runId as string, resolve);
            });
          },
        };
      }),
    };
    const { handlers } = await createTestHandlers({
      runner,
    });
    const firstWorkflow = handlers.createWorkflow("Checkout");
    const secondWorkflow = handlers.createWorkflow("Support");
    handlers.saveWorkflowGraph(firstWorkflow.id, runnableGraph());
    handlers.saveWorkflowGraph(secondWorkflow.id, runnableGraph());
    makeTemporary(handlers, firstWorkflow.id);
    makeTemporary(handlers, secondWorkflow.id);

    const first = await handlers.runWorkflow(firstWorkflow.id);
    const second = await handlers.runWorkflow(secondWorkflow.id);

    expect(first).toMatchObject({
      workflow_id: firstWorkflow.id,
      workflow_name: "Checkout",
      source: "manual",
      state: {
        status: "running",
        current_step_id: "visit",
      },
    });
    expect(second).toMatchObject({
      workflow_id: secondWorkflow.id,
      workflow_name: "Support",
      source: "manual",
      state: {
        status: "running",
      },
    });
    expect(handlers.listRunStates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ run_id: first.run_id, workflow_id: firstWorkflow.id }),
        expect.objectContaining({ run_id: second.run_id, workflow_id: secondWorkflow.id }),
      ]),
    );
    expect(finishByRunId).toHaveLength(2);
    expect(runner.run).not.toHaveBeenCalled();
    expect(runner.createIsolatedRunRunner).toHaveBeenCalledTimes(2);
    expect(new Set(runRunnerIds)).toHaveLength(2);
    expect(observedSignals.get(first.run_id)?.aborted).toBe(false);
    expect(observedSignals.get(second.run_id)?.aborted).toBe(false);
  });

  test("rejects same-workflow and persistent-profile concurrent run conflicts", async () => {
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: { runId?: string | null }): Promise<RunState> {
          return new Promise((resolve) => {
            if (!request.runId) throw new Error("run id is required");
            setTimeout(() => {
              resolve({
                status: "success",
                mode: "run_workflow",
                target_step_id: null,
                current_step_id: null,
                current_step_number: null,
                completed_step_ids: ["visit"],
                outputs: {},
                error: null,
              });
            }, 50);
          });
        },
      },
    });
    const firstWorkflow = handlers.createWorkflow("Profile owner");
    const secondWorkflow = handlers.createWorkflow("Profile shared");
    handlers.saveWorkflowGraph(firstWorkflow.id, runnableGraph());
    handlers.saveWorkflowGraph(secondWorkflow.id, runnableGraph());
    const firstSettings = handlers.getWorkflowSettings(firstWorkflow.id);
    const secondSettings = handlers.getWorkflowSettings(secondWorkflow.id);
    handlers.saveWorkflowSettings(secondWorkflow.id, {
      ...secondSettings,
      browser_launch: {
        ...secondSettings.browser_launch,
        session_mode: "persistent_profile",
        profile_dir: firstSettings.browser_launch.profile_dir,
        profile_name: firstSettings.browser_launch.profile_dir,
      },
    });

    await handlers.runWorkflow(firstWorkflow.id);

    await expect(handlers.runWorkflow(firstWorkflow.id)).rejects.toMatchObject({
      message: "This workflow is already running",
      field: "workflowId",
    });
    await expect(handlers.runWorkflow(secondWorkflow.id)).rejects.toMatchObject({
      message: "Browser profile is already in use by another active run",
      field: "browser_launch.profile_name",
    });
  });

  test("stops only the targeted run id and persists terminal evidence per run", async () => {
    const finishByRunId = new Map<string, (state: RunState) => void>();
    const signals = new Map<string, AbortSignal>();
    const { handlers, database } = await createTestHandlers({
      runner: {
        async run(request: {
          runId?: string | null;
          signal?: AbortSignal;
        }): Promise<RunState> {
          if (!request.runId) throw new Error("run id is required");
          signals.set(request.runId, request.signal as AbortSignal);
          return new Promise((resolve) => {
            finishByRunId.set(request.runId as string, resolve);
          });
        },
      },
    });
    const firstWorkflow = handlers.createWorkflow("Checkout");
    const secondWorkflow = handlers.createWorkflow("Support");
    handlers.saveWorkflowGraph(firstWorkflow.id, runnableGraph());
    handlers.saveWorkflowGraph(secondWorkflow.id, runnableGraph());
    makeTemporary(handlers, firstWorkflow.id);
    makeTemporary(handlers, secondWorkflow.id);
    const first = await handlers.runWorkflow(firstWorkflow.id);
    const second = await handlers.runWorkflow(secondWorkflow.id);

    const stopped = await handlers.stopRun(first.run_id);

    expect(stopped).toMatchObject({
      run_id: first.run_id,
      workflow_id: firstWorkflow.id,
      state: { status: "stopped" },
    });
    expect(signals.get(first.run_id)?.aborted).toBe(true);
    expect(signals.get(second.run_id)?.aborted).toBe(false);
    expect(handlers.listRunStates()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          run_id: first.run_id,
          state: expect.objectContaining({ status: "stopped" }),
        }),
        expect.objectContaining({
          run_id: second.run_id,
          state: expect.objectContaining({ status: "running" }),
        }),
      ]),
    );

    finishByRunId.get(first.run_id)?.({
      status: "stopped",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: [],
      outputs: {
        stoppedMarker: first.run_id,
        __action_traces: [
          {
            node_id: "visit",
            action_type: "navigate",
            status: "stopped",
            mode: "browser",
          },
        ],
      },
      error: null,
    });
    finishByRunId.get(second.run_id)?.({
      status: "success",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: ["visit"],
      outputs: {
        title: "Support",
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
    await waitForRunSnapshotStatus(handlers, second.run_id, "success");

    const runRows = database
      .prepare("SELECT id, workflow_id, status, outputs_json FROM runs ORDER BY workflow_id")
      .all() as Array<Record<string, string | null>>;
    expect(runRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: first.run_id,
          workflow_id: firstWorkflow.id,
          status: "stopped",
        }),
        expect.objectContaining({
          id: second.run_id,
          workflow_id: secondWorkflow.id,
          status: "success",
        }),
      ]),
    );
    expect(JSON.parse(runRows.find((row) => row.id === first.run_id)?.outputs_json ?? "{}"))
      .toMatchObject({ stoppedMarker: first.run_id });
    expect(JSON.parse(runRows.find((row) => row.id === second.run_id)?.outputs_json ?? "{}"))
      .toMatchObject({ title: "Support" });
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
      message: "This workflow is already running",
      field: "workflowId",
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

  test("persists executed nested action traces as durable run step rows", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Nested trace persistence");
    const runId = "run-nested-traces";
    database
      .prepare(
        `INSERT INTO runs (id, workflow_id, status, started_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(runId, workflow.id, "running", "1");
    const graph: CompiledWorkflowGraph = {
      steps: [
        {
          node_id: "if",
          label: "If",
          config: {
            type: "if_condition",
            config: { condition: { kind: "output_equals", name: "state", value: "ready" }, then_steps: [], else_steps: [] },
          },
        },
        {
          node_id: "router",
          label: "Router",
          config: {
            type: "router_condition",
            config: { mode: "first_match", cases: [], default_steps: [] },
          },
        },
        {
          node_id: "while",
          label: "While",
          config: {
            type: "while_loop",
            config: { condition: { kind: "output_equals", name: "keep", value: "yes" }, max_attempts: 2, timeout_ms: null, steps: [] },
          },
        },
        {
          node_id: "retry",
          label: "Retry",
          config: {
            type: "retry_block",
            config: { max_attempts: 2, delay_ms: 0, steps: [], failed_steps: [] },
          },
        },
      ],
    };

    finishRun(database, runId, graph, {
      status: "success",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: null,
      current_step_number: null,
      completed_step_ids: ["if", "router", "while", "retry"],
      outputs: {
        __action_traces: [
          {
            node_id: "if-true-a",
            label: "If True A",
            action_type: "set_variable",
            status: "success",
            mode: "direct_dom",
            parent_node_id: "if",
            trace_sequence: 0,
          },
          {
            node_id: "if-true-b",
            label: "If True B",
            action_type: "set_variable",
            status: "success",
            mode: "direct_dom",
            parent_node_id: "if",
            trace_sequence: 1,
          },
          {
            node_id: "router-selected",
            label: "Router Selected",
            action_type: "set_variable",
            status: "success",
            mode: "direct_dom",
            parent_node_id: "router",
            trace_sequence: 2,
          },
          {
            node_id: "loop-body",
            label: "Loop Body",
            action_type: "set_variable",
            status: "success",
            mode: "direct_dom",
            parent_node_id: "while",
            trace_sequence: 3,
          },
          {
            node_id: "loop-body",
            label: "Loop Body",
            action_type: "set_variable",
            status: "success",
            mode: "direct_dom",
            parent_node_id: "while",
            trace_sequence: 4,
          },
          {
            node_id: "retry-attempt",
            label: "Retry Attempt",
            action_type: "assert_output",
            status: "failed",
            mode: "observer",
            parent_node_id: "retry",
            trace_sequence: 5,
            reason: "Output retry_value did not equal ready",
          },
          {
            node_id: "retry-attempt",
            label: "Retry Attempt",
            action_type: "assert_output",
            status: "success",
            mode: "observer",
            parent_node_id: "retry",
            trace_sequence: 6,
          },
        ],
      },
      error: null,
    });

    const stepRows = database
      .prepare("SELECT node_id, step_number, action_type, status, trace_json FROM run_steps WHERE run_id = ? ORDER BY step_number")
      .all(runId) as Array<Record<string, string | number | null>>;
    const nodeIds = stepRows.map((row) => row.node_id);

    expect(nodeIds).toEqual(
      expect.arrayContaining([
        "if",
        "router",
        "while",
        "retry",
        "if-true-a",
        "if-true-b",
        "router-selected",
        "loop-body",
        "retry-attempt",
      ]),
    );
    expect(nodeIds).not.toContain("router-unselected");
    expect(stepRows.filter((row) => row.node_id === "loop-body")).toHaveLength(2);
    expect(stepRows.filter((row) => row.node_id === "retry-attempt")).toHaveLength(2);
    expect(
      stepRows
        .filter((row) => ["if-true-a", "if-true-b", "router-selected", "loop-body", "retry-attempt"].includes(String(row.node_id)))
        .map((row) => JSON.parse(String(row.trace_json)))
        .map((trace) => ({
          node_id: trace.node_id,
          parent_node_id: trace.parent_node_id,
          trace_sequence: trace.trace_sequence,
          status: trace.status,
        })),
    ).toEqual([
      { node_id: "if-true-a", parent_node_id: "if", trace_sequence: 0, status: "success" },
      { node_id: "if-true-b", parent_node_id: "if", trace_sequence: 1, status: "success" },
      { node_id: "router-selected", parent_node_id: "router", trace_sequence: 2, status: "success" },
      { node_id: "loop-body", parent_node_id: "while", trace_sequence: 3, status: "success" },
      { node_id: "loop-body", parent_node_id: "while", trace_sequence: 4, status: "success" },
      { node_id: "retry-attempt", parent_node_id: "retry", trace_sequence: 5, status: "failed" },
      { node_id: "retry-attempt", parent_node_id: "retry", trace_sequence: 6, status: "success" },
    ]);
    expect(
      JSON.parse(String(stepRows.find((row) =>
        row.node_id === "retry-attempt" && row.status === "failed",
      )?.trace_json)).reason,
    ).toBe("Output retry_value did not equal ready");
  });

  test("rolls back terminal run evidence when a step insert fails", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Evidence rollback");
    const runId = "run-rollback";
    database
      .prepare(
        `INSERT INTO runs (id, workflow_id, status, started_at)
         VALUES (?, ?, ?, ?)`,
      )
      .run(runId, workflow.id, "running", "1");
    database.exec(`
      CREATE TRIGGER fail_second_step_insert
      BEFORE INSERT ON run_steps
      WHEN NEW.node_id = 'second'
      BEGIN
        SELECT RAISE(ABORT, 'step insert failed');
      END;
    `);
    const graph: CompiledWorkflowGraph = {
      steps: [
        {
          node_id: "first",
          label: "First",
          config: { type: "wait", config: { condition: "duration", duration_ms: 1 } },
        },
        {
          node_id: "second",
          label: "Second",
          config: { type: "wait", config: { condition: "duration", duration_ms: 1 } },
        },
      ],
    };

    expect(() =>
      finishRun(database, runId, graph, {
        status: "success",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["first", "second"],
        outputs: {},
        error: null,
      }),
    ).toThrow("step insert failed");

    expect(
      database.prepare("SELECT status, finished_at FROM runs WHERE id = ?").get(runId),
    ).toMatchObject({ status: "running", finished_at: null });
    expect(database.prepare("SELECT COUNT(*) AS count FROM run_steps WHERE run_id = ?").get(runId))
      .toMatchObject({ count: 0 });
  });

  test("does not keep the active-run lock when run persistence fails before launch", async () => {
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
    const { handlers, database } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("Persistence failure");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    database.exec(`
      CREATE TRIGGER fail_run_insert
      BEFORE INSERT ON runs
      BEGIN
        SELECT RAISE(ABORT, 'run insert failed');
      END;
    `);

    await expect(handlers.runWorkflow(workflow.id)).rejects.toThrow("run insert failed");
    expect(runner.run).not.toHaveBeenCalled();

    database.exec("DROP TRIGGER fail_run_insert");
    await expect(handlers.runWorkflow(workflow.id)).resolves.toMatchObject({
      status: "running",
      mode: "run_workflow",
    });
    expect(runner.run).toHaveBeenCalledTimes(1);
  });

  test("does not keep the active-run lock when run-from-selected persistence fails before launch", async () => {
    const runner = {
      hasReusableRetainedSession: vi.fn(() => true),
      getRetainedSessionState: vi.fn(() => ({
        available: true,
        workflow_id: "workflow-1",
        profile_name: "qa-profile",
        reason: null,
      })),
      run: vi.fn(async (): Promise<RunState> => ({
        status: "success",
        mode: "run_workflow",
        target_step_id: "visit",
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["visit"],
        outputs: {},
        error: null,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile",
          reason: null,
        },
      })),
    };
    const { handlers, database } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("Selected persistence failure");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        session_mode: "persistent_profile",
        profile_name: "qa-profile",
      },
      run_policy: {
        ...settings.run_policy,
        browser_retention: "retain",
        run_from_selected_enabled: true,
      },
    });
    database.exec(`
      CREATE TRIGGER fail_run_insert
      BEFORE INSERT ON runs
      BEGIN
        SELECT RAISE(ABORT, 'run insert failed');
      END;
    `);

    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toThrow(
      "run insert failed",
    );
    expect(runner.run).not.toHaveBeenCalled();

    database.exec("DROP TRIGGER fail_run_insert");
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).resolves.toMatchObject({
      status: "running",
      mode: "run_workflow",
      target_step_id: "visit",
    });
    expect(runner.run).toHaveBeenCalledTimes(1);
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
      message: "A batch run is already active",
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

  test("clears batch running state when row persistence fails", async () => {
    const { handlers, database } = await createTestHandlers({
      runner: {
        run: vi.fn(),
      },
    });
    const workflow = handlers.createWorkflow("Batch persistence failure");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    database.exec(`
      CREATE TRIGGER fail_batch_run_insert
      BEFORE INSERT ON runs
      BEGIN
        SELECT RAISE(ABORT, 'run insert failed');
      END;
    `);

    await expect(
      handlers.runBatchWorkflow(workflow.id, {
        rows: [{ name: "A" }],
      }),
    ).rejects.toThrow("run insert failed");

    expect(handlers.getRunState()).toMatchObject({
      status: "failed",
      mode: "run_workflow",
      error: expect.objectContaining({
        reason: "run insert failed",
      }),
    });
  });

  test("rejects workflow graph updates with unknown nested action discriminants", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Unknown nested action");
    const graph: WorkflowGraph = {
      version: 2,
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
          id: "if",
          node_type: "action",
          label: "If",
          position: { x: 100, y: 0 },
          config: {
            type: "if_condition",
            config: {
              condition: { kind: "output_equals", name: "ready", value: "yes" },
              then_steps: [{ type: "mystery_action", config: {} }],
              else_steps: [],
            },
          },
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
        },
      ],
      edges: [edgeForPackage("start", "out", "if", "in")],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    expect(() => handlers.saveWorkflowGraph(workflow.id, graph)).toThrow(
      expect.objectContaining({
        message: "Node If has invalid action config: Unsupported action type: mystery_action",
        field: "workflow.graph",
      }),
    );
  });
});
