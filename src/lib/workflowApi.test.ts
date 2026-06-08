import { describe, expect, test } from "vitest";
import {
  resetWorkflowBridge,
  workflowBridgeMock,
} from "../tests/mocks/electron";
import {
  cleanupOrphanedBrowserProfiles,
  createProject,
  createProjectEnvironment,
  createSubflow,
  createSchedule,
  deleteWorkflow,
  deleteProject,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  exportWorkflow,
  exportWorkflowPackage,
  exportProjectPackage,
  duplicateWorkflow,
  duplicateProject,
  duplicateSubflow,
  dryRunValidateConfig,
  compileWorkflowGraph,
  getWorkflowSettings,
  getSubflow,
  getSubflowGraph,
  getSubflowUsage,
  generateRecordingDraft,
  getRecordingDraft,
  getRecordingSession,
  resetWorkflowBrowserIdentity,
  listScheduleEvents,
  listSchedules,
  listRecordingEvents,
  getCloakBrowserDiagnostics,
  getOperationsOverview,
  listEvidenceItems,
  listProjects,
  listProjectEnvironments,
  listSubflows,
  getEvidenceDetail,
  getEvidenceScreenshotPreview,
  revealEvidenceArtifact,
  exportEvidenceBundle,
  getIdentityLabOverview,
  getIdentityLabDetail,
  closeIdentityRetainedSession,
  getWorkflowBrowserConfig,
  getWorkflowGraph,
  importWorkflow,
  importWorkflowPackage,
  importProjectPackage,
  runWorkflow,
  runWorkflowFromNode,
  listRunStates,
  saveWorkflowSettings,
  saveSubflowGraph,
  saveRecordingDraft,
  startRecordingSession,
  installCloakBrowserBinary,
  saveWorkflowSettingsSection,
  saveWorkflowBrowserConfig,
  saveWorkflowGraph,
  stopRecordingSession,
  discardRecordingSession,
  runBatchWorkflow,
  stopRun,
  validateWorkflowSettings,
  validateWorkflowGraph,
  validateWorkflowRun,
  validateSchedule,
  previewWorkflowPackage,
  previewProjectPackage,
  setWorkflowEnvironment,
  deleteSubflow,
  updateProjectEnvironment,
  updateProject,
  updateSubflow,
  resetProjectEnvironmentBrowserIdentity,
  saveProjectPackageFile,
} from "./workflowApi";
import type {
  ProjectPackage,
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
    workflowBridgeMock.dryRunValidateConfig.mockResolvedValue(undefined);
    workflowBridgeMock.startRecordingSession.mockResolvedValue(undefined);
    workflowBridgeMock.getRecordingSession.mockResolvedValue(undefined);
    workflowBridgeMock.stopRecordingSession.mockResolvedValue(undefined);
    workflowBridgeMock.listRecordingEvents.mockResolvedValue(undefined);
    workflowBridgeMock.discardRecordingSession.mockResolvedValue(undefined);
    workflowBridgeMock.generateRecordingDraft.mockResolvedValue(undefined);
    workflowBridgeMock.getRecordingDraft.mockResolvedValue(undefined);
    workflowBridgeMock.saveRecordingDraft.mockResolvedValue(undefined);
    workflowBridgeMock.getOperationsOverview.mockResolvedValue(undefined);
    workflowBridgeMock.listEvidenceItems.mockResolvedValue(undefined);
    workflowBridgeMock.getEvidenceDetail.mockResolvedValue(undefined);
    workflowBridgeMock.getEvidenceScreenshotPreview.mockResolvedValue(undefined);
    workflowBridgeMock.revealEvidenceArtifact.mockResolvedValue(undefined);
    workflowBridgeMock.exportEvidenceBundle.mockResolvedValue(undefined);
    workflowBridgeMock.getIdentityLabOverview.mockResolvedValue(undefined);
    workflowBridgeMock.getIdentityLabDetail.mockResolvedValue(undefined);
    workflowBridgeMock.closeIdentityRetainedSession.mockResolvedValue(undefined);
    workflowBridgeMock.listProjects.mockResolvedValue(undefined);
    workflowBridgeMock.createProject.mockResolvedValue(undefined);
    workflowBridgeMock.updateProject.mockResolvedValue(undefined);
    workflowBridgeMock.duplicateProject.mockResolvedValue(undefined);
    workflowBridgeMock.exportProjectPackage.mockResolvedValue(undefined);
    workflowBridgeMock.previewProjectPackage.mockResolvedValue(undefined);
    workflowBridgeMock.importProjectPackage.mockResolvedValue(undefined);
    workflowBridgeMock.saveProjectPackageFile.mockResolvedValue(undefined);
    workflowBridgeMock.deleteProject.mockResolvedValue(undefined);
    workflowBridgeMock.listProjectEnvironments.mockResolvedValue(undefined);
    workflowBridgeMock.createProjectEnvironment.mockResolvedValue(undefined);
    workflowBridgeMock.updateProjectEnvironment.mockResolvedValue(undefined);
    workflowBridgeMock.resetProjectEnvironmentBrowserIdentity.mockResolvedValue(undefined);
    workflowBridgeMock.setWorkflowEnvironment.mockResolvedValue(undefined);
    workflowBridgeMock.createSubflow.mockResolvedValue(undefined);
    workflowBridgeMock.listSubflows.mockResolvedValue(undefined);
    workflowBridgeMock.getSubflow.mockResolvedValue(undefined);
    workflowBridgeMock.getSubflowGraph.mockResolvedValue(undefined);
    workflowBridgeMock.saveSubflowGraph.mockResolvedValue(undefined);
    workflowBridgeMock.duplicateSubflow.mockResolvedValue(undefined);
    workflowBridgeMock.deleteSubflow.mockResolvedValue(undefined);
    workflowBridgeMock.getSubflowUsage.mockResolvedValue(undefined);

    await listProjects();
    await createProject({ name: "Owned Lab", description: "staging" });
    await updateProject("project-1", { name: "Owned Lab 2", description: "" });
    await duplicateProject("project-1");
    const projectPackage: ProjectPackage = {
      kind: "project_package",
      version: 1,
      project: { name: "Owned Lab 2", description: "" },
      included_sections: ["project", "environments", "subflows", "workflows"],
      omitted_fields: [],
      environments: [],
      subflows: [],
      workflows: [],
    };
    await exportProjectPackage("project-1");
    await previewProjectPackage(projectPackage);
    await importProjectPackage(projectPackage);
    await saveProjectPackageFile(projectPackage);
    await deleteProject("project-1");
    await listProjectEnvironments("project-1");
    await createProjectEnvironment("project-1", {
      name: "Staging identity",
      description: "Proxy posture",
    });
    await updateProjectEnvironment("environment-1", { name: "Updated" });
    await resetProjectEnvironmentBrowserIdentity("environment-1");
    await setWorkflowEnvironment("workflow-1", "environment-1");
    await createSubflow("project-1", { name: "Login" });
    await listSubflows("project-1");
    await getSubflow("subflow-1");
    await getSubflowGraph("subflow-1");
    await saveSubflowGraph("subflow-1", { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } });
    await duplicateSubflow("subflow-1", "Login copy");
    await deleteSubflow("subflow-1");
    await getSubflowUsage("subflow-1");
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
    await startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded checkout",
      initial_url: "https://owned.test/checkout",
    });
    await getRecordingSession("recording-1");
    await stopRecordingSession("recording-1");
    await listRecordingEvents("recording-1");
    await discardRecordingSession("recording-1");
    await generateRecordingDraft("recording-1", {
      include_event_ids: ["event-1"],
      add_terminal_success: true,
    });
    await getRecordingDraft("draft-1");
    await saveRecordingDraft("draft-1", {
      workflow_name: "Recorded checkout",
      save_mode: "create_new",
      reviewed_steps: [],
      add_terminal_success: true,
    });
    await dryRunValidateConfig({
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    });
    await getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });
    await listEvidenceItems({
      types: ["screenshot"],
      sources: ["manual"],
      search: "checkout",
      limit: 25,
    });
    await getEvidenceDetail("ev-1");
    await getEvidenceScreenshotPreview("ev-1");
    await revealEvidenceArtifact("ev-1");
    await exportEvidenceBundle({ evidence_ids: ["ev-1"] });
    await getIdentityLabOverview({ selected_target: { type: "managed", workflow_id: "workflow-1", identity_id: "bi_1" } });
    await getIdentityLabDetail({ type: "managed", workflow_id: "workflow-1", identity_id: "bi_1" });
    await closeIdentityRetainedSession("workflow-1", "profile-1");
    await getCloakBrowserDiagnostics();
    await installCloakBrowserBinary();
    await cleanupOrphanedBrowserProfiles();
    await deleteWorkflow("workflow-1", { deleteBrowserProfile: true });

    expect(workflowBridgeMock.listProjects).toHaveBeenCalled();
    expect(workflowBridgeMock.createProject).toHaveBeenCalledWith({
      name: "Owned Lab",
      description: "staging",
    });
    expect(workflowBridgeMock.updateProject).toHaveBeenCalledWith(
      "project-1",
      { name: "Owned Lab 2", description: "" },
    );
    expect(workflowBridgeMock.duplicateProject).toHaveBeenCalledWith("project-1");
    expect(workflowBridgeMock.exportProjectPackage).toHaveBeenCalledWith("project-1");
    expect(workflowBridgeMock.previewProjectPackage).toHaveBeenCalledWith(projectPackage);
    expect(workflowBridgeMock.importProjectPackage).toHaveBeenCalledWith(projectPackage);
    expect(workflowBridgeMock.saveProjectPackageFile).toHaveBeenCalledWith(projectPackage);
    expect(workflowBridgeMock.deleteProject).toHaveBeenCalledWith("project-1");
    expect(workflowBridgeMock.listProjectEnvironments).toHaveBeenCalledWith("project-1");
    expect(workflowBridgeMock.createProjectEnvironment).toHaveBeenCalledWith(
      "project-1",
      { name: "Staging identity", description: "Proxy posture" },
    );
    expect(workflowBridgeMock.updateProjectEnvironment).toHaveBeenCalledWith(
      "environment-1",
      { name: "Updated" },
    );
    expect(workflowBridgeMock.resetProjectEnvironmentBrowserIdentity).toHaveBeenCalledWith(
      "environment-1",
    );
    expect(workflowBridgeMock.setWorkflowEnvironment).toHaveBeenCalledWith(
      "workflow-1",
      "environment-1",
    );
    expect(workflowBridgeMock.createSubflow).toHaveBeenCalledWith("project-1", {
      name: "Login",
    });
    expect(workflowBridgeMock.listSubflows).toHaveBeenCalledWith("project-1");
    expect(workflowBridgeMock.getSubflow).toHaveBeenCalledWith("subflow-1");
    expect(workflowBridgeMock.getSubflowGraph).toHaveBeenCalledWith("subflow-1");
    expect(workflowBridgeMock.saveSubflowGraph).toHaveBeenCalledWith(
      "subflow-1",
      { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
    );
    expect(workflowBridgeMock.duplicateSubflow).toHaveBeenCalledWith(
      "subflow-1",
      "Login copy",
    );
    expect(workflowBridgeMock.deleteSubflow).toHaveBeenCalledWith("subflow-1");
    expect(workflowBridgeMock.getSubflowUsage).toHaveBeenCalledWith("subflow-1");
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
    expect(workflowBridgeMock.startRecordingSession).toHaveBeenCalledWith({
      mode: "new_workflow",
      workflow_name: "Recorded checkout",
      initial_url: "https://owned.test/checkout",
    });
    expect(workflowBridgeMock.getRecordingSession).toHaveBeenCalledWith("recording-1");
    expect(workflowBridgeMock.stopRecordingSession).toHaveBeenCalledWith("recording-1");
    expect(workflowBridgeMock.listRecordingEvents).toHaveBeenCalledWith("recording-1");
    expect(workflowBridgeMock.discardRecordingSession).toHaveBeenCalledWith("recording-1");
    expect(workflowBridgeMock.generateRecordingDraft).toHaveBeenCalledWith(
      "recording-1",
      {
        include_event_ids: ["event-1"],
        add_terminal_success: true,
      },
    );
    expect(workflowBridgeMock.getRecordingDraft).toHaveBeenCalledWith("draft-1");
    expect(workflowBridgeMock.saveRecordingDraft).toHaveBeenCalledWith(
      "draft-1",
      {
        workflow_name: "Recorded checkout",
        save_mode: "create_new",
        reviewed_steps: [],
        add_terminal_success: true,
      },
    );
    expect(workflowBridgeMock.dryRunValidateConfig).toHaveBeenCalledWith({
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    });
    expect(workflowBridgeMock.getOperationsOverview).toHaveBeenCalledWith({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });
    expect(workflowBridgeMock.listEvidenceItems).toHaveBeenCalledWith({
      types: ["screenshot"],
      sources: ["manual"],
      search: "checkout",
      limit: 25,
    });
    expect(workflowBridgeMock.getEvidenceDetail).toHaveBeenCalledWith("ev-1");
    expect(workflowBridgeMock.getEvidenceScreenshotPreview).toHaveBeenCalledWith("ev-1");
    expect(workflowBridgeMock.revealEvidenceArtifact).toHaveBeenCalledWith("ev-1");
    expect(workflowBridgeMock.exportEvidenceBundle).toHaveBeenCalledWith({
      evidence_ids: ["ev-1"],
    });
    expect(workflowBridgeMock.getIdentityLabOverview).toHaveBeenCalledWith({
      selected_target: { type: "managed", workflow_id: "workflow-1", identity_id: "bi_1" },
    });
    expect(workflowBridgeMock.getIdentityLabDetail).toHaveBeenCalledWith({
      type: "managed",
      workflow_id: "workflow-1",
      identity_id: "bi_1",
    });
    expect(workflowBridgeMock.closeIdentityRetainedSession).toHaveBeenCalledWith(
      "workflow-1",
      "profile-1",
    );
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
      target_project_id: "project-1",
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
        target_project_id: "project-1",
      },
    );
  });

  test("invokes subflow update command with frontend-safe payloads", async () => {
    resetWorkflowBridge();
    workflowBridgeMock.updateSubflow.mockResolvedValue(undefined);

    await updateSubflow("subflow-1", { name: "Login v2" });

    expect(workflowBridgeMock.updateSubflow).toHaveBeenCalledWith("subflow-1", {
      name: "Login v2",
    });
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
        run_from_selected_enabled: false,
        run_from_selected_mode: "from_selected",
        batch_concurrency_limit: null,
        batch_headless: false,
        batch_stop_on_first_failed_row: false,
      },
      browser_launch: browserLaunchSettings(),
      graph_defaults: {
        default_edge_delay: null,
        live_run_enabled: true,
        live_run_follow_current: false,
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
    proxy_enabled: false,
    proxy_server: null,
    proxy_username: null,
    proxy_password: null,
    headless: false,
    humanize: true,
    human_preset: "default",
  };
}
