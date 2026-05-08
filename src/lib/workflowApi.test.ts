import { describe, expect, test } from "vitest";
import { invokeMock, resetTauriInvoke } from "../tests/mocks/tauri";
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
import { defaultBehaviorProfile } from "../features/workflows/lib/workflowSettings";

describe("workflow API phase ten commands", () => {
  test("invokes orchestration commands with frontend-safe payloads", async () => {
    resetTauriInvoke();
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

    invokeMock.mockResolvedValue(undefined);

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

    expect(invokeMock).toHaveBeenCalledWith("validate_schedule", {
      schedule: {
        workflow_id: "workflow-1",
        enabled: true,
        kind: { kind: "interval", every_seconds: 60 },
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("duplicate_workflow", {
      workflowId: "workflow-1",
      name: "Copy of Export me",
    });
    expect(invokeMock).toHaveBeenCalledWith("export_workflow", {
      workflowId: "workflow-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("import_workflow", { exported });
    expect(invokeMock).toHaveBeenCalledWith("run_batch_workflow", {
      workflowId: "workflow-1",
      request: {
        rows: [{ email: "a@example.com" }],
        concurrency_limit: 1,
        headless: false,
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("suggest_selectors", {
      snapshot: {
        tag: "button",
        id: "save",
        test_id: "save-button",
        name: null,
        text: "Save",
        classes: [],
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("normalize_recorded_events", {
      events: [{ type: "click", xpath: "//*[@id='save']" }],
    });
    expect(invokeMock).toHaveBeenCalledWith("dry_run_validate_config", {
      config: { type: "wait", config: { condition: "duration", duration_ms: 1000 } },
    });
  });

  test("invokes workflow package commands with selected sections", async () => {
    resetTauriInvoke();
    const workflowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Login flow" },
      included_sections: ["flow", "settings.general", "settings.browser"],
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
        browser: {
          proxy_enabled: false,
          mobile: false,
          touch: false,
          challenge_policy: "none",
          headless: false,
        },
      },
    };

    invokeMock.mockResolvedValue(undefined);

    await exportWorkflowPackage("workflow-1", {
      include_flow: true,
      settings_sections: ["general", "browser"],
    });
    await previewWorkflowPackage(workflowPackage);
    await importWorkflowPackage(workflowPackage, {
      include_flow: true,
      settings_sections: ["general", "browser"],
    });

    expect(invokeMock).toHaveBeenCalledWith("export_workflow_package", {
      workflowId: "workflow-1",
      options: {
        include_flow: true,
        settings_sections: ["general", "browser"],
      },
    });
    expect(invokeMock).toHaveBeenCalledWith("preview_workflow_package", {
      package: workflowPackage,
    });
    expect(invokeMock).toHaveBeenCalledWith("import_workflow_package", {
      package: workflowPackage,
      options: {
        include_flow: true,
        settings_sections: ["general", "browser"],
      },
    });
  });
});

describe("workflow API graph commands", () => {
  test("invokes graph commands with frontend-safe payloads", async () => {
    resetTauriInvoke();
    const graph: WorkflowGraph = {
      version: 1,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    invokeMock.mockResolvedValue(undefined);

    await getWorkflowGraph("workflow-1");
    await saveWorkflowGraph("workflow-1", graph);
    await validateWorkflowGraph(graph);
    await compileWorkflowGraph(graph);
    await runWorkflow("workflow-1");

    expect(invokeMock).toHaveBeenCalledWith("get_workflow_graph", {
      workflowId: "workflow-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("save_workflow_graph", {
      workflowId: "workflow-1",
      graph,
    });
    expect(invokeMock).toHaveBeenCalledWith("validate_workflow_graph", { graph });
    expect(invokeMock).toHaveBeenCalledWith("compile_workflow_graph", { graph });
    expect(invokeMock).toHaveBeenCalledWith("run_workflow", {
      workflowId: "workflow-1",
    });
  });
});

describe("workflow API browser config commands", () => {
  test("invokes workflow browser config commands with frontend-safe payloads", async () => {
    resetTauriInvoke();
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

    invokeMock.mockResolvedValue(undefined);

    await getWorkflowBrowserConfig("workflow-1");
    await saveWorkflowBrowserConfig("workflow-1", config);

    expect(invokeMock).toHaveBeenCalledWith("get_workflow_browser_config", {
      workflowId: "workflow-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("save_workflow_browser_config", {
      workflowId: "workflow-1",
      config,
    });
  });
});

describe("workflow API settings commands", () => {
  test("invokes workflow settings commands with frontend-safe payloads", async () => {
    resetTauriInvoke();
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
      execution: {
        default_action_timeout_ms: null,
        default_retry_attempts: null,
        default_retry_interval_ms: null,
        max_workflow_duration_ms: null,
        browser_retention: "retain",
        failure_policy: "stop_on_first_failure",
        batch_concurrency_limit: null,
        batch_headless: false,
        batch_stop_on_first_failed_row: false,
        output_retention_days: null,
      },
      browser: {
        profile_name: null,
        proxy_enabled: false,
        proxy_server: null,
        proxy_username: null,
        proxy_password: null,
        user_agent: null,
        viewport_width: null,
        viewport_height: null,
        mobile: false,
        touch: false,
        challenge_policy: "none",
        headless: false,
      },
      behavior: defaultBehaviorProfile(),
      environment: {
        geolocation: null,
        permissions: [],
        extra_http_headers: [],
        locale: null,
        timezone: null,
        download_directory: null,
        cookies: [],
        local_storage: [],
        session_storage: [],
        session_restore_ref: null,
      },
      inputs: {
        input_schema: [],
        initial_variables: [],
        batch_mapping: [],
      },
      triggers: {
        enabled: false,
        mode: "manual",
        interval_seconds: null,
        once_at: null,
        input_source: null,
        batch_source_ref: null,
        missed_run_policy: "skip",
        concurrency_policy: "skip_if_running",
        last_run_at: null,
        next_run_at: null,
      },
      advanced: {
        compatibility_warnings: [],
        debug_logging_level: "off",
        experimental_flags: [],
      },
      created_at: "1",
      updated_at: "1",
    };

    invokeMock.mockResolvedValue(settings);

    await getWorkflowSettings("workflow-1");
    await saveWorkflowSettings("workflow-1", settings);
    await saveWorkflowSettingsSection("workflow-1", "browser", settings.browser);
    await validateWorkflowSettings(settings);
    await validateWorkflowRun("workflow-1");

    expect(invokeMock).toHaveBeenCalledWith("get_workflow_settings", {
      workflowId: "workflow-1",
    });
    expect(invokeMock).toHaveBeenCalledWith("save_workflow_settings", {
      workflowId: "workflow-1",
      settings,
    });
    expect(invokeMock).toHaveBeenCalledWith("save_workflow_settings_section", {
      workflowId: "workflow-1",
      section: "browser",
      sectionValue: settings.browser,
    });
    expect(invokeMock).toHaveBeenCalledWith("validate_workflow_settings", {
      settings,
    });
    expect(invokeMock).toHaveBeenCalledWith("validate_workflow_run", {
      workflowId: "workflow-1",
    });
  });
});
