import { describe, expect, test } from "vitest";
import { invokeMock, resetTauriInvoke } from "../tests/mocks/tauri";
import {
  exportWorkflow,
  dryRunValidateConfig,
  generateFixture,
  compileWorkflowGraph,
  getWorkflowBrowserConfig,
  getWorkflowGraph,
  importWorkflow,
  normalizeRecordedEvents,
  runWorkflow,
  saveWorkflowBrowserConfig,
  saveWorkflowGraph,
  runBatchWorkflow,
  suggestSelectors,
  validateWorkflowGraph,
  validateSchedule,
} from "./workflowApi";
import type { WorkflowExport, WorkflowGraph } from "../types/workflow";

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
    await generateFixture("/tmp/fixture.html", "<button>Save</button>");

    expect(invokeMock).toHaveBeenCalledWith("validate_schedule", {
      schedule: {
        workflow_id: "workflow-1",
        enabled: true,
        kind: { kind: "interval", every_seconds: 60 },
      },
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
    expect(invokeMock).toHaveBeenCalledWith("generate_fixture", {
      path: "/tmp/fixture.html",
      bodyHtml: "<button>Save</button>",
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
