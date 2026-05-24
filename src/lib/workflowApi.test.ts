import { describe, expect, test } from "vitest";
import {
  resetWorkflowBridge,
  workflowBridgeMock,
} from "../tests/mocks/electron";
import {
  cleanupOrphanedBrowserProfiles,
  createSchedule,
  deleteWorkflow,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  exportWorkflow,
  exportWorkflowPackage,
  duplicateWorkflow,
  dryRunValidateConfig,
  compileWorkflowGraph,
  getWorkflowSettings,
  resetWorkflowBrowserIdentity,
  listScheduleEvents,
  listSchedules,
  getCloakBrowserDiagnostics,
  getWorkflowBrowserConfig,
  getWorkflowGraph,
  importWorkflow,
  importWorkflowPackage,
  normalizeRecordedEvents,
  runWorkflow,
  runWorkflowFromNode,
  listRunStates,
  saveWorkflowSettings,
  installCloakBrowserBinary,
  saveWorkflowSettingsSection,
  saveWorkflowBrowserConfig,
  saveWorkflowGraph,
  runBatchWorkflow,
  stopRun,
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
  WorkflowSettingsBrowserLaunch,
  WorkflowSettings,
} from "../types/workflow";
import { personaForSeed } from "./personaCatalog";

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
    workflowBridgeMock.listSchedules.mockResolvedValue(undefined);
    workflowBridgeMock.createSchedule.mockResolvedValue(undefined);
    workflowBridgeMock.enableSchedule.mockResolvedValue(undefined);
    workflowBridgeMock.disableSchedule.mockResolvedValue(undefined);
    workflowBridgeMock.deleteSchedule.mockResolvedValue(undefined);
    workflowBridgeMock.listScheduleEvents.mockResolvedValue(undefined);
    workflowBridgeMock.duplicateWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.exportWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.importWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.runBatchWorkflow.mockResolvedValue(undefined);
    workflowBridgeMock.suggestSelectors.mockResolvedValue(undefined);
    workflowBridgeMock.normalizeRecordedEvents.mockResolvedValue(undefined);
    workflowBridgeMock.dryRunValidateConfig.mockResolvedValue(undefined);

    await validateSchedule({
      workflow_id: "workflow-1",
      name: "Hourly",
      enabled: true,
      kind: { type: "interval", every_seconds: 60 },
    });
    await listSchedules();
    await createSchedule({
      workflow_id: "workflow-1",
      name: "Hourly",
      enabled: false,
      kind: { type: "interval", every_seconds: 60 },
    });
    await enableSchedule("schedule-1");
    await disableSchedule("schedule-1");
    await deleteSchedule("schedule-1");
    await listScheduleEvents({ schedule_id: "schedule-1" });
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
    await getCloakBrowserDiagnostics();
    await installCloakBrowserBinary();
    await cleanupOrphanedBrowserProfiles();
    await deleteWorkflow("workflow-1", { deleteBrowserProfile: true });

    expect(workflowBridgeMock.validateSchedule).toHaveBeenCalledWith({
      workflow_id: "workflow-1",
      name: "Hourly",
      enabled: true,
      kind: { type: "interval", every_seconds: 60 },
    });
    expect(workflowBridgeMock.listSchedules).toHaveBeenCalled();
    expect(workflowBridgeMock.createSchedule).toHaveBeenCalledWith({
      workflow_id: "workflow-1",
      name: "Hourly",
      enabled: false,
      kind: { type: "interval", every_seconds: 60 },
    });
    expect(workflowBridgeMock.enableSchedule).toHaveBeenCalledWith("schedule-1");
    expect(workflowBridgeMock.disableSchedule).toHaveBeenCalledWith("schedule-1");
    expect(workflowBridgeMock.deleteSchedule).toHaveBeenCalledWith("schedule-1");
    expect(workflowBridgeMock.listScheduleEvents).toHaveBeenCalledWith({
      schedule_id: "schedule-1",
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
    expect(workflowBridgeMock.getCloakBrowserDiagnostics).toHaveBeenCalled();
    expect(workflowBridgeMock.installCloakBrowserBinary).toHaveBeenCalled();
    expect(workflowBridgeMock.cleanupOrphanedBrowserProfiles).toHaveBeenCalled();
    expect(workflowBridgeMock.deleteWorkflow).toHaveBeenCalledWith(
      "workflow-1",
      { deleteBrowserProfile: true },
    );
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
        browser_launch: browserLaunchSettings(),
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
    workflowBridgeMock.runWorkflowFromNode.mockResolvedValue(undefined);
    workflowBridgeMock.listRunStates.mockResolvedValue(undefined);
    workflowBridgeMock.stopRun.mockResolvedValue(undefined);

    await getWorkflowGraph("workflow-1");
    await saveWorkflowGraph("workflow-1", graph);
    await validateWorkflowGraph(graph);
    await compileWorkflowGraph(graph);
    await runWorkflow("workflow-1");
    await runWorkflowFromNode("workflow-1", "step-1");
    await listRunStates();
    await stopRun("run-1");

    expect(workflowBridgeMock.getWorkflowGraph).toHaveBeenCalledWith("workflow-1");
    expect(workflowBridgeMock.saveWorkflowGraph).toHaveBeenCalledWith(
      "workflow-1",
      graph,
    );
    expect(workflowBridgeMock.validateWorkflowGraph).toHaveBeenCalledWith(graph);
    expect(workflowBridgeMock.compileWorkflowGraph).toHaveBeenCalledWith(graph);
    expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
    expect(workflowBridgeMock.runWorkflowFromNode).toHaveBeenCalledWith(
      "workflow-1",
      "step-1",
    );
    expect(workflowBridgeMock.listRunStates).toHaveBeenCalled();
    expect(workflowBridgeMock.stopRun).toHaveBeenCalledWith("run-1");
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
      headless: false,
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
        execute_js_enabled: true,
        batch_concurrency_limit: null,
        batch_headless: false,
        batch_stop_on_first_failed_row: false,
      },
      browser_launch: browserLaunchSettings(),
      graph_defaults: {
        default_edge_delay: null,
      },
      environment: {
        initial_variables: [],
      },
      migration_notes: [],
      created_at: "1",
      updated_at: "1",
    };

    workflowBridgeMock.getWorkflowSettings.mockResolvedValue(settings);
    workflowBridgeMock.resetWorkflowBrowserIdentity.mockResolvedValue(settings);
    workflowBridgeMock.saveWorkflowSettings.mockResolvedValue(settings);
    workflowBridgeMock.saveWorkflowSettingsSection.mockResolvedValue(settings);
    workflowBridgeMock.validateWorkflowSettings.mockResolvedValue([]);
    workflowBridgeMock.validateWorkflowRun.mockResolvedValue([]);

    await getWorkflowSettings("workflow-1");
    await resetWorkflowBrowserIdentity("workflow-1");
    await saveWorkflowSettings("workflow-1", settings);
    await saveWorkflowSettingsSection("workflow-1", "browser_launch", settings.browser_launch);
    await validateWorkflowSettings(settings);
    await validateWorkflowRun("workflow-1");

    expect(workflowBridgeMock.getWorkflowSettings).toHaveBeenCalledWith(
      "workflow-1",
    );
    expect(workflowBridgeMock.resetWorkflowBrowserIdentity).toHaveBeenCalledWith(
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

function browserLaunchSettings(): WorkflowSettingsBrowserLaunch {
  const persona = personaForSeed("bi_workflow-1");
  return {
    session_mode: "temporary",
    identity_id: "bi_workflow-1",
    display_name: "Login flow identity",
    persona_id: persona.id,
    persona,
    profile_dir: "bi_workflow-1",
    fingerprint_seed: "14523",
    profile_name: null,
    fingerprint_fonts_dir: null,
    timezone: null,
    locale: null,
    geoip: false,
    proxy_bypass: null,
    webrtc_policy: "default",
    webrtc_ip: null,
    preflight_enabled: false,
    preflight_probe_url: null,
    preflight_allowed_origins: [],
    proxy_enabled: false,
    proxy_server: null,
    proxy_username: null,
    proxy_password: null,
    headless: false,
    humanize: true,
    human_preset: "default",
    run_from_selected_enabled: false,
  };
}
