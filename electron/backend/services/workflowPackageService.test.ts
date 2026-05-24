// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import type {
  GraphValidationIssue,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowSettings,
} from "../../../src/types/workflow";
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
    expect(packageValue.settings.browser_launch?.preflight_probe_url).toBe(
      "https://owned.example/preflight",
    );
    expect(packageValue.omitted_fields).toEqual([
      "settings.browser_launch.proxy_password",
      "settings.browser_launch.proxy_server.credentials",
      "settings.browser_launch.preflight_probe_url.search",
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
      fingerprint_fonts_dir: null,
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
      run_from_selected_enabled: false,
    },
    graph_defaults: { default_edge_delay: null },
    environment: { initial_variables: [] },
    migration_notes: [],
    created_at: timestamp,
    updated_at: timestamp,
  };
}
