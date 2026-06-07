// @vitest-environment node

import { describe, expect, test } from "vitest";
import type {
  ProjectPackage,
  WorkflowGraph,
  WorkflowSettings,
} from "../../../src/types/workflow";
import { ProjectPackageService } from "./projectPackageService";

describe("ProjectPackageService", () => {
  test("builds sanitized project packages with workflows, subflows, and sessions", () => {
    const service = createService();
    const settings = workflowSettings("workflow-1", "Login flow");

    const packageValue = service.exportProjectPackage({
      project: {
        id: "project-1",
        name: "Owned Lab",
        description: "Staging workflows",
        created_at: "1",
        updated_at: "1",
      },
      environments: [
        {
          id: "environment-1",
          project_id: "project-1",
          name: "Project saved session",
          description: "",
          is_default: true,
          browser_launch: {
            ...settings.browser_launch,
            proxy_server: "https://user:pass@proxy.example:8443",
            proxy_password: "secret",
          },
          created_at: "1",
          updated_at: "1",
        },
      ],
      subflows: [
        {
          id: "subflow-1",
          project_id: "project-1",
          name: "Login helper",
          description: "",
          tags: [],
          graph: runnableGraph("subflow-action"),
          created_at: "1",
          updated_at: "1",
        },
      ],
      workflows: [
        {
          workflow: {
            id: "workflow-1",
            project_id: "project-1",
            environment_id: "environment-1",
            name: "Login flow",
            step_count: 0,
            created_at: "1",
            updated_at: "1",
          },
          flow: workflowGraphCallingSubflow("subflow-1"),
          settings,
        },
      ],
    });

    expect(packageValue).toMatchObject({
      kind: "project_package",
      version: 1,
      project: { name: "Owned Lab", description: "Staging workflows" },
      included_sections: ["project", "environments", "subflows", "workflows"],
    });
    expect(packageValue.environments[0].browser_launch.proxy_password).toBeNull();
    expect(packageValue.environments[0].browser_launch.proxy_server).toBe(
      "https://proxy.example:8443/",
    );
    expect(packageValue.environments[0].browser_launch.fingerprint_fonts_dir).toBeNull();
    expect(packageValue.environments[0].browser_launch).not.toHaveProperty("preflight_enabled");
    expect(packageValue.workflows[0].settings?.browser_launch.proxy_password).toBeNull();
    expect(packageValue.workflows[0].flow.nodes.some((node) => node.node_type === "call_subflow"))
      .toBe(true);
    expect(packageValue.omitted_fields).toEqual([
      "environments.environment-1.browser_launch.proxy_password",
      "environments.environment-1.browser_launch.proxy_server.credentials",
      "environments.environment-1.browser_launch.fingerprint_fonts_dir",
      "workflows.workflow-1.settings.browser_launch.proxy_password",
      "workflows.workflow-1.settings.browser_launch.proxy_server.credentials",
      "workflows.workflow-1.settings.browser_launch.fingerprint_fonts_dir",
    ]);
  });

  test("prepares imports and rejects packages with missing or invalid referenced subflows", () => {
    const service = createService({
      validateGraph: (graph, options) => {
        if (options?.graphKind === "subflow" && graph.nodes.length === 1) {
          return [{ level: "error", message: "Subflow must have a valid start path" }];
        }
        return [];
      },
    });
    const packageValue: ProjectPackage = projectPackage({
      flow: workflowGraphCallingSubflow("missing-subflow"),
      subflows: [],
    });

    expect(() => service.prepareImport({ packageValue })).toThrow(expect.objectContaining({
      message: "Project package is missing a referenced subflow",
      field: "package.subflows",
    }));

    expect(() =>
      service.prepareImport({
        packageValue: projectPackage({
          flow: workflowGraphCallingSubflow("subflow-1"),
          subflows: [
            {
              id: "subflow-1",
              project_id: "project-source",
              name: "Broken helper",
              description: "",
              tags: [],
              graph: startOnlyGraph(),
              created_at: "1",
              updated_at: "1",
            },
          ],
        }),
      }),
    ).toThrow(expect.objectContaining({
      message: "Referenced subflow has blocking validation errors",
      field: "package.subflows",
    }));
  });
});

type ProjectPackageServiceDependencies = ConstructorParameters<typeof ProjectPackageService>[0];

function createService(overrides: Partial<ProjectPackageServiceDependencies> = {}) {
  return new ProjectPackageService({
    migrateGraph: (graph) => graph,
    validateGraph: () => [],
    validateSettings: () => [],
    defaultSettings: (workflow) => workflowSettings(workflow.id, workflow.name),
    ...overrides,
  });
}

function projectPackage(overrides: {
  flow?: WorkflowGraph;
  subflows?: ProjectPackage["subflows"];
} = {}): ProjectPackage {
  return {
    kind: "project_package",
    version: 1,
    project: { name: "Source Project", description: "" },
    included_sections: ["project", "environments", "subflows", "workflows"],
    omitted_fields: [],
    environments: [
      {
        id: "environment-1",
        project_id: "project-source",
        name: "Project saved session",
        description: "",
        is_default: true,
        browser_launch: workflowSettings().browser_launch,
        created_at: "1",
        updated_at: "1",
      },
    ],
    subflows: overrides.subflows ?? [
      {
        id: "subflow-1",
        project_id: "project-source",
        name: "Login helper",
        description: "",
        tags: [],
        graph: runnableGraph("subflow-action"),
        created_at: "1",
        updated_at: "1",
      },
    ],
    workflows: [
      {
        id: "workflow-1",
        project_id: "project-source",
        environment_id: "environment-1",
        name: "Login flow",
        flow: overrides.flow ?? workflowGraphCallingSubflow("subflow-1"),
        settings: workflowSettings("workflow-1", "Login flow"),
        created_at: "1",
        updated_at: "1",
      },
    ],
  };
}

function workflowGraphCallingSubflow(subflowId: string): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      startNode(),
      {
        id: "call-login",
        node_type: "call_subflow",
        label: "Call Login",
        position: { x: 200, y: 0 },
        config: { subflow_id: subflowId },
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

function runnableGraph(actionId: string): WorkflowGraph {
  return {
    version: 2,
    nodes: [
      startNode(),
      {
        id: actionId,
        node_type: "action",
        label: "Wait",
        position: { x: 200, y: 0 },
        config: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: `start-${actionId}`,
        source_node_id: "start",
        source_port: "out",
        target_node_id: actionId,
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function startOnlyGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [startNode()],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function startNode(): WorkflowGraph["nodes"][number] {
  return {
    id: "start",
    node_type: "start",
    label: "Start",
    position: { x: 0, y: 0 },
    config: null,
    ports: [{ id: "out", label: "Out", direction: "output" }],
  };
}

function workflowSettings(
  workflowId = "workflow-1",
  workflowName = "Login flow",
): WorkflowSettings {
  const timestamp = "2026-05-24T00:00:00.000Z";
  return {
    workflow_id: workflowId,
    version: 2,
    general: {
      name: workflowName,
      description: "",
      tags: [],
      notes: "",
      created_at: timestamp,
      updated_at: timestamp,
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      execute_js_enabled: true,
      run_from_selected_enabled: false,
      run_from_selected_mode: "from_selected",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: "bi_workflow_1",
      display_name: "Login identity",
      profile_dir: "bi_workflow_1",
      fingerprint_seed: "12345",
      profile_name: "bi_workflow_1",
      fingerprint_fonts_dir: "/repo/.local/cloakbrowser-fonts/linux",
      timezone: null,
      locale: null,
      geoip: false,
      proxy_bypass: null,
      webrtc_policy: "default",
      webrtc_ip: null,
      preflight_enabled: true,
      preflight_probe_url: "https://owned.example/preflight",
      preflight_allowed_origins: ["https://owned.example"],
      proxy_enabled: true,
      proxy_server: "https://user:pass@proxy.example:8443",
      proxy_username: null,
      proxy_password: "secret",
      headless: false,
      humanize: true,
      human_preset: "default",
      persona_id: "windows-chrome-us",
      persona: {
        id: "windows-chrome-us",
        label: "Windows Chrome US",
        rationale: "Owned test account",
        os_bucket: "windows_desktop",
        browser_channel_bucket: "chromium_stable",
        viewport: { width: 1365, height: 768 },
        window: { width: 1365, height: 768 },
        timezone: "America/New_York",
        locale: "en-US",
        proxy_geo_policy: "direct",
        proxy_region: null,
        webrtc_mode: "default",
        font_bundle: { label: "Windows", path: null, expected_families: [] },
        account_label: null,
        test_account_binding: null,
        behavioral_timing_profile: "default",
      },
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    environment: { initial_variables: [] },
  };
}
