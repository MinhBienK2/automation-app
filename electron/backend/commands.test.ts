// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test, vi } from "vitest";
import {
  createWorkflowCommandHandlers,
  deriveFingerprintSeedFromIdentityId,
  finishRun,
  serializeCommandError,
} from "./commands";
import {
  createAppPaths,
  initializeDatabase,
  type AppPaths,
} from "./persistence/database";
import type {
  ActionConfig,
  CompiledWorkflowGraph,
  GraphNodeType,
  RunState,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowSettings,
} from "../../src/types/workflow";
import type {
  BrowserDriver,
  BrowserDriverContext,
  BrowserDriverPage,
} from "./browser/sessionManager";

vi.mock("electron", () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

const tempRoots: string[] = [];

type ProjectWorkflow = {
  id: string;
  name: string;
  project_id: string;
  environment_id: string;
};

type TestProject = {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type TestProjectEnvironment = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  is_default: boolean;
  browser_launch: WorkflowSettings["browser_launch"];
  created_at: string;
  updated_at: string;
};

type TestSubflow = {
  id: string;
  project_id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
};

type ProjectWorkflowTestHandlers = {
  listProjects(): TestProject[];
  createProject(input: { name: string; description?: string | null }): TestProject;
  listProjectEnvironments(projectId: string): TestProjectEnvironment[];
  createProjectEnvironment(
    projectId: string,
    input: {
      name: string;
      description?: string | null;
      browser_launch?: WorkflowSettings["browser_launch"];
      is_default?: boolean;
    },
  ): TestProjectEnvironment;
  setWorkflowEnvironment(workflowId: string, environmentId: string): ProjectWorkflow;
  createSubflow(projectId: string, input: { name: string; description?: string | null }): TestSubflow;
  listSubflows(projectId: string): Array<TestSubflow & { used_by_count: number }>;
  getSubflowGraph(subflowId: string): WorkflowGraph;
  saveSubflowGraph(subflowId: string, graph: WorkflowGraph): void;
  duplicateSubflow(subflowId: string, name: string): TestSubflow;
  deleteSubflow(subflowId: string): void;
  getSubflowUsage(subflowId: string): Array<{ workflow_id: string; workflow_name: string }>;
};

afterEach(async () => {
  vi.useRealTimers();
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
    const persistedSettings = JSON.parse(row?.settings_json ?? "{}");
    expect(persistedSettings).toMatchObject({
      browser_launch: {
        session_mode: "persistent_profile",
        identity_id: expect.stringMatching(/^bi_/),
        display_name: "Login flow identity",
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

  test("creates a default project and project environment for new workflows", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;

    const projects = projectHandlers.listProjects();
    expect(projects).toEqual([
      expect.objectContaining({
        name: "Default Project",
      }),
    ]);

    const project = projects[0];
    const environments = projectHandlers.listProjectEnvironments(project.id);
    expect(environments).toEqual([
      expect.objectContaining({
        project_id: project.id,
        name: "Project Default Environment",
        is_default: true,
      }),
    ]);

    const workflow = handlers.createWorkflow("Environment-aware workflow");
    const listRow = handlers.listWorkflows().find((item) => item.id === workflow.id);

    expect(workflow).toMatchObject({
      project_id: project.id,
      environment_id: expect.any(String),
    });
    expect(workflow.environment_id).not.toBe(environments[0].id);
    expect(listRow).toMatchObject({
      project_id: project.id,
      environment_id: workflow.environment_id,
      environment_name: "Environment-aware workflow isolated environment",
    });
  });

  test("runs workflows with the selected project environment browser launch settings", async () => {
    const runner = {
      run: vi.fn(async () => ({
        status: "success" as const,
        mode: "run_workflow" as const,
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["visit"],
        outputs: {},
        error: null,
      })),
      getRetainedSessionState: vi.fn(),
      getRetainedSessionStates: vi.fn(() => []),
    };
    const { handlers } = await createTestHandlers({ runner });
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow = handlers.createWorkflow("Environment run") as ProjectWorkflow;
    const projectId = workflow.project_id;
    const defaultEnvironment = projectHandlers.listProjectEnvironments(projectId)[0];
    const selectedEnvironment = projectHandlers.createProjectEnvironment(projectId, {
      name: "Proxy identity",
      description: "Project-level browser posture",
      browser_launch: {
        ...defaultEnvironment.browser_launch,
        headless: true,
        proxy_enabled: true,
        proxy_server: "http://proxy.internal:8080",
        timezone: "Asia/Ho_Chi_Minh",
        locale: "vi-VN",
      },
    });
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    projectHandlers.setWorkflowEnvironment(workflow.id, selectedEnvironment.id);
    await handlers.runWorkflow(workflow.id);

    expect(runner.run).toHaveBeenCalledWith(
      expect.objectContaining({
        settings: expect.objectContaining({
          browser_launch: expect.objectContaining({
            proxy_enabled: true,
            proxy_server: "http://proxy.internal:8080",
            timezone: "Asia/Ho_Chi_Minh",
            locale: "vi-VN",
            headless: true,
          }),
        }),
      }),
    );
  });

  test("persists subflows, reports workflow usage, duplicates safely, and blocks used deletion", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow = handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow = projectHandlers.createSubflow(workflow.project_id, {
      name: "Login",
      description: "Reusable login fragment",
    });
    const subflowGraph = subflowGraphWithAction("fill-username", "Fill username");

    projectHandlers.saveSubflowGraph(subflow.id, subflowGraph);
    handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    expect(projectHandlers.listSubflows(workflow.project_id)).toEqual([
      expect.objectContaining({
        id: subflow.id,
        project_id: workflow.project_id,
        name: "Login",
        used_by_count: 1,
      }),
    ]);
    expect(projectHandlers.getSubflowUsage(subflow.id)).toEqual([
      expect.objectContaining({
        workflow_id: workflow.id,
        workflow_name: "Checkout E2E",
      }),
    ]);
    expect(() => projectHandlers.deleteSubflow(subflow.id)).toThrow(
      "Subflow is used by 1 workflow",
    );

    const duplicated = projectHandlers.duplicateSubflow(subflow.id, "Login copy");
    expect(duplicated).toMatchObject({
      project_id: workflow.project_id,
      name: "Login copy",
    });
    expect(projectHandlers.getSubflowGraph(duplicated.id)).toEqual({
      ...subflowGraph,
      migration_notes: [],
    });
  });

  test("validates and expands Call Subflow nodes inside the caller run plan", async () => {
    const runner = {
      run: vi.fn(async () => ({
        status: "success" as const,
        mode: "run_workflow" as const,
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: ["call-login"],
        outputs: {},
        error: null,
      })),
      getRetainedSessionState: vi.fn(),
      getRetainedSessionStates: vi.fn(() => []),
    };
    const { handlers } = await createTestHandlers({ runner });
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow = handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow = projectHandlers.createSubflow(workflow.project_id, { name: "Login" });
    projectHandlers.saveSubflowGraph(
      subflow.id,
      subflowGraphWithAction("fill-username", "Fill username"),
    );
    handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    expect(handlers.validateWorkflowRun(workflow.id).filter((issue) => issue.level === "error"))
      .toEqual([]);
    await handlers.runWorkflow(workflow.id);

    const compiledGraph = runner.run.mock.calls[0][0].graph as CompiledWorkflowGraph;
    expect(compiledGraph.steps).toEqual([
      expect.objectContaining({
        node_id: "call-login::__inputs",
        label: "Checkout E2E > Login > Inputs",
        config: {
          type: "set_variable",
          config: expect.objectContaining({
            variables: [
              {
                name: "username",
                value_type: "text",
                value: "{{account.username}}",
              },
            ],
          }),
        },
      }),
      expect.objectContaining({
        node_id: "call-login::fill-username",
        label: "Checkout E2E > Login > Fill username",
        config: { type: "input_text", config: expect.objectContaining({ text: "{{username}}" }) },
      }),
    ]);
  });

  test("blocks missing, cross-project, and invalid Call Subflow references before run", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const firstWorkflow = handlers.createWorkflow("First project workflow") as ProjectWorkflow;
    const secondProject = projectHandlers.createProject({ name: "Second Project" });
    const crossProjectSubflow = projectHandlers.createSubflow(secondProject.id, {
      name: "Other Project Login",
    });
    projectHandlers.saveSubflowGraph(
      crossProjectSubflow.id,
      subflowGraphWithAction("other-step", "Other step"),
    );

    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow("missing-subflow"),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Call Subflow references a missing subflow",
      }),
    );

    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow(crossProjectSubflow.id),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Call Subflow must reference a subflow in the same project",
      }),
    );

    const invalidSubflow = projectHandlers.createSubflow(firstWorkflow.project_id, {
      name: "Invalid Login",
    });
    projectHandlers.saveSubflowGraph(invalidSubflow.id, startOnlyGraph());
    handlers.saveWorkflowGraph(
      firstWorkflow.id,
      workflowGraphCallingSubflow(invalidSubflow.id),
    );
    expect(handlers.validateWorkflowRun(firstWorkflow.id)).toContainEqual(
      expect.objectContaining({
        source: "graph",
        node_id: "call-login",
        level: "error",
        message: "Referenced subflow has blocking validation errors",
      }),
    );
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

  test("duplicates workflow with a fresh browser identity and session profile", async () => {
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
        notes: "Keep local credentials while making a fresh duplicate identity.",
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
      notes: "Keep local credentials while making a fresh duplicate identity.",
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
      display_name: "Copy of Source identity",
      profile_name: copiedSettings.browser_launch.profile_dir,
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

  test("rotates browser identity through backend-owned high-entropy generation", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Identity reset");
    const settings = handlers.getWorkflowSettings(workflow.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "identity-fonts-"));
    tempRoots.push(fontsDir);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        run_from_selected_enabled: true,
      },
      browser_launch: {
        ...settings.browser_launch,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        timezone: "America/New_York",
        locale: "en-US",
        fingerprint_fonts_dir: fontsDir,
      },
    });

    const rotated = handlers.resetWorkflowBrowserIdentity(workflow.id);

    expect(rotated.browser_launch.identity_id).toMatch(/^bi_[a-f0-9]{32}$/);
    expect(rotated.browser_launch.identity_id).not.toBe(settings.browser_launch.identity_id);
    expect(rotated.browser_launch.profile_dir).toBe(rotated.browser_launch.identity_id);
    expect(rotated.browser_launch.profile_name).toBe(rotated.browser_launch.identity_id);
    expect(rotated.browser_launch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(rotated.browser_launch.fingerprint_seed).toBe(
      deriveFingerprintSeedFromIdentityId(rotated.browser_launch.identity_id),
    );
    expect(rotated.run_policy.run_from_selected_enabled).toBe(false);
    expect(rotated.browser_launch.proxy_enabled).toBe(true);
    expect(rotated.browser_launch.proxy_server).toBe("http://proxy.local:8080");
    expect(rotated.browser_launch.timezone).toBe("America/New_York");
    expect(rotated.browser_launch.locale).toBe("en-US");
    expect(rotated.browser_launch.fingerprint_fonts_dir).toBe(fontsDir);
    expect(rotated.migration_notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "browser_launch.identity_id",
          action: "rotated",
          message: expect.stringContaining(settings.browser_launch.identity_id),
        }),
      ]),
    );
    expect(handlers.getWorkflowSettings(workflow.id).browser_launch.identity_id)
      .toBe(rotated.browser_launch.identity_id);
  });

  test("builds Identity Lab overview from current identity snapshots and closes retained sessions", async () => {
    const closeRetainedSession = vi.fn(async () => undefined);
    const { handlers, database } = await createTestHandlers({
      runner: {
        run: vi.fn(),
        closeRetainedSession,
        getRetainedSessionState: vi.fn((workflowId?: string | null, profileName?: string | null) => ({
          available: workflowId === "workflow-identity" && profileName === "profile-current",
          workflow_id: workflowId ?? null,
          profile_name: profileName ?? null,
          reason: workflowId === "workflow-identity" ? null : "No retained session",
        })),
        getRetainedSessionStates: vi.fn(() => [
          {
            available: true,
            workflow_id: "workflow-identity",
            profile_name: "profile-current",
            reason: null,
          },
        ]),
      },
    });
    const workflow = handlers.createWorkflow("Identity flow");
    database.prepare("UPDATE workflows SET id = ? WHERE id = ?").run("workflow-identity", workflow.id);
    const settings = handlers.getWorkflowSettings("workflow-identity");
    handlers.saveWorkflowSettings("workflow-identity", {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        identity_id: "bi_current",
        display_name: "Current identity",
        profile_dir: "profile-current",
        profile_name: "profile-current",
        persona: {
          ...settings.browser_launch.persona,
          label: "Windows Chrome",
        },
        proxy_enabled: true,
        proxy_server: "http://user:secret@proxy.local:8080",
      },
      migration_notes: [
        {
          path: "browser_launch.identity_id",
          action: "rotated",
          message: "Browser identity rotated from bi_old to bi_current at 2026-05-27T08:00:00.000Z",
        },
      ],
    });
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at,
          settings_snapshot_json, outputs_json, error_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-old",
        "workflow-identity",
        "manual",
        "success",
        "2026-05-27T07:00:00.000Z",
        "2026-05-27T07:01:00.000Z",
        JSON.stringify({ browser_launch: { identity_id: "bi_old", display_name: "Old identity" } }),
        JSON.stringify({ browser_identity: { identity_id: "bi_old" } }),
        null,
      );
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at,
          settings_snapshot_json, outputs_json, error_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-current",
        "workflow-identity",
        "manual",
        "failed",
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        JSON.stringify({
          browser_launch: { identity_id: "bi_current", display_name: "Current identity" },
        }),
        JSON.stringify({
          browser_identity: {
            identity_id: "bi_current",
            display_name: "Current identity",
            fingerprint_seed_hash: "seed-hash",
            proxy_password: "should-not-leak",
          },
          __evidence: [
            {
              artifact_kind: "screenshot",
              path: "runs/run-current/screenshots/one.png",
            },
            {
              artifact_kind: "download",
              path: "runs/run-current/downloads/two.csv",
            },
            {
              artifact_kind: "screenshot",
              path: "C:Users\\operator\\secret.png",
            },
          ],
        }),
        JSON.stringify({ reason: "Assertion failed" }),
      );

    const overview = await handlers.getIdentityLabOverview();

    expect(overview.counts).toMatchObject({
      managed_identities: 1,
      active_retained_sessions: 1,
      identities_with_recent_failures: 1,
    });
    expect(overview.items).toEqual([
      expect.objectContaining({
        workflow_ref: { id: "workflow-identity", name: "Identity flow" },
        identity_ref: { id: "bi_current", display_name: "Current identity" },
        retained_session: { active: true },
        last_run: expect.objectContaining({ run_id: "run-current", status: "failed" }),
        recent_failures_24h: 1,
      }),
    ]);
    expect(overview.selected).toMatchObject({
      kind: "managed",
      latest_observed: expect.objectContaining({
        run_id: "run-current",
        fields: expect.arrayContaining([{ key: "fingerprint_seed_hash", value: "seed-hash" }]),
      }),
      rotation_history: [expect.objectContaining({ previous_identity_id: "bi_old" })],
      evidence_summary: { total: 2 },
      actions: {
        can_close_retained_session: true,
        can_reset_identity: false,
      },
    });
    expect(JSON.stringify(overview)).not.toContain("secret");
    expect(JSON.stringify(overview)).not.toContain("should-not-leak");

    await handlers.closeIdentityRetainedSession("workflow-identity", "profile-current");
    expect(closeRetainedSession).toHaveBeenCalledWith("workflow-identity", "profile-current");
  });

  test("resolves stale managed identity targets with historical run context", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Rotated identity flow");
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        identity_id: "bi_current",
        display_name: "Current identity",
      },
    });
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at,
          settings_snapshot_json, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-old-identity",
        workflow.id,
        "manual",
        "success",
        "2026-05-27T07:00:00.000Z",
        "2026-05-27T07:01:00.000Z",
        JSON.stringify({
          browser_launch: { identity_id: "bi_old", display_name: "Old identity" },
        }),
        JSON.stringify({
          browser_identity: {
            identity_id: "bi_old",
            display_name: "Old identity",
            fingerprint_seed_hash: "old-seed",
          },
        }),
      );

    const overview = await handlers.getIdentityLabOverview({
      selected_target: {
        type: "managed",
        workflow_id: workflow.id,
        identity_id: "bi_old",
      },
    });

    expect(overview.selected).toMatchObject({
      kind: "historical",
      workflow_ref: { id: workflow.id, name: "Rotated identity flow" },
      run_id: "run-old-identity",
      observed_fields: expect.arrayContaining([
        { key: "identity_id", value: "bi_old" },
        { key: "fingerprint_seed_hash", value: "old-seed" },
      ]),
    });
  });

  test("resolves historical identities older than the newest 200 workflow runs", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Long identity archive");
    const insertRun = database.prepare(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at,
        settings_snapshot_json, outputs_json
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    insertRun.run(
      "run-archived-identity",
      workflow.id,
      "manual",
      "success",
      "2026-01-01T07:00:00.000Z",
      "2026-01-01T07:01:00.000Z",
      JSON.stringify({ browser_launch: { identity_id: "bi_archived" } }),
      JSON.stringify({ browser_identity: { identity_id: "bi_archived" } }),
    );
    for (let index = 0; index < 200; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 0)).toISOString();
      const finishedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 30)).toISOString();
      insertRun.run(
        `run-new-identity-${index}`,
        workflow.id,
        "manual",
        "success",
        startedAt,
        finishedAt,
        JSON.stringify({ browser_launch: { identity_id: "bi_current" } }),
        JSON.stringify({ browser_identity: { identity_id: "bi_current" } }),
      );
    }

    const overview = await handlers.getIdentityLabOverview({
      selected_target: {
        type: "historical",
        workflow_id: workflow.id,
        identity_id: "bi_archived",
      },
    });

    expect(overview.selected).toMatchObject({
      kind: "historical",
      run_id: "run-archived-identity",
      observed_fields: expect.arrayContaining([{ key: "identity_id", value: "bi_archived" }]),
    });
  });

  test("derives historical identity workflow context from the matched run", async () => {
    const { handlers, database } = await createTestHandlers();
    const historicalWorkflow = handlers.createWorkflow("Historical identity source");
    const otherWorkflow = handlers.createWorkflow("Unrelated current workflow");
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at,
          settings_snapshot_json, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-cross-workflow-history",
        historicalWorkflow.id,
        "manual",
        "success",
        "2026-05-27T07:00:00.000Z",
        "2026-05-27T07:01:00.000Z",
        JSON.stringify({ browser_launch: { identity_id: "bi_cross_history" } }),
        JSON.stringify({ browser_identity: { identity_id: "bi_cross_history" } }),
      );

    const overview = await handlers.getIdentityLabOverview({
      selected_target: {
        type: "historical",
        workflow_id: otherWorkflow.id,
        identity_id: "bi_cross_history",
        run_id: "run-cross-workflow-history",
      },
    });

    expect(overview.selected).toMatchObject({
      kind: "historical",
      workflow_ref: { id: historicalWorkflow.id, name: "Historical identity source" },
      run_id: "run-cross-workflow-history",
    });
  });

  test("derives deterministic CloakBrowser seeds and probes collisions", () => {
    const identityId = "bi_11111111111111111111111111111111";
    const firstSeed = deriveFingerprintSeedFromIdentityId(identityId);

    expect(firstSeed).toMatch(/^\d{5}$/);
    expect(deriveFingerprintSeedFromIdentityId(identityId)).toBe(firstSeed);
    expect(deriveFingerprintSeedFromIdentityId(identityId, new Set([firstSeed])))
      .not.toBe(firstSeed);
    expect(deriveFingerprintSeedFromIdentityId(identityId, new Set([firstSeed])))
      .toMatch(/^\d{5}$/);
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
        "run-diagnostics",
        workflow.id,
        "success",
        "2026-05-15T00:00:00.000Z",
        "2026-05-15T00:00:02.000Z",
        JSON.stringify({ browser_identity: { identity_id: "bi_qa" } }),
      );

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.wrapper_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(diagnostics.binary.version).toMatch(/^\d+/);
    expect(diagnostics.binary.platform).toBeTruthy();
    expect(typeof diagnostics.binary.installed).toBe("boolean");
    expect(diagnostics.profile_root).toBe(appPaths.browserProfilesDir);
    expect(diagnostics.geoip_available).toBe(true);
    expect(diagnostics.font_checklist).toMatchObject({
      status: "not_configured",
      reason: "No workflow has a fingerprint fonts directory configured",
      directories: [],
    });
    expect(diagnostics.last_smoke_result).toEqual({
      status: "not_recorded",
      reason: "Smoke tests are recorded by the npm run test:smoke command output",
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

  test("reports configured fingerprint font directory hash and expected family coverage", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Font diagnostics");
    const settings = handlers.getWorkflowSettings(workflow.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "font-diagnostics-"));
    tempRoots.push(fontsDir);
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    await fs.writeFile(path.join(fontsDir, "NotoSans-Regular.otf"), "noto");
    await fs.writeFile(path.join(fontsDir, "CourierNew.ttf"), "courier");
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        fingerprint_fonts_dir: fontsDir,
      },
    });

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.font_checklist.status).toBe("ok");
    expect(diagnostics.font_checklist.directories).toEqual([
      expect.objectContaining({
        path: fontsDir,
        status: "ok",
        file_count: 3,
        total_size_bytes: 16,
        normalized_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expected_families_present: expect.arrayContaining(["arial", "courier", "noto"]),
        missing_expected_families: [],
        workflow_ids: [workflow.id],
      }),
    ]);
  });

  test("reports missing and shared fingerprint font directories as actionable diagnostics", async () => {
    const { handlers, database } = await createTestHandlers();
    const owner = handlers.createWorkflow("Font owner");
    const shared = handlers.createWorkflow("Font shared");
    const missing = handlers.createWorkflow("Font missing");
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "shared-fonts-"));
    tempRoots.push(fontsDir);
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    await fs.writeFile(path.join(fontsDir, "NotoSans-Regular.otf"), "noto");
    await fs.writeFile(path.join(fontsDir, "CourierNew.ttf"), "courier");
    const ownerSettings = handlers.getWorkflowSettings(owner.id);
    const sharedSettings = handlers.getWorkflowSettings(shared.id);
    const missingSettings = handlers.getWorkflowSettings(missing.id);
    handlers.saveWorkflowSettings(owner.id, {
      ...ownerSettings,
      browser_launch: {
        ...ownerSettings.browser_launch,
        fingerprint_fonts_dir: fontsDir,
      },
    });
    handlers.saveWorkflowSettings(shared.id, {
      ...sharedSettings,
      browser_launch: {
        ...sharedSettings.browser_launch,
        fingerprint_fonts_dir: fontsDir,
      },
    });
    database
      .prepare("UPDATE project_environments SET browser_launch_json = ? WHERE id = ?")
      .run(
        JSON.stringify({
          ...missingSettings.browser_launch,
          fingerprint_fonts_dir: path.join(os.tmpdir(), "missing-font-bundle"),
        }),
        String(missing.environment_id),
      );

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.font_checklist.status).toBe("error");
    expect(diagnostics.font_checklist.reason).toContain("missing");
    expect(diagnostics.font_checklist.directories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: fontsDir,
          status: "warning",
          workflow_ids: expect.arrayContaining([owner.id, shared.id]),
          reason: expect.stringContaining("shared"),
        }),
        expect.objectContaining({
          status: "missing",
          reason: expect.stringContaining("not readable"),
          workflow_ids: [missing.id],
        }),
      ]),
    );
  });

  test("caps browser profile size traversal during diagnostics", async () => {
    const previousLimit = process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES;
    process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES = "1";
    try {
      const { handlers, appPaths } = await createTestHandlers();
      const workflow = handlers.createWorkflow("Large profile diagnostics");
      const profileDir = handlers.getWorkflowSettings(workflow.id).browser_launch.profile_dir;
      const profilePath = path.join(appPaths.browserProfilesDir, profileDir);
      await fs.mkdir(profilePath, { recursive: true });
      await fs.writeFile(path.join(profilePath, "a.bin"), "a".repeat(100));
      await fs.writeFile(path.join(profilePath, "b.bin"), "b".repeat(100));

      const diagnostics = await handlers.getCloakBrowserDiagnostics();
      const profile = diagnostics.profiles.find((candidate) => candidate.profile_dir === profileDir);

      expect(profile?.approximate_size_bytes).toBeLessThan(200);
    } finally {
      if (previousLimit === undefined) {
        delete process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES;
      } else {
        process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES = previousLimit;
      }
    }
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

  test("rejects backend identity rotation while a retained browser session owns the profile", async () => {
    const runner = {
      run: vi.fn(),
      getRetainedSessionState: vi.fn(),
      getRetainedSessionStates: vi.fn(() => []),
      hasReusableRetainedSession: vi.fn(() => true),
    };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = handlers.createWorkflow("Active reset");
    const settings = handlers.getWorkflowSettings(workflow.id);
    runner.getRetainedSessionState.mockReturnValue({
      available: true,
      workflow_id: workflow.id,
      profile_name: settings.browser_launch.profile_dir,
      reason: null,
    });

    expect(() => handlers.resetWorkflowBrowserIdentity(workflow.id)).toThrow(
      "Close the retained browser session before resetting this browser identity",
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

  test("exports sanitized packages and imports selected flow/settings as a new workflow", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Export me");
    const settings = handlers.getWorkflowSettings(workflow.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "export-fonts-"));
    tempRoots.push(fontsDir);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        proxy_password: "secret",
        proxy_server: "http://agent:secret@proxy.owned.test:8080",
        fingerprint_fonts_dir: fontsDir,
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
    expect(packageValue.settings?.browser_launch?.fingerprint_fonts_dir).toBeNull();
    expect(packageValue.settings?.browser_launch).not.toHaveProperty("preflight_probe_url");
    expect(packageValue.omitted_fields).toEqual(
      expect.arrayContaining([
        "settings.browser_launch.proxy_password",
        "settings.browser_launch.proxy_server.credentials",
        "settings.browser_launch.fingerprint_fonts_dir",
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

  test("exports referenced subflows and remaps Call Subflow ids on package import", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const workflow = handlers.createWorkflow("Checkout E2E") as ProjectWorkflow;
    const subflow = projectHandlers.createSubflow(workflow.project_id, { name: "Login" });
    const subflowGraph = subflowGraphWithAction("fill-username", "Fill username");
    projectHandlers.saveSubflowGraph(subflow.id, subflowGraph);
    handlers.saveWorkflowGraph(workflow.id, workflowGraphCallingSubflow(subflow.id));

    const packageValue = handlers.exportWorkflowPackage(workflow.id, {
      include_flow: true,
      settings_sections: [],
    });

    expect(packageValue.included_sections).toContain("subflows");
    expect(packageValue.subflows).toEqual([
      expect.objectContaining({
        id: subflow.id,
        project_id: workflow.project_id,
        name: "Login",
      }),
    ]);

    const imported = handlers.importWorkflowPackage(
      {
        ...packageValue,
        workflow: { ...packageValue.workflow, name: "Imported Checkout" },
      },
      {
        include_flow: true,
        settings_sections: [],
      },
    ) as { workflow: ProjectWorkflow };
    const importedGraph = handlers.getWorkflowGraph(imported.workflow.id);
    const importedCallNode = importedGraph.nodes.find(
      (node) => node.node_type === "call_subflow",
    );
    const importedSubflowId = (importedCallNode?.config as { subflow_id?: string } | null)
      ?.subflow_id;

    expect(importedSubflowId).toEqual(expect.any(String));
    expect(importedSubflowId).not.toBe(subflow.id);
    expect(projectHandlers.getSubflowGraph(importedSubflowId ?? "")).toEqual({
      ...subflowGraph,
      migration_notes: [],
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

    const unknownNodePackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Unknown Node" },
      included_sections: ["flow"],
      omitted_fields: [],
      flow: {
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
            id: "unknown",
            node_type: "sidequest" as WorkflowGraph["nodes"][number]["node_type"],
            label: "Unknown",
            position: { x: 100, y: 0 },
            config: {},
            ports: [
              { id: "in", label: "In", direction: "input" },
              { id: "out", label: "Out", direction: "output" },
            ],
          },
        ],
        edges: [edgeForPackage("start", "out", "unknown", "in")],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      settings: null,
    };
    expect(() =>
      handlers.importWorkflowPackage(unknownNodePackage, {
        include_flow: true,
        settings_sections: [],
      }),
    ).toThrow(expect.objectContaining({
      message: "Unsupported graph node type: sidequest",
      field: "package.flow",
    }));
    expect(handlers.listWorkflows()).toHaveLength(initialCount);

    const unknownActionPackage: WorkflowPackage = {
      ...unknownNodePackage,
      workflow: { name: "Unknown Action" },
      flow: {
        ...unknownNodePackage.flow!,
        nodes: unknownNodePackage.flow!.nodes.map((node) =>
          node.id === "unknown"
            ? {
                ...node,
                node_type: "action",
                config: { type: "mystery_action", config: {} },
              }
            : node,
        ),
      },
    };
    expect(() =>
      handlers.importWorkflowPackage(unknownActionPackage, {
        include_flow: true,
        settings_sections: [],
      }),
    ).toThrow(expect.objectContaining({
      message: "Node Unknown has invalid action config: Unsupported action type: mystery_action",
      field: "package.flow",
    }));
    expect(handlers.listWorkflows()).toHaveLength(initialCount);
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

  test("starts, reports, stops, and discards a new-workflow recording session", async () => {
    const { handlers } = await createTestHandlers();

    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded checkout",
      initial_url: "https://owned.test/checkout",
    });

    expect(session).toMatchObject({
      workflow_id: null,
      mode: "new_workflow",
      status: "recording",
      page_url: "https://owned.test/checkout",
      event_count: 1,
      warnings: [],
    });
    expect(session.id).toMatch(/^rec_/);
    expect(session.browser_identity).toMatchObject({
      identity_id: expect.stringMatching(/^bi_/),
      profile_dir: expect.stringMatching(/^bi_/),
      fingerprint_seed_hash: expect.any(String),
    });
    expect(session.workflow_settings_snapshot).toMatchObject({
      general: { name: "Recorded checkout" },
      browser_launch: {
        identity_id: session.browser_identity.identity_id,
        profile_dir: session.browser_identity.profile_dir,
        proxy_password: null,
      },
    });
    expect(handlers.getRecordingSession(session.id)).toEqual(session);
    expect(handlers.listRecordingEvents(session.id)).toMatchObject([
      {
        kind: "navigation",
        page_url: "https://owned.test/checkout",
      },
    ]);

    const stopped = await handlers.stopRecordingSession(session.id);
    expect(stopped).toMatchObject({
      id: session.id,
      status: "stopped",
      stopped_at: expect.any(String),
    });

    const discarded = await handlers.discardRecordingSession(session.id);
    expect(discarded).toMatchObject({
      id: session.id,
      status: "discarded",
    });
    expect(() => handlers.getRecordingSession(session.id)).toThrow("Recording session not found");
  });

  test("starts replace-current-graph recording from saved workflow settings without leaking secrets", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Saved identity");
    const settings = handlers.getWorkflowSettings(workflow.id);
    const savedSettings = handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        display_name: "Owned staging account",
        proxy_enabled: true,
        proxy_server: "http://proxy.owned.test:8080",
        proxy_username: "operator",
        proxy_password: "secret",
      },
    });

    const session = await handlers.startRecordingSession({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
    });

    expect(session).toMatchObject({
      workflow_id: workflow.id,
      mode: "replace_current_graph",
      status: "recording",
      event_count: 0,
    });
    expect(session.browser_identity).toMatchObject({
      identity_id: savedSettings.browser_launch.identity_id,
      display_name: "Owned staging account",
      profile_dir: savedSettings.browser_launch.profile_dir,
    });
    expect(session.workflow_settings_snapshot.browser_launch).toMatchObject({
      identity_id: savedSettings.browser_launch.identity_id,
      proxy_enabled: true,
      proxy_server: "http://proxy.owned.test:8080",
      proxy_username: "operator",
      proxy_password: null,
    });
  });

  test("applies safe recorder browser launch overrides to the recording settings snapshot", async () => {
    const context = new FakeRecordingContext(new FakeRecordingPage());
    const driver = new FakeRecordingDriver(context);
    const { handlers } = await createTestHandlers({
      recorderDriver: driver,
    });

    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Headless recorder",
      browser_launch_overrides: { headless: true },
    });

    expect(session.warnings).toEqual([]);
    expect(session.browser_identity.headless).toBe(true);
    expect(session.workflow_settings_snapshot.browser_launch.headless).toBe(true);
    expect(driver.launches[0]?.options).toMatchObject({
      headless: true,
    });
  });

  test("starts a backend-owned recorder browser and collects page interaction events", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const driver = new FakeRecordingDriver(context);
    const { handlers } = await createTestHandlers({
      recorderDriver: driver,
    });

    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
      initial_url: "https://fixture.owned.test/form",
    });
    await page.emitRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        text_sample: "Save",
        locators: [],
      },
      value: null,
      raw: { trusted: true },
      confidence: "high",
      warnings: [],
    });
    await page.emitRecorderPayload({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "email",
        locators: [],
      },
      value: { text: "qa@example.test" },
      raw: {},
      confidence: "high",
      warnings: [],
    });

    const events = handlers.listRecordingEvents(session.id);

    expect(driver.launches).toHaveLength(1);
    expect(page.initScripts).toHaveLength(1);
    expect(page.gotoCalls).toEqual(["https://fixture.owned.test/form"]);
    expect(events.map((event) => event.kind)).toEqual([
      "navigation",
      "click",
      "input",
    ]);
    expect(events[0]).toMatchObject({
      session_id: session.id,
      sequence: 1,
      kind: "navigation",
      page_url: "https://fixture.owned.test/form",
    });
    expect(events[2]).toMatchObject({
      sequence: 3,
      value: { text: "qa@example.test" },
    });

    await handlers.stopRecordingSession(session.id);

    expect(context.closed).toBe(true);
  });

  test("closes the recorder browser when initial navigation fails before session registration", async () => {
    const page = new FakeRecordingPage();
    page.gotoError = new Error("Navigation failed");
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });

    await expect(handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Broken recorder",
      initial_url: "https://fixture.owned.test/fails",
    })).rejects.toThrow("Navigation failed");

    expect(context.closed).toBe(true);
  });

  test("generates a recording draft without persisting a workflow", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers, database } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
      initial_url: "https://fixture.owned.test/form",
    });
    await page.emitRecorderPayload({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "email",
        accessible_name: "Email",
        locators: [
          { kind: "test_id", value: "email", score: 1, reason: "Stable test id" },
        ],
      },
      value: { text: "qa@example.test" },
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);

    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });

    expect(draft).toMatchObject({
      id: expect.stringMatching(/^draft_/),
      session_id: session.id,
      workflow_id: null,
      mode: "new_workflow",
      status: "draft",
      steps: [
        { action: { type: "navigate" } },
        { action: { type: "input_text" } },
      ],
      validation_issues: [],
    });
    expect(draft.graph.nodes.map((node) => node.node_type)).toEqual([
      "start",
      "action",
      "action",
      "end_success",
    ]);
    expect(handlers.getRecordingDraft(draft.id)).toEqual(draft);
    expect(handlers.listWorkflows()).toEqual([]);
    expect(database.prepare("SELECT COUNT(*) AS count FROM workflows").get()).toEqual({
      count: 0,
    });
  });

  test("saves a reviewed new-workflow recording draft with the recorder browser identity", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
      initial_url: "https://fixture.owned.test/form",
    });
    await page.emitRecorderPayload({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "email",
        accessible_name: "Email",
        locators: [
          { kind: "test_id", value: "email", score: 1, reason: "Stable test id" },
        ],
      },
      value: { text: "qa@example.test" },
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });
    const reviewedSteps = draft.steps.map((step, index) => ({
      ...step,
      label: index === 1 ? "Fill recorded email" : step.label,
      included: index !== 0,
    }));

    const saved = handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Saved recording",
      save_mode: "create_new",
      reviewed_steps: reviewedSteps,
      add_terminal_success: true,
    });

    expect(saved.workflow.name).toBe("Saved recording");
    expect(handlers.listWorkflows()).toHaveLength(1);
    expect(handlers.getWorkflowGraph(saved.workflow.id).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Fill recorded email",
          config: expect.objectContaining({ type: "input_text" }),
        }),
      ]),
    );
    expect(
      handlers.getWorkflowGraph(saved.workflow.id).nodes.some((node) =>
        node.config && typeof node.config === "object" && "type" in node.config &&
        node.config.type === "navigate"
      ),
    ).toBe(false);
    expect(handlers.getWorkflowSettings(saved.workflow.id).browser_launch.identity_id)
      .toBe(draft.workflow_settings_snapshot.browser_launch.identity_id);
    expect(() => handlers.getRecordingDraft(draft.id)).toThrow("Recording draft not found");
    expect(() => handlers.getRecordingSession(session.id)).toThrow("Recording session not found");
  });

  test("reconciles reviewed recording steps against the backend draft before saving", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
    });
    await page.emitRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        accessible_name: "Save",
        locators: [
          {
            kind: "role",
            value: "button",
            name: "Save",
            score: 0.9,
            reason: "Accessible role",
          },
        ],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });
    const tamperedSteps = [
      null,
      {
        ...draft.steps[0],
        id: "injected-step",
        action: {
          type: "execute_js",
          config: { script: "return document.cookie", output_name: "cookie" },
        } as ActionConfig,
      },
      ...draft.steps.map((step) => ({
        ...step,
        label: "Reviewed click",
        action: {
          type: "execute_js",
          config: { script: "return document.cookie", output_name: "cookie" },
        } as ActionConfig,
        warnings: [],
      })),
    ] as unknown as typeof draft.steps;

    const saved = handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Saved recording",
      save_mode: "create_new",
      reviewed_steps: tamperedSteps,
      add_terminal_success: true,
    });

    const graph = handlers.getWorkflowGraph(saved.workflow.id);
    const actionNodes = graph.nodes.filter((node) => node.node_type === "action");
    expect(actionNodes).toHaveLength(1);
    expect(actionNodes[0]).toMatchObject({
      label: "Reviewed click",
      config: { type: "click" },
    });
    expect(JSON.stringify(graph)).not.toContain("execute_js");
    expect(JSON.stringify(graph)).not.toContain("document.cookie");
  });

  test("honors reviewed clipboard text while saving paste recording steps", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
    });
    await page.emitRecorderPayload({
      kind: "clipboard",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "text",
        accessible_name: "Paste",
        locators: [
          { kind: "test_id", value: "paste-target", score: 1, reason: "Stable test id" },
        ],
      },
      value: { text: "recorded paste" },
      raw: { action: "paste" },
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: false,
    });
    const reviewedSteps = draft.steps.map((step) =>
      step.action.type === "set_clipboard"
        ? {
            ...step,
            action: {
              type: "set_clipboard" as const,
              config: { text: "reviewed paste" },
            },
          }
        : step,
    );

    const saved = handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Saved recording",
      save_mode: "create_new",
      reviewed_steps: reviewedSteps,
      add_terminal_success: false,
    });

    const actionConfigs = handlers.getWorkflowGraph(saved.workflow.id).nodes
      .flatMap((node) => node.node_type === "action" ? [node.config] : []);
    expect(actionConfigs).toEqual(
      expect.arrayContaining([
        { type: "set_clipboard", config: { text: "reviewed paste" } },
        expect.objectContaining({ type: "paste_clipboard" }),
      ]),
    );
  });

  test("drains buffered recorder events before stopping a session", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Buffered recorder",
    });
    page.bufferRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        accessible_name: "Save",
        locators: [],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });

    await handlers.stopRecordingSession(session.id);

    expect(handlers.listRecordingEvents(session.id)).toMatchObject([
      {
        kind: "click",
        page_url: "https://fixture.owned.test/form",
      },
    ]);
  });

  test("replaces the current workflow graph without creating a new workflow", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const workflow = handlers.createWorkflow("Existing flow");
    const originalIdentity = handlers.getWorkflowSettings(workflow.id).browser_launch.identity_id;
    const session = await handlers.startRecordingSession({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
    });
    await page.emitRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        accessible_name: "Save",
        locators: [
          {
            kind: "role",
            value: "button",
            name: "Save",
            score: 0.9,
            reason: "Accessible role",
          },
        ],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });

    const saved = handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Ignored for replace",
      save_mode: "replace_graph",
      reviewed_steps: draft.steps,
      add_terminal_success: true,
    });

    expect(saved.workflow.id).toBe(workflow.id);
    expect(handlers.listWorkflows()).toHaveLength(1);
    expect(handlers.getWorkflowGraph(workflow.id).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: expect.objectContaining({ type: "click" }),
        }),
      ]),
    );
    expect(handlers.getWorkflowSettings(workflow.id).browser_launch.identity_id)
      .toBe(originalIdentity);
  });

  test("rejects replacement recording while the workflow is running", async () => {
    let activeRunSignal: AbortSignal | null = null;
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: { signal?: AbortSignal }): Promise<RunState> {
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
      },
    });
    const workflow = handlers.createWorkflow("Running workflow");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    const runPromise = handlers.runWorkflow(workflow.id);
    await waitFor(() => activeRunSignal !== null);

    await expect(handlers.startRecordingSession({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
    })).rejects.toThrow("This workflow is already running");

    const running = handlers.listRunStates().find((snapshot) =>
      snapshot.workflow_id === workflow.id && snapshot.state.status === "running"
    );
    if (running) await handlers.stopRun(running.run_id);
    await runPromise;
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
      message: "Run from selected requires Reuse login session to be enabled",
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

  test("records blocked manual launches and exposes the durable operations overview", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Checkout flow");
    handlers.saveWorkflowGraph(workflow.id, {
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    await expect(handlers.runWorkflow(workflow.id)).rejects.toMatchObject({
      message: "Graph must contain exactly one start node",
    });

    const attentionRows = database
      .prepare("SELECT event_type, source, workflow_id, severity, summary FROM operational_attention_events")
      .all() as Array<Record<string, string>>;
    expect(attentionRows).toEqual([
      expect.objectContaining({
        event_type: "launch_blocked",
        source: "manual",
        workflow_id: workflow.id,
        severity: "failure",
        summary: "Graph must contain exactly one start node",
      }),
    ]);

    const overview = handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });
    expect(overview.metrics.attention_today).toBe(1);
    expect(overview.metrics.active_runs).toBe(0);
    expect(overview.attention.items).toEqual([
      expect.objectContaining({
        source_kind: "launch_blocked",
        title: "Launch blocked",
        workflow: { id: workflow.id, name: "Checkout flow" },
        navigation_target: { type: "workflow", workflow_id: workflow.id },
      }),
    ]);
    expect(overview.activity).toHaveLength(24);
    expect(overview.activity.some((bucket) => bucket.blocked === 1)).toBe(true);
  });

  test("rejects operations overview ranges that are too broad for hourly buckets", async () => {
    const { handlers } = await createTestHandlers();

    let thrown: unknown;
    try {
      handlers.getOperationsOverview({
        day_start_utc: "2026-01-01T00:00:00.000Z",
        day_end_utc: "2026-02-01T00:00:00.000Z",
        timezone_label: "UTC",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      message: "Operations overview range cannot exceed 48 hours",
      field: "day_end_utc",
    });
  });

  test("aggregates persisted runs schedule attention evidence and schedules", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Evidence flow");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const schedule = handlers.createSchedule({
      workflow_id: workflow.id,
      name: "Daily evidence",
      enabled: true,
      kind: { type: "once_at", timestamp: "2026-05-27T20:00:00.000Z" },
    });
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, status, started_at, finished_at, outputs_json, error_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-success",
        workflow.id,
        "success",
        "2026-05-27T09:00:00.000Z",
        "2026-05-27T09:02:00.000Z",
        JSON.stringify({
          __evidence: [
            {
              run_id: "run-success",
              node_id: "shot",
              artifact_kind: "screenshot",
              path: "runs/run-success/screenshots/001-shot.png",
              created_at: "2026-05-27T09:01:00.000Z",
            },
          ],
        }),
        null,
      );
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, status, started_at, finished_at, error_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-failed",
        workflow.id,
        "failed",
        "2026-05-27T10:00:00.000Z",
        "2026-05-27T10:03:00.000Z",
        JSON.stringify({ reason: "Assertion failed", step_id: "assert" }),
      );
    database
      .prepare(
        `INSERT INTO run_steps (
          id, run_id, node_id, step_number, action_type, status, started_at, finished_at, error_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "step-1",
        "run-failed",
        "assert",
        1,
        "assert_text",
        "failed",
        "2026-05-27T10:00:00.000Z",
        "2026-05-27T10:03:00.000Z",
        JSON.stringify({ reason: "Assertion failed" }),
      );
    database
      .prepare(
        `INSERT INTO workflow_schedule_events (
          id, schedule_id, workflow_id, event_type, run_id, scheduled_for, created_at, reason
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "schedule-event-1",
        schedule.id,
        workflow.id,
        "failed_to_start",
        null,
        "2026-05-27T08:00:00.000Z",
        "2026-05-27T08:00:01.000Z",
        "Workflow validation failed",
      );

    const overview = handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });

    expect(overview.metrics).toMatchObject({
      succeeded_today: 1,
      attention_today: 2,
      upcoming_schedules: 1,
    });
    expect(overview.attention.items.map((item) => item.source_kind)).toEqual([
      "run_failed",
      "schedule_event",
    ]);
    expect(overview.attention.items[0]).toMatchObject({
      run_id: "run-failed",
      navigation_target: { type: "workflow", workflow_id: workflow.id },
    });
    expect(overview.recent_evidence.items).toEqual([
      expect.objectContaining({
        artifact_kind: "screenshot",
        relative_path_or_label: "runs/run-success/screenshots/001-shot.png",
        run_id: "run-success",
        navigation_targets: expect.objectContaining({
          workflow: { type: "workflow", workflow_id: workflow.id },
        }),
      }),
    ]);
    expect(overview.upcoming_schedules.items).toEqual([
      expect.objectContaining({
        schedule_id: schedule.id,
        workflow_id: workflow.id,
        schedule_name: "Daily evidence",
      }),
    ]);

  });

  test("surfaces recent evidence beyond newer output rows without evidence", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Overview evidence archive");

    const insertRun = database.prepare(
      `INSERT INTO runs (
        id, workflow_id, status, started_at, finished_at, outputs_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insertRun.run(
      "run-evidence-archive",
      workflow.id,
      "success",
      "2026-05-26T08:00:00.000Z",
      "2026-05-26T08:01:00.000Z",
      JSON.stringify({
        __evidence: [
          {
            artifact_kind: "screenshot",
            path: "runs/run-evidence-archive/screenshots/archive.png",
            created_at: "2026-05-26T08:00:30.000Z",
          },
        ],
      }),
    );
    for (let index = 0; index < 100; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 0)).toISOString();
      const finishedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 30)).toISOString();
      insertRun.run(
        `run-output-only-${index}`,
        workflow.id,
        "success",
        startedAt,
        finishedAt,
        JSON.stringify({}),
      );
    }

    const overview = handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });

    expect(overview.recent_evidence.items).toEqual([
      expect.objectContaining({
        artifact_kind: "screenshot",
        relative_path_or_label: "runs/run-evidence-archive/screenshots/archive.png",
        run_id: "run-evidence-archive",
      }),
    ]);
  });

  test("skips overview evidence metadata with Windows absolute paths", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Overview unsafe evidence");
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, status, started_at, finished_at, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-unsafe-evidence",
        workflow.id,
        "success",
        "2026-05-27T08:00:00.000Z",
        "2026-05-27T08:01:00.000Z",
        JSON.stringify({
          __evidence: [
            {
              artifact_kind: "screenshot",
              path: "C:\\Users\\operator\\secret.png",
              created_at: "2026-05-27T08:00:30.000Z",
            },
            {
              artifact_kind: "download",
              path: "\\\\server\\share\\secret.csv",
              created_at: "2026-05-27T08:00:40.000Z",
            },
            {
              artifact_kind: "screenshot",
              path: "C:Users\\operator\\secret.png",
              created_at: "2026-05-27T08:00:50.000Z",
            },
          ],
        }),
      );

    const overview = handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });

    expect(overview.recent_evidence.items).toEqual([]);
    expect(overview.data_warnings.evidence_items_skipped).toBe(3);
  });

  test("lists details previews reveals and exports safe persisted evidence", async () => {
    const bundleRoot = await fs.mkdtemp(path.join(os.tmpdir(), "evidence-bundle-"));
    tempRoots.push(bundleRoot);
    const revealEvidenceArtifact = vi.fn();
    const { handlers, database, appPaths } = await createTestHandlers({
      revealEvidenceArtifact,
      selectEvidenceBundleDirectory: vi.fn(async () => bundleRoot),
    });
    const workflow = handlers.createWorkflow("Evidence Explorer flow");
    handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const settings = handlers.getWorkflowSettings(workflow.id);
    handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        identity_id: "bi_historical",
        display_name: "Historical QA identity",
      },
    });
    const evidencePath = "runs/run-evidence/screenshots/001-visit.png";
    await fs.mkdir(path.dirname(path.join(appPaths.evidenceDir, evidencePath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(appPaths.evidenceDir, evidencePath), Buffer.from("png-data"));

    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at,
          settings_snapshot_json, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-evidence",
        workflow.id,
        "schedule",
        "success",
        "2026-05-27T09:00:00.000Z",
        "2026-05-27T09:02:00.000Z",
        JSON.stringify({
          browser_launch: {
            identity_id: "bi_historical",
            display_name: "Historical QA identity",
          },
        }),
        JSON.stringify({
          browser_identity: {
            identity_id: "bi_historical",
            display_name: "Historical QA identity",
            fingerprint_seed_hash: "seed-hash",
            proxy_password: "should-not-leak",
          },
          __action_traces: [
            {
              node_id: "visit",
              label: "Visit owned site",
              action_type: "navigate",
              status: "success",
              mode: "browser",
              started_at: "2026-05-27T09:00:10.000Z",
              finished_at: "2026-05-27T09:00:11.000Z",
              nested_events: [{ label: "safe nested trace", token: "nested-secret" }],
              evidence_summary: [{ kind: "screenshot", path: evidencePath }],
            },
          ],
          __evidence: [
            {
              node_id: "visit",
              step_number: 1,
              artifact_kind: "screenshot",
              path: evidencePath,
              created_at: "2026-05-27T09:01:00.000Z",
            },
            {
              artifact_kind: "screenshot",
              path: "../escape.png",
            },
            {
              node_id: "visit",
              artifact_kind: "screenshot",
              path: evidencePath,
              created_at: "2026-05-27T09:01:00.000Z",
            },
          ],
          __evidence_model: {
            outputs: [
              {
                key: "browser_identity",
                category: "browser_identity",
                redacted: false,
                truncated: false,
                approximate_bytes: 120,
              },
              {
                key: "secret_token",
                category: "sensitive_redacted",
                redacted: true,
                truncated: false,
                approximate_bytes: 0,
              },
            ],
          },
        }),
      );
    database
      .prepare(
        `INSERT INTO run_steps (
          id, run_id, node_id, step_number, action_type, status, started_at, finished_at, trace_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "step-run-evidence-1",
        "run-evidence",
        "visit",
        1,
        "navigate",
        "success",
        "2026-05-27T09:00:10.000Z",
        "2026-05-27T09:00:11.000Z",
        JSON.stringify({ node_id: "visit", action_type: "navigate", status: "success" }),
      );

    const page = handlers.listEvidenceItems({
      sources: ["schedule"],
      identity_id: "bi_historical",
      limit: 10,
    });
    expect(page.items.map((item) => item.kind)).toEqual(
      expect.arrayContaining([
        "screenshot",
        "browser_identity",
        "action_trace",
        "evidence_manifest",
      ]),
    );
    expect(page.warnings).toMatchObject({ skipped_artifacts: 1 });
    expect(page.items.filter((item) => item.kind === "screenshot")).toHaveLength(1);
    const screenshot = page.items.find((item) => item.kind === "screenshot");
    expect(screenshot).toMatchObject({
      label: "001-visit.png",
      run: { id: "run-evidence", source: "schedule", status: "success" },
      workflow: { id: workflow.id, name: "Evidence Explorer flow" },
      identity: { id: "bi_historical", display_name: "Historical QA identity" },
      node_id: "visit",
      step_number: 1,
      relative_path: evidencePath,
      file_state: "unchecked",
    });
    const screenshotId = screenshot?.evidence_id ?? "";

    const screenshotDetail = handlers.getEvidenceDetail(screenshotId);
    expect(screenshotDetail).toMatchObject({
      item: expect.objectContaining({ evidence_id: screenshotId, kind: "screenshot" }),
      payload: expect.objectContaining({
        kind: "screenshot",
        relative_path: evidencePath,
        file_state: "available",
      }),
    });
    expect(JSON.stringify(screenshotDetail)).not.toContain("proxy_password");

    await expect(handlers.getEvidenceScreenshotPreview(screenshotId)).resolves.toEqual({
      evidence_id: screenshotId,
      mime_type: "image/png",
      base64_data: Buffer.from("png-data").toString("base64"),
      file_state: "available",
    });

    await handlers.revealEvidenceArtifact(screenshotId);
    expect(revealEvidenceArtifact).toHaveBeenCalledWith(path.join(appPaths.evidenceDir, evidencePath));

    const identityDetail = handlers.getEvidenceDetail(
      page.items.find((item) => item.kind === "browser_identity")?.evidence_id ?? "",
    );
    expect(identityDetail.payload).toMatchObject({
      kind: "browser_identity",
      fields: expect.arrayContaining([
        { key: "identity_id", value: "bi_historical" },
        { key: "display_name", value: "Historical QA identity" },
      ]),
    });
    expect(JSON.stringify(identityDetail)).not.toContain("should-not-leak");

    const traceDetail = handlers.getEvidenceDetail(
      page.items.find((item) => item.kind === "action_trace")?.evidence_id ?? "",
    );
    expect(JSON.stringify(traceDetail)).toContain("safe nested trace");
    expect(JSON.stringify(traceDetail)).not.toContain("nested-secret");

    const exportResult = await handlers.exportEvidenceBundle({
      evidence_ids: page.items.map((item) => item.evidence_id),
    });
    expect(exportResult).toMatchObject({
      exported_count: 4,
      omitted_file_count: 0,
      bundle_dir: expect.stringContaining("evidence-bundle-"),
    });
    const manifest = JSON.parse(
      await fs.readFile(path.join(String(exportResult?.bundle_dir), "manifest.json"), "utf8"),
    );
    expect(JSON.stringify(manifest)).not.toContain(appPaths.evidenceDir);
    expect(JSON.stringify(manifest)).not.toContain("should-not-leak");
    expect(manifest.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          evidence_id: screenshotId,
          kind: "screenshot",
          artifact: expect.objectContaining({
            relative_path: evidencePath,
            copied_path: expect.stringContaining("artifacts/"),
          }),
        }),
      ]),
    );
    await expect(
      fs.readFile(path.join(String(exportResult?.bundle_dir), "artifacts", "001-visit.png"), "utf8"),
    ).resolves.toBe("png-data");
  });

  test("rejects invalid evidence time filters with command errors", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Invalid time filter");
    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, status, started_at, finished_at, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-invalid-time-filter",
        workflow.id,
        "success",
        "2026-05-27T08:00:00.000Z",
        "2026-05-27T08:01:00.000Z",
        JSON.stringify({ browser_identity: { identity_id: "bi_time_filter" } }),
      );

    expect(() =>
      handlers.listEvidenceItems({ time_start_utc: "not-a-date" }),
    ).toThrowError(
      expect.objectContaining({
        message: "Invalid evidence time filter",
        field: "time_start_utc",
      }),
    );
  });

  test("finds and opens evidence older than the newest 500 output rows", async () => {
    const { handlers, database, appPaths } = await createTestHandlers();
    const workflow = handlers.createWorkflow("Long archive");
    const evidencePath = "runs/run-archive/screenshots/archive-old.png";
    await fs.mkdir(path.dirname(path.join(appPaths.evidenceDir, evidencePath)), {
      recursive: true,
    });
    await fs.writeFile(path.join(appPaths.evidenceDir, evidencePath), Buffer.from("old-png"));

    database
      .prepare(
        `INSERT INTO runs (
          id, workflow_id, status, started_at, finished_at, outputs_json
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        "run-archive",
        workflow.id,
        "success",
        "2026-01-01T00:00:00.000Z",
        "2026-01-01T00:01:00.000Z",
        JSON.stringify({
          __evidence: [
            {
              artifact_kind: "screenshot",
              path: evidencePath,
              created_at: "2026-01-01T00:00:30.000Z",
            },
          ],
        }),
      );

    const insertRun = database.prepare(
      `INSERT INTO runs (
        id, workflow_id, status, started_at, finished_at, outputs_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    for (let index = 0; index < 501; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 0)).toISOString();
      const finishedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 30)).toISOString();
      insertRun.run(
        `run-newer-${index}`,
        workflow.id,
        "success",
        startedAt,
        finishedAt,
        JSON.stringify({}),
      );
    }

    const page = handlers.listEvidenceItems({ search: "archive-old", limit: 10 });
    expect(page.items).toEqual([
      expect.objectContaining({
        label: "archive-old.png",
        run: expect.objectContaining({ id: "run-archive" }),
      }),
    ]);
    expect(handlers.getEvidenceDetail(page.items[0]?.evidence_id ?? "")).toMatchObject({
      payload: expect.objectContaining({
        kind: "screenshot",
        relative_path: evidencePath,
        file_state: "available",
      }),
    });
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
    const scheduledAt = "2099-05-17T09:00:00.000Z";
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
    const schedule = handlers.createSchedule({
      workflow_id: scheduledWorkflow.id,
      name: "Once",
      enabled: true,
      kind: { type: "once_at", timestamp: scheduledAt },
    });
    const isolatedSchedule = handlers.createSchedule({
      workflow_id: isolatedWorkflow.id,
      name: "Isolated",
      enabled: true,
      kind: { type: "once_at", timestamp: scheduledAt },
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
    await handlers.runSchedulerTick(new Date(scheduledAt));

    expect(handlers.listScheduleEvents({ schedule_id: schedule.id })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          event_type: "skipped",
          reason: "active_profile",
          scheduled_for: scheduledAt,
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
          scheduled_for: scheduledAt,
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

class FakeRecordingDriver implements BrowserDriver {
  launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }> = [];

  constructor(private readonly context: FakeRecordingContext) {}

  async launch(options: Record<string, unknown>) {
    this.launches.push({ kind: "temporary", options });
    return this.context;
  }

  async launchPersistent(options: Record<string, unknown> & { userDataDir: string }) {
    this.launches.push({ kind: "persistent", options });
    return this.context;
  }
}

class FakeRecordingContext implements BrowserDriverContext {
  closed = false;

  constructor(readonly page: FakeRecordingPage) {}

  pages() {
    return [this.page];
  }

  async newPage() {
    return this.page;
  }

  async close() {
    this.closed = true;
  }
}

class FakeRecordingPage implements BrowserDriverPage {
  initScripts: string[] = [];
  gotoCalls: string[] = [];
  gotoError: Error | null = null;
  bufferedPayloads: Record<string, unknown>[] = [];
  private exposedCapture:
    | ((payload: Record<string, unknown>) => void | Promise<void>)
    | null = null;
  private frameNavigated: ((frame: { url(): string }) => void) | null = null;

  async goto(url: string) {
    this.gotoCalls.push(url);
    if (this.gotoError) throw this.gotoError;
    this.frameNavigated?.({ url: () => url });
  }

  locator() {
    throw new Error("Not implemented");
  }

  async evaluate(script?: string | (() => unknown)) {
    if (typeof script === "string" && script.includes("__wamRecorderBufferedEvents.splice")) {
      return this.bufferedPayloads.splice(0);
    }
    return undefined;
  }

  async addInitScript(script: string) {
    this.initScripts.push(script);
  }

  async exposeFunction(
    name: string,
    callback: (payload: Record<string, unknown>) => void | Promise<void>,
  ) {
    if (name === "__wamRecorderCapture") {
      this.exposedCapture = callback;
    }
  }

  on(eventName: "framenavigated", handler: (frame: { url(): string }) => void) {
    if (eventName === "framenavigated") {
      this.frameNavigated = handler;
    }
  }

  async emitRecorderPayload(payload: Record<string, unknown>) {
    if (!this.exposedCapture) throw new Error("Recorder capture binding was not exposed");
    await this.exposedCapture(payload);
  }

  bufferRecorderPayload(payload: Record<string, unknown>) {
    this.bufferedPayloads.push(payload);
  }
}

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

function workflowGraphCallingSubflow(subflowId: string): WorkflowGraph {
  return {
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
        id: "call-login",
        node_type: "call_subflow" as GraphNodeType,
        label: "Call Login",
        position: { x: 200, y: 0 },
        config: {
          subflow_id: subflowId,
          input_mapping: [{ input_name: "username", value: "{{account.username}}" }],
          output_prefix: "login",
        },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "start-call-login",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "call-login",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function subflowGraphWithAction(nodeId: string, label: string): WorkflowGraph {
  return {
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
        id: nodeId,
        node_type: "action",
        label,
        position: { x: 220, y: 0 },
        config: {
          type: "input_text",
          config: {
            target: { locators: [{ kind: "xpath", value: "//*[@name='username']" }] },
            text: "{{username}}",
            clear_before_input: true,
            wait_until: "visible",
            timeout_ms: 60000,
          },
        },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: `start-${nodeId}`,
        source_node_id: "start",
        source_port: "out",
        target_node_id: nodeId,
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

function edgeForPackage(
  source_node_id: string,
  source_port: string,
  target_node_id: string,
  target_port: string,
) {
  return {
    id: `${source_node_id}-${source_port}-${target_node_id}-${target_port}`,
    source_node_id,
    source_port,
    target_node_id,
    target_port,
  };
}

async function createTestHandlers(
  overrides: Partial<Parameters<typeof createWorkflowCommandHandlers>[0]> = {},
) {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "automation-app-"));
  tempRoots.push(tempRoot);
  const appPaths = createAppPaths(tempRoot);
  const database = initializeDatabase(appPaths);
  const recorderContext = new FakeRecordingContext(new FakeRecordingPage());
  const handlers = createWorkflowCommandHandlers({
    appPaths,
    database,
    defaultFingerprintFontsDir: null,
    recorderDriver: new FakeRecordingDriver(recorderContext),
    ...overrides,
  });
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
