// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createWorkflowCommandHandlers,
  finishRun,
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
    expect(JSON.parse(row?.settings_json ?? "{}")).toMatchObject({
      browser_launch: {
        session_mode: "persistent_profile",
        identity_id: expect.stringMatching(/^bi_/),
        display_name: "Login flow identity",
        profile_dir: expect.stringMatching(/^bi_/),
        fingerprint_seed: expect.stringMatching(/^\d{5}$/),
        humanize: true,
        human_preset: "default",
      },
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
    expect(settings.browser_launch.profile_name).toBe(settings.browser_launch.profile_dir);
    expect(settings.browser_launch.display_name).toBe("Login flow identity");
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
    expect(saved.browser_launch.display_name).toBe("Login flow identity");
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

  test("duplicates workflow with a fresh browser identity and session profile", async () => {
    const { handlers } = await createTestHandlers();
    const source = handlers.createWorkflow("Source");
    handlers.saveWorkflowGraph(source.id, runnableGraph());
    const sourceSettings = handlers.getWorkflowSettings(source.id);
    handlers.saveWorkflowSettings(source.id, {
      ...sourceSettings,
      general: {
        ...sourceSettings.general,
        description: "Owned staging login flow",
        tags: ["staging", "identity"],
        notes: "Keep local credentials while making a fresh duplicate identity.",
      },
      run_policy: {
        ...sourceSettings.run_policy,
        browser_retention: "retain",
        batch_headless: true,
        batch_stop_on_first_failed_row: true,
      },
      browser_launch: {
        ...sourceSettings.browser_launch,
        run_from_selected_enabled: true,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        proxy_username: "operator",
        proxy_password: "local-secret",
        proxy_label: "owned-proxy",
        locale: "vi-VN",
        timezone: "Asia/Ho_Chi_Minh",
        viewport_width: 1366,
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
      notes: "Keep local credentials while making a fresh duplicate identity.",
    });
    expect(copiedSettings.run_policy).toMatchObject({
      browser_retention: "retain",
      batch_headless: true,
      batch_stop_on_first_failed_row: true,
    });
    expect(copiedSettings.environment.initial_variables).toEqual([
      { name: "account.username", value_type: "text", value: "qa-user" },
    ]);
    expect(copiedSettings.browser_launch).toMatchObject({
      session_mode: "persistent_profile",
      display_name: "Copy of Source identity",
      profile_name: copiedSettings.browser_launch.profile_dir,
      run_from_selected_enabled: false,
      proxy_enabled: true,
      proxy_server: "http://proxy.local:8080",
      proxy_username: "operator",
      proxy_password: "local-secret",
      proxy_label: "owned-proxy",
      locale: "vi-VN",
      timezone: "Asia/Ho_Chi_Minh",
      viewport_width: 1366,
      humanize: false,
      human_preset: "careful",
    });
    expect(copiedSettings.browser_launch.identity_id).toMatch(/^bi_/);
    expect(copiedSettings.browser_launch.identity_id).not.toBe(
      savedSourceSettings.browser_launch.identity_id,
    );
    expect(copiedSettings.browser_launch.profile_dir).not.toBe(
      savedSourceSettings.browser_launch.profile_dir,
    );
    expect(copiedSettings.browser_launch.profile_name).not.toBe(
      savedSourceSettings.browser_launch.profile_name,
    );
    expect(copiedSettings.browser_launch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(copiedSettings.browser_launch.fingerprint_seed).not.toBe(
      savedSourceSettings.browser_launch.fingerprint_seed,
    );
  });

  test("deletes private browser profile data only when requested", async () => {
    const { handlers, appPaths } = await createTestHandlers();
    const keptWorkflow = handlers.createWorkflow("Keep profile");
    const keptSettings = handlers.getWorkflowSettings(keptWorkflow.id);
    const keptProfilePath = path.join(
      appPaths.browserProfilesDir,
      keptSettings.browser_launch.profile_dir,
    );
    await fs.mkdir(keptProfilePath, { recursive: true });
    await fs.writeFile(path.join(keptProfilePath, "storage.txt"), "state");

    handlers.deleteWorkflow(keptWorkflow.id, { deleteBrowserProfile: false });

    expect(handlers.getWorkflow(keptWorkflow.id)).toBeNull();
    await expect(fs.stat(keptProfilePath)).resolves.toBeTruthy();

    const deletedWorkflow = handlers.createWorkflow("Delete profile");
    const deletedSettings = handlers.getWorkflowSettings(deletedWorkflow.id);
    const deletedProfilePath = path.join(
      appPaths.browserProfilesDir,
      deletedSettings.browser_launch.profile_dir,
    );
    await fs.mkdir(deletedProfilePath, { recursive: true });
    await fs.writeFile(path.join(deletedProfilePath, "storage.txt"), "state");

    handlers.deleteWorkflow(deletedWorkflow.id, { deleteBrowserProfile: true });

    expect(handlers.getWorkflow(deletedWorkflow.id)).toBeNull();
    await expect(fs.stat(deletedProfilePath)).rejects.toThrow();
  });

  test("does not delete browser profile data that another workflow still references", async () => {
    const { handlers, appPaths } = await createTestHandlers();
    const owner = handlers.createWorkflow("Profile owner");
    const shared = handlers.createWorkflow("Profile shared");
    const ownerSettings = handlers.getWorkflowSettings(owner.id);
    const sharedSettings = handlers.getWorkflowSettings(shared.id);
    const profileDir = ownerSettings.browser_launch.profile_dir;
    const profilePath = path.join(appPaths.browserProfilesDir, profileDir);
    await fs.mkdir(profilePath, { recursive: true });
    await fs.writeFile(path.join(profilePath, "storage.txt"), "state");
    handlers.saveWorkflowSettings(shared.id, {
      ...sharedSettings,
      browser_launch: {
        ...sharedSettings.browser_launch,
        session_mode: "persistent_profile",
        profile_dir: profileDir,
        profile_name: profileDir,
      },
    });

    handlers.deleteWorkflow(owner.id, { deleteBrowserProfile: true });

    expect(handlers.getWorkflow(owner.id)).toBeNull();
    expect(handlers.getWorkflow(shared.id)).not.toBeNull();
    await expect(fs.stat(profilePath)).resolves.toBeTruthy();
  });

  test("reports CloakBrowser diagnostics and profile storage without secrets", async () => {
    const { handlers, appPaths, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Diagnostics flow");
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        display_name: "QA US Login",
        proxy_enabled: true,
        proxy_server: "http://proxy.test:8080",
        proxy_password: "secret-proxy-password",
      },
    });
    const profileDir = handlers.getWorkflowSettings(workflow.id).browser_launch.profile_dir;
    await fs.mkdir(path.join(appPaths.browserProfilesDir, profileDir), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, profileDir, "storage.txt"), "state");
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, status, started_at, finished_at, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-preflight",
        workflow.id,
        "failed",
        "2026-05-15T00:00:00.000Z",
        "2026-05-15T00:00:02.000Z",
        JSON.stringify({
          fingerprint_preflight: {
            passed: false,
            verdict: "blocked",
            risk_score: 72,
            run_id: "fp-001",
            profile_id: "bi_qa",
          },
        }),
      );

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.wrapper_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(diagnostics.binary.version).toMatch(/^\d+/);
    expect(diagnostics.binary.platform).toBeTruthy();
    expect(typeof diagnostics.binary.installed).toBe("boolean");
    expect(diagnostics.profile_root).toBe(appPaths.browserProfilesDir);
    expect(diagnostics.geoip_available).toBe(false);
    expect(diagnostics.font_checklist).toEqual({
      status: "not_checked",
      reason: "Font coverage detection is not implemented",
    });
    expect(diagnostics.last_smoke_result).toEqual({
      status: "not_recorded",
      reason: "Smoke tests are recorded by the npm run test:smoke command output",
    });
    expect(diagnostics.last_preflight_verdict).toMatchObject({
      workflow_id: workflow.id,
      workflow_name: "Diagnostics flow",
      run_id: "fp-001",
      verdict: "blocked",
      passed: false,
      risk_score: 72,
      finished_at: "2026-05-15T00:00:02.000Z",
    });
    expect(diagnostics.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile_dir: profileDir,
          display_name: "QA US Login",
          approximate_size_bytes: expect.any(Number),
          active_session: false,
        }),
      ]),
    );
    expect(diagnostics.profiles[0]?.last_run_at).toBe("2026-05-15T00:00:02.000Z");
    expect(JSON.stringify(diagnostics)).not.toContain("secret-proxy-password");
  });

  test("cleans up only orphaned inactive CloakBrowser profiles", async () => {
    const activeRunner = {
      run: vi.fn(),
      getRetainedSessionState: vi.fn(() => ({
        available: true,
        workflow_id: "active-workflow",
        profile_name: "active-profile",
        reason: null,
      })),
    };
    const { handlers, appPaths } = await createTestHandlers({ runner: activeRunner });
    const workflow = handlers.createWorkflow("Persistent profile");
    const profileDir = handlers.getWorkflowSettings(workflow.id).browser_launch.profile_dir;
    await fs.mkdir(path.join(appPaths.browserProfilesDir, profileDir), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, profileDir, "state.txt"), "state");
    await fs.mkdir(path.join(appPaths.browserProfilesDir, "orphan-profile"), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, "orphan-profile", "cache.bin"), "cache");
    await fs.mkdir(path.join(appPaths.browserProfilesDir, "active-profile"), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, "active-profile", "lock"), "lock");

    const result = await handlers.cleanupOrphanedBrowserProfiles();

    expect(result.deleted_profiles).toEqual(["orphan-profile"]);
    expect(result.reclaimed_bytes).toBeGreaterThan(0);
    expect(result.skipped_profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profile_dir: profileDir, workflow_id: workflow.id }),
        expect.objectContaining({ profile_dir: "active-profile", active_session: true }),
      ]),
    );
    await expect(fs.stat(path.join(appPaths.browserProfilesDir, "orphan-profile"))).rejects.toThrow();
    await expect(fs.stat(path.join(appPaths.browserProfilesDir, profileDir))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(appPaths.browserProfilesDir, "active-profile"))).resolves.toBeTruthy();
  });

  test("prevents changing or deleting an actively retained browser identity profile", async () => {
    const runner = {
      run: vi.fn(),
      getRetainedSessionState: vi.fn(() => ({
        available: true,
        workflow_id: "workflow-1",
        profile_name: "bi_workflow-1",
        reason: null,
      })),
    };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("Active identity");
    const settings = handlers.getWorkflowSettings(workflow.id);
    runner.getRetainedSessionState.mockReturnValue({
      available: true,
      workflow_id: workflow.id,
      profile_name: settings.browser_launch.profile_dir,
      reason: null,
    });

    expect(() =>
      handlers.saveWorkflowSettings(workflow.id, {
        ...settings,
        browser_launch: {
          ...settings.browser_launch,
          identity_id: "bi_rotated",
          profile_dir: "bi_rotated",
          fingerprint_seed: "99999",
          profile_name: "bi_rotated",
        },
      }),
    ).toThrow("Close the retained browser session before changing or deleting its identity profile");

    expect(() => handlers.deleteWorkflow(workflow.id)).toThrow(
      "Close the retained browser session before changing or deleting its identity profile",
    );
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
          geoip: true,
        },
      }),
    ).toContainEqual(
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
          preflight_enabled: true,
          preflight_probe_url: "https://probe.owned.test/verdict",
          preflight_allowed_origins: ["https://other.owned.test"],
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "preflight_probe_url",
        level: "error",
        message: "Fingerprint preflight probe origin must be allowlisted",
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

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_overrides_enabled: true,
          fingerprint_platform: "plan9" as never,
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "fingerprint_platform",
        level: "error",
        message: "Fingerprint platform must be windows, macos, or linux",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_overrides_enabled: true,
          hardware_concurrency: 0,
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "hardware_concurrency",
        level: "error",
        message: "Hardware concurrency must be an integer between 1 and 64",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_overrides_enabled: true,
          fingerprint_fonts_dir: "/path/that/does/not/exist",
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "fingerprint_fonts_dir",
        level: "error",
        message: "Fingerprint fonts directory must be readable",
      }),
    );

    expect(
      handlers.validateWorkflowSettings({
        ...handlers.getWorkflowSettings(workflow.id),
        browser_launch: {
          ...handlers.getWorkflowSettings(workflow.id).browser_launch,
          fingerprint_overrides_enabled: true,
          user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148",
          mobile: false,
          touch: false,
        },
      }),
    ).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "mobile",
        level: "warning",
        message: "Mobile user agents should use mobile viewport and touch settings",
      }),
    );

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

  test("exports sanitized packages and imports selected flow/settings as a new workflow", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Export me");
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        proxy_password: "secret",
        proxy_server: "http://agent:secret@proxy.owned.test:8080",
        preflight_enabled: true,
        preflight_probe_url: "https://probe.owned.test/verdict?token=secret",
        preflight_allowed_origins: ["https://probe.owned.test"],
      },
    });

    const packageValue = handlers.exportWorkflowPackage(workflow.id, {
      include_flow: true,
      settings_sections: ["general", "browser_launch", "environment"],
    });

    expect(packageValue.settings?.browser_launch?.proxy_password).toBeNull();
    expect(packageValue.settings?.browser_launch?.proxy_server).toBe(
      "http://proxy.owned.test:8080/",
    );
    expect(packageValue.settings?.browser_launch?.preflight_probe_url).toBe(
      "https://probe.owned.test/verdict",
    );
    expect(packageValue.omitted_fields).toEqual(
      expect.arrayContaining([
        "settings.browser_launch.proxy_password",
        "settings.browser_launch.proxy_server.credentials",
        "settings.browser_launch.preflight_probe_url.search",
      ]),
    );
    expect(
      handlers.previewWorkflowPackage({
        ...packageValue,
        included_sections: ["settings.general", "settings.unknown_section"],
        settings: {
          ...packageValue.settings,
          unknown_section: {
            probe_url: "https://example.test/probe",
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

  test("rejects malformed workflow package payloads with command errors", async () => {
    const { handlers } = await createTestHandlers();

    expect(() =>
      handlers.previewWorkflowPackage(null as unknown as WorkflowPackage),
    ).toThrow(expect.objectContaining({
      message: "Unsupported workflow package",
      field: "package",
    }));
    expect(() =>
      handlers.previewWorkflowPackage({
        kind: "workflow_package",
        version: 2,
        workflow: null,
        included_sections: [],
        omitted_fields: [],
        flow: null,
        settings: null,
      } as unknown as WorkflowPackage),
    ).toThrow(expect.objectContaining({
      message: "Workflow package name is required",
      field: "package.workflow.name",
    }));
    expect(() =>
      handlers.previewWorkflowPackage({
        kind: "workflow_package",
        version: 2,
        workflow: { name: "Package" },
        omitted_fields: [],
        flow: null,
        settings: null,
      } as unknown as WorkflowPackage),
    ).toThrow(expect.objectContaining({
      message: "Workflow package sections are required",
      field: "package.included_sections",
    }));
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

  test("escapes selector suggestion attribute values", async () => {
    const { handlers } = await createTestHandlers();

    expect(
      handlers.suggestSelectors({
        tag: "button",
        id: "save:primary",
        test_id: 'save"primary',
        text: "Save",
        classes: [],
        attributes: {},
      })[0],
    ).toMatchObject({
      selector_type: "test_id",
      selector: '[data-testid="save\\"primary"]',
    });
    expect(
      handlers.suggestSelectors({
        tag: "button",
        id: 'save"primary',
        test_id: null,
        text: "Save",
        classes: [],
        attributes: {},
      })[0],
    ).toMatchObject({
      selector_type: "id",
      selector: '[id="save\\"primary"]',
    });
  });

  test("normalizes recorded events into structured target action configs", async () => {
    const { handlers } = await createTestHandlers();

    expect(
      handlers.normalizeRecordedEvents([
        { type: "click", xpath: "//*[@data-testid='save']" },
        { type: "input_text", xpath: "//*[@name='email']", text: "qa@example.test" },
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

  test("rejects unknown recorded event types", async () => {
    const { handlers } = await createTestHandlers();

    expect(() =>
      handlers.normalizeRecordedEvents([
        { type: "hover", xpath: "//*[@data-testid='save']" },
      ] as unknown as Parameters<typeof handlers.normalizeRecordedEvents>[0]),
    ).toThrow(expect.objectContaining({
      message: "Unsupported recorded event type: hover",
      field: "events.type",
    }));
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
        run_from_selected_enabled: true,
      },
      run_policy: {
        ...settings.run_policy,
        browser_retention: "retain",
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
      field: "browser_launch.run_from_selected_enabled",
    });

    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        session_mode: "temporary",
        profile_name: null,
        run_from_selected_enabled: true,
      },
    });
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "Run from selected requires Reuse login session to be enabled",
      field: "browser_launch.session_mode",
    });

    handlers.saveWorkflowSettings(workflow.id, {
      ...handlers.getWorkflowSettings(workflow.id),
      browser_launch: {
        ...handlers.getWorkflowSettings(workflow.id).browser_launch,
        session_mode: "persistent_profile",
        profile_name: handlers.getWorkflowSettings(workflow.id).browser_launch.profile_dir,
        run_from_selected_enabled: true,
      },
      run_policy: {
        ...handlers.getWorkflowSettings(workflow.id).run_policy,
        browser_retention: "close",
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
      },
      browser_launch: {
        ...handlers.getWorkflowSettings(workflow.id).browser_launch,
        run_from_selected_enabled: false,
      },
    });
    await expect(handlers.runWorkflowFromNode(workflow.id, "visit")).rejects.toMatchObject({
      message: "Run from selected must be enabled in Workflow Settings",
      field: "browser_launch.run_from_selected_enabled",
    });

    handlers.saveWorkflowSettings(workflow.id, {
      ...handlers.getWorkflowSettings(workflow.id),
      browser_launch: {
        ...handlers.getWorkflowSettings(workflow.id).browser_launch,
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
        run_from_selected_enabled: true,
      },
      run_policy: {
        ...settings.run_policy,
        browser_retention: "retain",
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
});

describe("Electron workflow schedule commands", () => {
  test("creates disabled draft schedules and enables only runnable workflows", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Scheduled workflow");

    const draft = handlers.createSchedule({
      workflow_id: workflow.id,
      name: "Hourly",
      enabled: false,
      kind: { type: "interval", every_seconds: 3600 },
    });

    expect(draft).toMatchObject({
      workflow_id: workflow.id,
      workflow_name: "Scheduled workflow",
      name: "Hourly",
      enabled: false,
      next_run_at: null,
    });
    expect(() => handlers.enableSchedule(draft.id)).toThrow(
      "Choose an action type before running this node",
    );

    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const enabled = await handlers.enableSchedule(draft.id);

    expect(enabled).toMatchObject({
      id: draft.id,
      enabled: true,
      next_run_at: expect.any(String),
    });
    expect(handlers.listSchedules()).toEqual([
      expect.objectContaining({
        id: draft.id,
        enabled: true,
        workflow_name: "Scheduled workflow",
      }),
    ]);
  });

  test("validates schedule config and returns field-addressable issues", async () => {
    const { handlers } = await createTestHandlers();

    expect(
      handlers.validateSchedule({
        workflow_id: "",
        name: "",
        enabled: true,
        kind: { type: "calendar", preset: "weekly", weekdays: [], time: "25:00" },
      }),
    ).toEqual([
      { field: "workflow_id", message: "Workflow is required", level: "error" },
      { field: "name", message: "Schedule name is required", level: "error" },
      {
        field: "kind.weekdays",
        message: "Select at least one weekday",
        level: "error",
      },
      {
        field: "kind.time",
        message: "Use a valid HH:mm time",
        level: "error",
      },
    ]);
  });

  test("scheduler tick skips profile conflicts but can start isolated workflows", async () => {
    let activeRunSignal: AbortSignal | null = null;
    const startedRunSignals: AbortSignal[] = [];
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: { signal?: AbortSignal }): Promise<RunState> {
          activeRunSignal = request.signal ?? null;
          startedRunSignals.push(request.signal as AbortSignal);
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
    const runningWorkflow = handlers.createWorkflow("Running workflow");
    handlers.saveWorkflowGraph(runningWorkflow.id, runnableGraph());
    const scheduledWorkflow = handlers.createWorkflow("Scheduled workflow");
    handlers.saveWorkflowGraph(scheduledWorkflow.id, runnableGraph());
    const isolatedWorkflow = handlers.createWorkflow("Isolated workflow");
    handlers.saveWorkflowGraph(isolatedWorkflow.id, runnableGraph());
    const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const schedule = handlers.createSchedule({
      workflow_id: scheduledWorkflow.id,
      name: "Once",
      enabled: true,
      kind: { type: "once_at", timestamp: dueAt },
    });
    const isolatedSchedule = handlers.createSchedule({
      workflow_id: isolatedWorkflow.id,
      name: "Isolated",
      enabled: true,
      kind: { type: "once_at", timestamp: dueAt },
    });
    const runningSettings = handlers.getWorkflowSettings(runningWorkflow.id);
    const scheduledSettings = handlers.getWorkflowSettings(scheduledWorkflow.id);
    handlers.saveWorkflowSettings(scheduledWorkflow.id, {
      ...scheduledSettings,
      browser_launch: {
        ...scheduledSettings.browser_launch,
        profile_dir: runningSettings.browser_launch.profile_dir,
        profile_name: runningSettings.browser_launch.profile_name,
      },
    });
    makeTemporary(handlers, isolatedWorkflow.id);

    const runPromise = handlers.runWorkflow(runningWorkflow.id);
    await waitFor(() => activeRunSignal !== null);
    await handlers.runSchedulerTick(new Date(dueAt));

    expect(handlers.listScheduleEvents({ schedule_id: schedule.id })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "skipped",
          reason: "active_profile",
          scheduled_for: dueAt,
        }),
        expect.objectContaining({
          event_type: "disabled",
          reason: "one_time_elapsed",
        }),
      ]),
    );
    expect(handlers.getSchedule(schedule.id)).toMatchObject({
      enabled: false,
      next_run_at: null,
      last_status: "disabled",
    });
    expect(handlers.listScheduleEvents({ schedule_id: isolatedSchedule.id })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "started",
          scheduled_for: dueAt,
        }),
      ]),
    );
    expect(startedRunSignals).toHaveLength(2);

    for (const snapshot of handlers.listRunStates().filter((item) => item.state.status === "running")) {
      await handlers.stopRun(snapshot.run_id);
    }
    await runPromise;
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

async function waitForRunSnapshotStatus(
  handlers: { listRunStates(): Array<{ run_id: string; state: RunState }> },
  runId: string,
  status: RunState["status"],
) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const state = handlers.listRunStates().find((snapshot) => snapshot.run_id === runId)?.state;
    if (state?.status === status) return state;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error(`Timed out waiting for run ${runId} status ${status}`);
}

async function waitFor(predicate: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
  throw new Error("Timed out waiting for predicate");
}

function makeTemporary(
  handlers: Awaited<ReturnType<typeof createTestHandlers>>["handlers"],
  workflowId: string,
) {
  const settings = handlers.getWorkflowSettings(workflowId);
  handlers.saveWorkflowSettings(workflowId, {
    ...settings,
    browser_launch: {
      ...settings.browser_launch,
      session_mode: "temporary",
      profile_name: null,
    },
  });
}
