import { describe, expect, test } from "vitest";
import {
  resetWorkflowBridge,
  workflowBridgeMock,
} from "../tests/mocks/electron";
import {
  exportWorkflow,
  exportWorkflowPackage,
  duplicateWorkflow,
  dryRunValidateConfig,
  compileWorkflowGraph,
  getWorkflowSettings,
  getWorkflowBrowserConfig,
  getWorkflowGraph,
  importWorkflow,
  importWorkflowPackage,
  normalizeRecordedEvents,
  runWorkflow,
  saveWorkflowSettings,
  saveWorkflowSettingsSection,
  saveWorkflowBrowserConfig,
  saveWorkflowGraph,
  runBatchWorkflow,
  suggestSelectors,
  validateWorkflowSettings,
  validateWorkflowGraph,
  validateWorkflowRun,
  validateSchedule,
  previewWorkflowPackage,
} from "./workflowApi";
import type {
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowSettings,
} from "../types/workflow";

describe("workflow API phase ten commands", () => {
  test("invokes orchestration commands with frontend-safe payloads", async () => {
    resetWorkflowBridge();
    const exported: WorkflowExport = {
      version: 1,
      workflow: {
        id: "workflow-1",
        name: "Export me",
        created_at: "1",
        updated_at: "1",
      },
      steps: [],
    };

    workflowBridgeMock.validateSchedule.mockResolvedValue(undefined);
    workflowBridgeMock.duplicateWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.exportWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.importWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.runBatchWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.suggestSelectors.mockResolvedValue(undefined);
    workflowBridgeMock.normalizeRecordedEvents.mockResolvedValue(undefined);
    workflowBridgeMock.dryRunValidateConfig.mockResolvedValue(undefined);

    await validateSchedule({
      workflow_id: "workflow-1",
      enabled: true,
      kind: { kind: "interval", every_seconds: 60 },
    });
    await duplicateWorkflow("workflow-1", "Copy of Export me");
    await exportWorkflow("workflow-1");
    await importWorkflow(exported);
    await runBatchWorkflow("workflow-1", {
      rows: [{ email: "a@example.com" }],
      concurrency_limit: 1,
      headless: false,
    });
    await suggestSelectors({
      tag: "button",
      id: "save",
      test_id: "save-button",
      name: null,
      text: "Save",
      classes: [],
    });
    await normalizeRecordedEvents([{ type: "click", xpath: "//*[@id='save']" }]);
    await dryRunValidateConfig({
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    });

    expect(workflowBridgeMock.validateSchedule).toHaveBeenCalledWith({
      workflow_id: "workflow-1",
      enabled: true,
      kind: { kind: "interval", every_seconds: 60 },
    });
    expect(workflowBridgeMock.duplicateWorkflow).toHaveBeenCalledWith(
      "workflow-1",
      "Copy of Export me",
    );
    expect(workflowBridgeMock.exportWorkflow).toHaveBeenCalledWith("workflow-1");
    expect(workflowBridgeMock.importWorkflow).toHaveBeenCalledWith(exported);
    expect(workflowBridgeMock.runBatchWorkflow).toHaveBeenCalledWith(
      "workflow-1",
      {
        rows: [{ email: "a@example.com" }],
        concurrency_limit: 1,
        headless: false,
      },
    );
    expect(workflowBridgeMock.suggestSelectors).toHaveBeenCalledWith({
        tag: "button",
        id: "save",
        test_id: "save-button",
        name: null,
        text: "Save",
        classes: [],
    });
    expect(workflowBridgeMock.normalizeRecordedEvents).toHaveBeenCalledWith([
      { type: "click", xpath: "//*[@id='save']" },
    ]);
    expect(workflowBridgeMock.dryRunValidateConfig).toHaveBeenCalledWith({
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    });
  });

  test("invokes workflow package commands with selected sections", async () => {
    resetWorkflowBridge();
    const workflowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Login flow" },
      included_sections: ["flow", "settings.general", "settings.browser_launch"],
      omitted_fields: [],
      flow: {
        version: 1,
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      settings: {
        general: {
          name: "Login flow",
          description: "",
          tags: [],
          notes: "",
        },
        browser_launch: {
          session_mode: "temporary",
          profile_name: null,
          proxy_enabled: false,
          proxy_server: null,
          proxy_username: null,
          proxy_password: null,
          headless: false,
        },
      },
    };

    workflowBridgeMock.exportWorkflowPackage.mockResolvedValue(undefined);
    workflowBridgeMock.previewWorkflowPackage.mockResolvedValue(undefined);
    workflowBridgeMock.importWorkflowPackage.mockResolvedValue(undefined);

    await exportWorkflowPackage("workflow-1", {
      include_flow: true,
      settings_sections: ["general", "browser_launch"],
    });
    await previewWorkflowPackage(workflowPackage);
    await importWorkflowPackage(workflowPackage, {
      include_flow: true,
      settings_sections: ["general", "browser_launch"],
    });

    expect(workflowBridgeMock.exportWorkflowPackage).toHaveBeenCalledWith(
      "workflow-1",
      {
        include_flow: true,
        settings_sections: ["general", "browser_launch"],
      },
    );
    expect(workflowBridgeMock.previewWorkflowPackage).toHaveBeenCalledWith(
      workflowPackage,
    );
    expect(workflowBridgeMock.importWorkflowPackage).toHaveBeenCalledWith(
      workflowPackage,
      {
        include_flow: true,
        settings_sections: ["general", "browser_launch"],
      },
    );
  });
});

describe("workflow API graph commands", () => {
  test("invokes graph commands with frontend-safe payloads", async () => {
    resetWorkflowBridge();
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    workflowBridgeMock.getWorkflowGraph.mockResolvedValue(undefined);
    workflowBridgeMock.saveWorkflowGraph.mockResolvedValue(undefined);
    workflowBridgeMock.validateWorkflowGraph.mockResolvedValue(undefined);
    workflowBridgeMock.compileWorkflowGraph.mockResolvedValue(undefined);
    workflowBridgeMock.runWorkflow.mockResolvedValue(undefined);

    await getWorkflowGraph("workflow-1");
    await saveWorkflowGraph("workflow-1", graph);
    await validateWorkflowGraph(graph);
    await compileWorkflowGraph(graph);
    await runWorkflow("workflow-1");

    expect(workflowBridgeMock.getWorkflowGraph).toHaveBeenCalledWith("workflow-1");
    expect(workflowBridgeMock.saveWorkflowGraph).toHaveBeenCalledWith(
      "workflow-1",
      graph,
    );
    expect(workflowBridgeMock.validateWorkflowGraph).toHaveBeenCalledWith(graph);
    expect(workflowBridgeMock.compileWorkflowGraph).toHaveBeenCalledWith(graph);
    expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
  });
});

describe("workflow API browser config commands", () => {
  test("invokes workflow browser config commands with frontend-safe payloads", async () => {
    resetWorkflowBridge();
    const config = {
      workflow_id: "workflow-1",
      profile_name: "qa-profile",
      proxy_enabled: true,
      proxy_server: "http://proxy.local:8080",
      proxy_username: "agent",
      proxy_password: "secret",
      user_agent: "WorkflowBot/1.0",
      viewport_width: 1280,
      viewport_height: 720,
      mobile: false,
      touch: false,
      challenge_policy: "pause_for_human" as const,
    };

    workflowBridgeMock.getWorkflowBrowserConfig.mockResolvedValue(undefined);
    workflowBridgeMock.saveWorkflowBrowserConfig.mockResolvedValue(undefined);

    await getWorkflowBrowserConfig("workflow-1");
    await saveWorkflowBrowserConfig("workflow-1", config);

    expect(workflowBridgeMock.getWorkflowBrowserConfig).toHaveBeenCalledWith(
      "workflow-1",
    );
    expect(workflowBridgeMock.saveWorkflowBrowserConfig).toHaveBeenCalledWith(
      "workflow-1",
      config,
    );
  });
});

describe("workflow API settings commands", () => {
  test("invokes workflow settings commands with frontend-safe payloads", async () => {
    resetWorkflowBridge();
    const settings: WorkflowSettings = {
      workflow_id: "workflow-1",
      version: 1,
      general: {
        name: "Login flow",
        description: "",
        tags: [],
        notes: "",
        created_at: "1",
        updated_at: "1",
      },
      run_policy: {
        max_workflow_duration_ms: null,
        browser_retention: "retain",
        batch_concurrency_limit: null,
        batch_headless: false,
        batch_stop_on_first_failed_row: false,
      },
      browser_launch: {
        session_mode: "temporary",
        profile_name: null,
        proxy_enabled: false,
        proxy_server: null,
        proxy_username: null,
        proxy_password: null,
        headless: false,
      },
      environment: {
        initial_variables: [],
      },
      owned_test_gates: {
        fingerprint_preflight_enabled: false,
        fingerprint_probe_url: null,
        fingerprint_profile_id: null,
        fingerprint_allowed_origins: [],
        fingerprint_proxy_label: null,
        fingerprint_proxy_region: null,
      },
      migration_notes: [],
      created_at: "1",
      updated_at: "1",
    };

    workflowBridgeMock.getWorkflowSettings.mockResolvedValue(settings);
    workflowBridgeMock.saveWorkflowSettings.mockResolvedValue(settings);
    workflowBridgeMock.saveWorkflowSettingsSection.mockResolvedValue(settings);
    workflowBridgeMock.validateWorkflowSettings.mockResolvedValue([]);
    workflowBridgeMock.validateWorkflowRun.mockResolvedValue([]);

    await getWorkflowSettings("workflow-1");
    await saveWorkflowSettings("workflow-1", settings);
    await saveWorkflowSettingsSection("workflow-1", "browser_launch", settings.browser_launch);
    await validateWorkflowSettings(settings);
    await validateWorkflowRun("workflow-1");

    expect(workflowBridgeMock.getWorkflowSettings).toHaveBeenCalledWith(
      "workflow-1",
    );
    expect(workflowBridgeMock.saveWorkflowSettings).toHaveBeenCalledWith(
      "workflow-1",
      settings,
    );
    expect(workflowBridgeMock.saveWorkflowSettingsSection).toHaveBeenCalledWith(
      "workflow-1",
      "browser_launch",
      settings.browser_launch,
    );
    expect(workflowBridgeMock.validateWorkflowSettings).toHaveBeenCalledWith(
      settings,
    );
    expect(workflowBridgeMock.validateWorkflowRun).toHaveBeenCalledWith(
      "workflow-1",
    );
  });
});
