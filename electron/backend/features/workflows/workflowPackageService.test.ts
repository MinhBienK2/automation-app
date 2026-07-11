// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import type {
  GraphValidationIssue,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowSettings,
} from "../../../../src/types/workflow";
import { WorkflowPackageService } from "./workflowPackageService";

describe("WorkflowPackageService", () => {
  test("builds sanitized workflow packages without command-handler dependencies", () => {
    const service = createService();
    const settings = workflowSettings();

    const packageValue = service.exportWorkflowPackage({
      workflowName: "Checkout smoke",
      flow: workflowGraph(),
      settings,
      options: {
        include_flow: true,
        settings_sections: ["browser_launch", "environment"],
      },
    });

    expect(packageValue).toMatchObject({
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Checkout smoke" },
      included_sections: ["flow", "settings.browser_launch", "settings.environment"],
      flow: expect.objectContaining({ version: 2 }),
    });
    expect(packageValue.settings.browser_launch?.proxy_password).toBeNull();
    expect(packageValue.settings.browser_launch?.proxy_server).toBe("https://proxy.example:8443/");
    expect(packageValue.settings.browser_launch?.fingerprint_fonts_dir).toBeNull();
    expect(packageValue.settings.browser_launch).not.toHaveProperty("preflight_enabled");
    expect(packageValue.settings.browser_launch).not.toHaveProperty("preflight_probe_url");
    expect(packageValue.settings.browser_launch).not.toHaveProperty("preflight_allowed_origins");
    expect(packageValue.omitted_fields).toEqual([
      "settings.browser_launch.proxy_password",
      "settings.browser_launch.proxy_server.credentials",
      "settings.browser_launch.fingerprint_fonts_dir",
    ]);
  });

  test("prepares imports and validates selected flow/settings without repository or runner state", () => {
    const validateGraph = vi.fn<() => GraphValidationIssue[]>(() => []);
    const validateSettings = vi.fn(() => []);
    const service = createService({ validateGraph, validateSettings });
    const packageValue: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Imported flow" },
      included_sections: ["flow", "settings.general"],
      omitted_fields: [],
      flow: workflowGraph(),
      settings: {
        general: {
          ...workflowSettings().general,
          name: "Packaged name",
          description: "Package description",
        },
      },
    };

    const prepared = service.prepareImport({
      packageValue,
      options: { include_flow: true, settings_sections: ["general"] },
      now: new Date("2026-05-24T00:00:00.000Z"),
    });

    expect(prepared.importedName).toBe("Imported flow (imported)");
    expect(prepared.flow).toEqual(workflowGraph());
    expect(prepared.candidateSettings).toMatchObject({
      workflow_id: "__import_preview__",
      general: {
        name: "Imported flow (imported)",
        description: "Package description",
      },
    });
    expect(validateGraph).toHaveBeenCalled();
    expect(validateSettings).toHaveBeenCalledWith(prepared.candidateSettings);
  });

  test("rejects packages that omit or include invalid referenced subflows", () => {
    const service = createService({
      validateGraph: (graph) =>
        graph.nodes.length === 1
          ? [{ level: "error", message: "Start-only graph cannot run" } as GraphValidationIssue]
          : [],
    });
    const packageValue: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Package with subflow" },
      included_sections: ["flow", "subflows"],
      omitted_fields: [],
      flow: workflowGraphCallingSubflow("login-subflow"),
      subflows: [],
      settings: null,
    };

    expect(() =>
      service.prepareImport({
        packageValue,
        options: { include_flow: true, settings_sections: [] },
      }),
    ).toThrow(expect.objectContaining({
      message: "Workflow package is missing a referenced subflow",
      field: "package.subflows",
    }));

    expect(() =>
      service.prepareImport({
        packageValue: {
          ...packageValue,
          subflows: [
            {
              id: "login-subflow",
              project_id: "source-project",
              name: "Login",
              description: "",
              tags: [],
              graph: startOnlyGraph(),
              created_at: "1",
              updated_at: "1",
            },
          ],
        },
        options: { include_flow: true, settings_sections: [] },
      }),
    ).toThrow(expect.objectContaining({
      message: "Referenced subflow has blocking validation errors",
      field: "package.subflows",
    }));
  });
});

function createService(overrides: Partial<ConstructorParameters<typeof WorkflowPackageService>[0]> = {}) {
  return new WorkflowPackageService({
    migrateGraph: (graph) => graph,
    validateGraph: () => [],
    validateSettings: () => [],
    defaultSettings: (workflow) => workflowSettings(workflow.id, workflow.name),
    ...overrides,
  });
}

function workflowGraph(): WorkflowGraph {
  return {
    version: 2,
    nodes: [],
    edges: [],
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

function startOnlyGraph(): WorkflowGraph {
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
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function workflowSettings(
  workflowId = "workflow-1",
  workflowName = "Checkout smoke",
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
      display_name: "Checkout identity",
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
      preflight_probe_url: "https://owned.example/preflight?token=secret#frag",
      preflight_allowed_origins: ["https://owned.example"],
      proxy_enabled: true,
      proxy_server: "https://user:pass@proxy.example:8443",
      proxy_username: null,
      proxy_password: "secret",
      headless: false,
      humanize: true,
      human_preset: "default",
    } as WorkflowSettings["browser_launch"] & Record<string, unknown>,
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    environment: { initial_variables: [] },
    migration_notes: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}
