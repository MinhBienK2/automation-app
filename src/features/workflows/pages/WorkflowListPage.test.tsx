import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
  workflowBridgeMock,
} from "../../../tests/mocks/electron";
import {
  newWorkflow,
  sleepStep,
  workflow,
} from "../../../tests/mocks/workflowFixtures";
import {
  idleRunState,
  listWorkflowScenario,
  workflowDetailScenario,
} from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
import { linearGraphFromSteps } from "../lib/workflowGraph";
import type {
  RecordingSession,
  RecordingWorkflowDraft,
  WorkflowPackage,
} from "../../../types/workflow";

describe("Workflow list integration", () => {
  beforeEach(() => {
    resetWorkflowBridge();
  });

  async function confirmLaunchRun(scope: HTMLElement = document.body) {
    await userEvent.click(within(scope).getByRole("button", { name: "Launch Run" }));
    const dialog = await screen.findByRole("dialog", { name: "Launch Run" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Launch Run" }));
  }

  async function openWorkflows() {
    await userEvent.click(await screen.findByRole("button", { name: "Workflows" }));
  }

  async function findWorkflowRow(name: string) {
    return screen.findByRole("row", { name: new RegExp(name, "i") });
  }

  async function openWorkflowGraph(name = "Login flow") {
    const row = await findWorkflowRow(name);
    await userEvent.click(within(row).getByRole("button", {
      name: `Open Graph ${name}`,
    }));
  }

  async function openMoreActions(name = "Login flow") {
    const row = await findWorkflowRow(name);
    await userEvent.click(within(row).getByRole("button", {
      name: `More actions for ${name}`,
    }));
    return screen.findByRole("menu", { name: `More actions for ${name}` });
  }

  async function clickRecordWorkflow() {
    const buttons = await screen.findAllByRole("button", { name: "Record Workflow" });
    await userEvent.click(buttons[0]);
  }

  test("renders a dense table/detail library with local search filters and sort", async () => {
    const supportWorkflow = {
      id: "workflow-2",
      name: "Support flow",
      step_count: 1,
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-28T00:00:00.000Z",
    };
    const activeRun = {
      run_id: "run-login",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      source: "manual",
      started_at: "2026-05-29T10:00:00.000Z",
      state: {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
        current_step_number: 2,
      },
    };
    const schedule = {
      id: "schedule-support",
      workflow_id: supportWorkflow.id,
      workflow_name: supportWorkflow.name,
      name: "Daily support",
      enabled: true,
      kind: { type: "calendar", preset: "daily", time: "09:00" },
      next_run_at: null,
      last_event_at: null,
      last_status: null,
      last_reason: null,
      created_at: "2026-05-29T00:00:00.000Z",
      updated_at: "2026-05-29T00:00:00.000Z",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow, supportWorkflow]),
      list_run_states: [activeRun],
      list_schedules: [schedule],
    });

    renderApp();

    await openWorkflows();

    const library = await screen.findByRole("region", { name: "Workflow library" });
    const table = within(library).getByRole("table", { name: "Workflow library table" });
    expect(within(table).getByRole("columnheader", { name: "Workflow" })).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Status" })).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Login flow.*Running step 2/i }))
      .toBeInTheDocument();
    await userEvent.click(within(table).getByRole("row", {
      name: /Login flow.*Running step 2/i,
    }));
    expect(screen.getByRole("region", { name: "Workflow detail" }))
      .toHaveTextContent("Login flow");

    await userEvent.type(screen.getByRole("searchbox", { name: "Search workflows" }), "Support");
    expect(within(table).queryByRole("row", { name: /Login flow/i })).not.toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Support flow/i })).toBeInTheDocument();

    await userEvent.clear(screen.getByRole("searchbox", { name: "Search workflows" }));
    await userEvent.click(screen.getByRole("button", { name: "Scheduled" }));
    expect(within(table).queryByRole("row", { name: /Login flow/i })).not.toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /Support flow/i })).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Sort workflows"), "name");
    expect(screen.getByLabelText("Sort workflows")).toHaveValue("name");
  });

  test("uses a More menu for secondary workflow actions with active-run guards", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: [
        {
          run_id: "run-login",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          source: "manual",
          started_at: "2026-05-29T10:00:00.000Z",
          state: {
            ...idleRunState,
            status: "running",
            mode: "run_workflow",
          },
        },
      ],
    });

    renderApp();

    await openWorkflows();

    const row = await screen.findByRole("row", { name: /Login flow/i });
    expect(within(row).getByRole("button", { name: "Open Graph Login flow" }))
      .toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Stop Login flow" }))
      .toBeInTheDocument();
    await userEvent.click(within(row).getByRole("button", {
      name: "More actions for Login flow",
    }));

    const menu = await screen.findByRole("menu", { name: "More actions for Login flow" });
    expect(within(menu).getByRole("menuitem", { name: "Settings Login flow" }))
      .toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Duplicate Login flow" }))
      .toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Export Login flow" }))
      .toBeDisabled();
    expect(within(menu).getByRole("menuitem", { name: "Delete Login flow" }))
      .toBeDisabled();
    expect(menu).toHaveTextContent("Workflow currently running");
  });

  test("formats workflow metadata without exposing raw updated timestamps", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([
        {
          ...workflow,
          step_count: 1733,
          updated_at: "1733-raw-timestamp",
        },
      ]),
    });

    renderApp();

    await openWorkflows();

    const row = await findWorkflowRow("Login flow");

    expect(row).toBeInTheDocument();
    expect(within(row).getByText("1733 steps")).toBeInTheDocument();
    expect(screen.queryByText("Updated 1733-raw-timestamp"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("1733-raw-timestamp")).not.toBeInTheDocument();
  });

  test("lists workflows and creates a workflow from a dialog", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      create_workflow: workflow,
      get_workflow: { workflow, steps: [] },
    });

    renderApp();

    await openWorkflows();

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument();
    expect(screen.getByText("Mission Control Workspace")).toBeInTheDocument();
    expect(screen.queryByText("Workflow Automation Manager")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New workflow name")).not.toBeInTheDocument();

    await userEvent.click(screen.getAllByRole("button", { name: "Create Workflow" })[0]);
    const dialog = await screen.findByRole("dialog", { name: "Create Workflow" });

    await userEvent.type(within(dialog).getByLabelText("New workflow name"), "Login flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create Workflow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.createWorkflow).toHaveBeenCalledWith(
        "Login flow",
      );
    });
    expect(await screen.findByRole("button", { name: "Back to Workflows" }))
      .toBeInTheDocument();
  });

  test("records a workflow from the list and saves a reviewed draft", async () => {
    const session = recordingSession();
    const draft = recordingDraft(session.id);
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      start_recording_session: session,
      stop_recording_session: { ...session, status: "stopped" },
      generate_recording_draft: draft,
      save_recording_draft: { workflow: newWorkflow, steps: [] },
      get_workflow: { workflow: newWorkflow, steps: [] },
      get_workflow_graph: draft.graph,
    });

    renderApp();

    await openWorkflows();

    await clickRecordWorkflow();
    expect(workflowBridgeMock.startRecordingSession).toHaveBeenCalledWith({
      mode: "new_workflow",
      workflow_name: "Recorded workflow",
    });

    await userEvent.click(await screen.findByRole("button", {
      name: "Stop Recording",
    }));

    const dialog = await screen.findByRole("dialog", { name: "Review Recording" });
    expect(within(dialog).getByText("qa@example.test")).toBeInTheDocument();
    await userEvent.clear(within(dialog).getByLabelText("Workflow name"));
    await userEvent.type(within(dialog).getByLabelText("Workflow name"), "Recorded signup");
    await userEvent.click(within(dialog).getByRole("button", {
      name: /Step 2 Fill Field/i,
    }));
    const stepLabelInput = within(dialog).getByLabelText("Step label Fill Field");
    await userEvent.clear(stepLabelInput);
    await userEvent.type(stepLabelInput, "Fill recorded email");
    await userEvent.click(within(dialog).getByRole("button", {
      name: /Step 1 Navigate/i,
    }));
    await userEvent.click(within(dialog).getByRole("checkbox", {
      name: "Include Navigate",
    }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Workflow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.saveRecordingDraft).toHaveBeenCalledWith(
        draft.id,
        expect.objectContaining({
          workflow_name: "Recorded signup",
          save_mode: "create_new",
          add_terminal_success: true,
          reviewed_steps: expect.arrayContaining([
            expect.objectContaining({
              label: "Fill recorded email",
              included: true,
            }),
            expect.objectContaining({
              label: "Navigate",
              included: false,
            }),
          ]),
        }),
      );
    });
  });

  test("lets reviewers add explicit upload file paths before saving a recording", async () => {
    const session = recordingSession();
    const draft: RecordingWorkflowDraft = {
      ...recordingDraft(session.id),
      steps: [
        {
          id: "recording-step-upload",
          source_event_ids: ["event-upload"],
          action: {
            type: "upload_file",
            config: {
              target: { locators: [{ kind: "label", value: "Avatar" }] },
              files: [],
              wait_until: "visible",
              timeout_ms: 60000,
            },
          },
          label: "Upload File",
          included: false,
          locator_confidence: "high",
          warnings: [
            {
              code: "upload_requires_reviewed_file_path",
              message:
                "Native file chooser paths are not captured; review and enter local upload file paths before replay.",
              severity: "warning",
            },
          ],
        },
      ],
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      start_recording_session: session,
      stop_recording_session: { ...session, status: "stopped" },
      generate_recording_draft: draft,
      save_recording_draft: { workflow: newWorkflow, steps: [] },
      get_workflow: { workflow: newWorkflow, steps: [] },
      get_workflow_graph: draft.graph,
    });

    renderApp();

    await openWorkflows();

    await clickRecordWorkflow();
    await userEvent.click(await screen.findByRole("button", {
      name: "Stop Recording",
    }));

    const dialog = await screen.findByRole("dialog", { name: "Review Recording" });
    expect(within(dialog).getByText(/Native file chooser paths are not captured/))
      .toBeInTheDocument();
    await userEvent.type(
      within(dialog).getByLabelText("Upload file paths"),
      "/tmp/automation-app-fixtures/fixture-upload.txt",
    );
    await userEvent.click(within(dialog).getByRole("checkbox", {
      name: "Include Upload File",
    }));
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Workflow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.saveRecordingDraft).toHaveBeenCalledWith(
        draft.id,
        expect.objectContaining({
          reviewed_steps: [
            expect.objectContaining({
              included: true,
              action: {
                type: "upload_file",
                config: expect.objectContaining({
                  files: ["/tmp/automation-app-fixtures/fixture-upload.txt"],
                }),
              },
            }),
          ],
        }),
      );
    });
  });

  test("records a replacement draft from workflow detail and saves it as replace graph", async () => {
    const session: RecordingSession = {
      ...recordingSession(),
      workflow_id: workflow.id,
      mode: "replace_current_graph",
    };
    const draft: RecordingWorkflowDraft = {
      ...recordingDraft(session.id),
      workflow_id: workflow.id,
      mode: "replace_current_graph",
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      ...listWorkflowScenario([workflow]),
      start_recording_session: session,
      stop_recording_session: { ...session, status: "stopped" },
      generate_recording_draft: draft,
      save_recording_draft: { workflow, steps: [] },
      get_workflow: { workflow, steps: [] },
      get_workflow_graph: draft.graph,
    });

    renderApp();

    await openWorkflows();

    await openWorkflowGraph();
    await userEvent.click(await screen.findByRole("button", {
      name: "Record Replacement",
    }));

    expect(workflowBridgeMock.startRecordingSession).toHaveBeenCalledWith({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
    });

    await userEvent.click(await screen.findByRole("button", {
      name: "Stop Recording",
    }));
    const dialog = await screen.findByRole("dialog", { name: "Review Recording" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Replace Graph" }));

    await waitFor(() => {
      expect(workflowBridgeMock.saveRecordingDraft).toHaveBeenCalledWith(
        draft.id,
        expect.objectContaining({
          workflow_name: workflow.name,
          save_mode: "replace_graph",
          reviewed_steps: draft.steps,
        }),
      );
    });
  });

  test("saves dirty workflow settings before starting replacement recording", async () => {
    const scenario = workflowDetailScenario([]);
    const saveSettingsSection = vi.fn(
      ({
        section,
        sectionValue,
      }: {
        section: keyof typeof scenario.get_workflow_settings;
        sectionValue: unknown;
      }) => ({
        ...scenario.get_workflow_settings,
        [section]: sectionValue,
      }),
    );
    const session: RecordingSession = {
      ...recordingSession(),
      workflow_id: workflow.id,
      mode: "replace_current_graph",
      workflow_settings_snapshot: scenario.get_workflow_settings,
    };
    mockWorkflowBridgeCommands({
      ...scenario,
      ...listWorkflowScenario([workflow]),
      save_workflow_settings_section: saveSettingsSection,
      start_recording_session: session,
    });

    renderApp();

    await openWorkflows();

    await openWorkflowGraph();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await userEvent.click(within(controlsRow).getByRole("button", { name: "Settings" }));
    const settingsDialog = await screen.findByRole("dialog", { name: "Workflow Settings" });
    await userEvent.click(within(settingsDialog).getByRole("switch", {
      name: "Headless browser",
    }));

    fireEvent.click(screen.getByRole("button", {
      name: "Record Replacement",
      hidden: true,
    }));

    await waitFor(() => {
      expect(workflowBridgeMock.startRecordingSession).toHaveBeenCalledWith({
        mode: "replace_current_graph",
        workflow_id: workflow.id,
        workflow_name: workflow.name,
      });
    });
    expect(workflowBridgeMock.saveWorkflowSettingsSection).toHaveBeenCalledWith(
      workflow.id,
      "browser_launch",
      expect.objectContaining({ headless: true }),
    );
    expect(
      workflowBridgeMock.saveWorkflowSettingsSection.mock.invocationCallOrder[0],
    ).toBeLessThan(
      workflowBridgeMock.startRecordingSession.mock.invocationCallOrder[0],
    );
  });

  test("shows compact row actions and secondary More menu actions", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await openWorkflows();

    const row = await findWorkflowRow("Login flow");

    expect(row).toBeInTheDocument();
    expect(within(row).getByRole("button", {
      name: "Open Graph Login flow",
    })).toHaveAttribute("data-tooltip", "Open Graph Login flow");
    expect(within(row).getByRole("button", {
      name: "Run Login flow",
    })).toHaveAttribute("data-tooltip", "Run Login flow");
    expect(within(row).getByRole("button", {
      name: "More actions for Login flow",
    })).toHaveAttribute("data-tooltip", "More actions for Login flow");

    const menu = await openMoreActions();
    expect(within(menu).getByRole("menuitem", {
      name: "Settings Login flow",
    })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", {
      name: "Duplicate Login flow",
    })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", {
      name: "Export Login flow",
    })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", {
      name: "Delete Login flow",
    })).toBeInTheDocument();
  });

  test("runs a saved workflow from the list without opening the detail page", async () => {
    let runStarted = false;
    const activeRun = {
      run_id: "run-1",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      source: "manual",
      started_at: "2026-05-17T09:00:00.000Z",
      state: {
        ...idleRunState,
        status: "running" as const,
        mode: "run_workflow" as const,
      },
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: () => runStarted ? [activeRun] : [],
      run_workflow: () => {
        runStarted = true;
        return activeRun;
      },
    });

    renderApp();

    await openWorkflows();

    await userEvent.click(await screen.findByRole("button", {
      name: "Run Login flow",
    }));

    await waitFor(() => {
      expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
    });
    expect(workflowBridgeMock.getWorkflow).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Back to Workflows" }))
      .not.toBeInTheDocument();
    expect((await screen.findAllByText("Running")).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Stop Login flow" })).toBeInTheDocument();
  });

  test("disables list run buttons while a run is already active", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: [
        {
          run_id: "run-1",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          source: "manual",
          started_at: "2026-05-17T09:00:00.000Z",
          state: {
            ...idleRunState,
            status: "running",
            mode: "run_workflow",
          },
        },
      ],
    });

    renderApp();

    await openWorkflows();

    expect(await screen.findByRole("button", { name: "Stop Login flow" }))
      .toBeInTheDocument();
  });

  test("disables destructive workflow actions while a run is already active", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: [
        {
          run_id: "run-1",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          source: "manual",
          started_at: "2026-05-17T09:00:00.000Z",
          state: {
            ...idleRunState,
            status: "running",
            mode: "run_workflow",
          },
        },
      ],
    });

    renderApp();

    await openWorkflows();

    const menu = await openMoreActions();
    expect(within(menu).getByRole("menuitem", {
      name: "Duplicate Login flow",
    })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", {
      name: "Export Login flow",
    })).toBeDisabled();
    expect(within(menu).getByRole("menuitem", {
      name: "Delete Login flow",
    })).toBeDisabled();

    await userEvent.click(within(menu).getByRole("menuitem", {
      name: "Delete Login flow",
    }));

    expect(screen.queryByRole("dialog", { name: "Delete Workflow" })).not.toBeInTheDocument();
    expect(workflowBridgeMock.deleteWorkflow).not.toHaveBeenCalled();
  });

  test("scopes running status and stop controls to the active workflow row", async () => {
    const secondWorkflow = {
      id: "workflow-2",
      name: "Support flow",
      step_count: 0,
      created_at: "2",
      updated_at: "2",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow, secondWorkflow]),
      list_run_states: [
        {
          run_id: "run-1",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          source: "manual",
          started_at: "2026-05-17T09:00:00.000Z",
          state: {
            ...idleRunState,
            status: "running",
            mode: "run_workflow",
            current_step_number: 1,
          },
        },
      ],
      stop_run: { ...idleRunState, status: "stopped" },
    });

    renderApp();

    await openWorkflows();

    const loginRow = await findWorkflowRow("Login flow");
    const supportRow = await findWorkflowRow("Support flow");

    expect(within(loginRow).getByRole("button", {
      name: "Stop Login flow",
    })).toBeInTheDocument();
    expect(within(loginRow).getByText("Running step 1"))
      .toBeInTheDocument();
    await userEvent.click(within(loginRow).getByRole("button", {
      name: "Stop Login flow",
    }));

    expect(within(supportRow).getByRole("button", {
      name: "Run Support flow",
    })).not.toBeDisabled();
    expect(workflowBridgeMock.stopRun).toHaveBeenCalledWith("run-1");
  });

  test("Runs renders multiple active runs and stops the selected run", async () => {
    const secondWorkflow = {
      id: "workflow-2",
      name: "Support flow",
      step_count: 0,
      created_at: "2",
      updated_at: "2",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow, secondWorkflow]),
      list_run_states: [
        {
          run_id: "run-1",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          source: "manual",
          started_at: "2026-05-17T09:00:00.000Z",
          state: {
            ...idleRunState,
            status: "running",
            mode: "run_workflow",
            current_step_number: 1,
          },
        },
        {
          run_id: "run-2",
          workflow_id: secondWorkflow.id,
          workflow_name: secondWorkflow.name,
          source: "schedule",
          started_at: "2026-05-17T09:00:05.000Z",
          state: {
            ...idleRunState,
            status: "running",
            mode: "run_workflow",
            error: null,
          },
        },
      ],
      stop_run: { ...idleRunState, status: "stopped" },
    });

    renderApp();

    await openWorkflows();

    await userEvent.click(await screen.findByRole("button", { name: "Runs" }));

    const runCenter = await screen.findByRole("region", { name: "Runs" });
    expect(within(runCenter).getByRole("heading", { name: "Runs" }))
      .toBeInTheDocument();
    expect(within(runCenter).getByText("Login flow")).toBeInTheDocument();
    expect(within(runCenter).getByText("Support flow")).toBeInTheDocument();
    expect(within(runCenter).getByText("Schedule")).toBeInTheDocument();

    const supportRow = within(runCenter).getByText("Support flow").closest("tr");
    await userEvent.click(within(supportRow as HTMLElement).getByRole("button", {
      name: "Stop Support flow run",
    }));

    expect(workflowBridgeMock.stopRun).toHaveBeenCalledWith("run-2");
  });

  test("confirms deletion in an app dialog instead of using the browser confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await openWorkflows();

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", { name: "Delete Login flow" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete Workflow" });
    expect(within(dialog).getByText(/This removes Login flow/i)).toBeInTheDocument();
    const profileDataCheckbox = within(dialog).getByRole("checkbox", {
      name: "Delete private browser profile data",
    });
    expect(profileDataCheckbox).not.toBeChecked();
    expect(within(dialog).getByText(/Keep it when you want retained login state/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/unshared inactive profile directories/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/backend can reject active run/i))
      .toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    await userEvent.click(profileDataCheckbox);
    await userEvent.click(within(dialog).getByRole("button", { name: "Delete Workflow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.deleteWorkflow).toHaveBeenCalledWith(
        "workflow-1",
        { deleteBrowserProfile: true },
      );
    });
  });

  test("duplicates a workflow from the list", async () => {
    const copiedWorkflow = {
      id: "workflow-copy",
      name: "Copy of Login flow",
      step_count: 0,
      created_at: "2",
      updated_at: "2",
    };
    let duplicated = false;

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_workflows: () => duplicated ? [workflow, copiedWorkflow] : [workflow],
      duplicate_workflow: () => {
        duplicated = true;
        return {
          workflow: {
            id: copiedWorkflow.id,
            name: copiedWorkflow.name,
            created_at: copiedWorkflow.created_at,
            updated_at: copiedWorkflow.updated_at,
          },
          steps: [sleepStep],
        };
      },
    });

    renderApp();

    await openWorkflows();

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", {
      name: "Duplicate Login flow",
    }));
    const dialog = await screen.findByRole("dialog", { name: "Duplicate Workflow" });
    expect(within(dialog).getByText(/Copy of Login flow/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/Browser identity, profile, and fingerprint are fresh/i))
      .toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", {
      name: "Duplicate Workflow",
    }));

    await waitFor(() => {
      expect(workflowBridgeMock.duplicateWorkflow).toHaveBeenCalledWith(
        "workflow-1",
        "Copy of Login flow",
      );
    });
    expect(await screen.findByText("Copy of Login flow")).toBeInTheDocument();
  });

  test("exports a workflow package from the list", async () => {
    const workflowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Login flow" },
      included_sections: ["flow", "settings.general", "settings.execution"],
      omitted_fields: [],
      flow: linearGraphFromSteps([sleepStep]),
      settings: {
        general: {
          name: "Login flow",
          description: "",
          tags: [],
          notes: "",
        },
      },
    };

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      export_workflow_package: workflowPackage,
      save_workflow_package_file: "/tmp/login-flow.workflow.json",
    });

    renderApp();

    await openWorkflows();

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", {
      name: "Export Login flow",
    }));
    const dialog = await screen.findByRole("dialog", { name: "Export Workflow" });
    expect(within(dialog).getByText(/Create a workflow package for Login flow/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/Proxy credentials/i)).toBeInTheDocument();
    expect(within(dialog).getByText(/native Save dialog/i)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Export" }));

    await waitFor(() => {
      expect(workflowBridgeMock.exportWorkflowPackage).toHaveBeenCalledWith(
        "workflow-1",
        {
          include_flow: true,
          settings_sections: [
            "general",
            "run_policy",
            "browser_launch",
            "graph_defaults",
            "environment",
          ],
        },
      );
      expect(workflowBridgeMock.saveWorkflowPackageFile).toHaveBeenCalledWith(
        workflowPackage,
      );
    });
  });

  test("imports a workflow package as a new workflow", async () => {
    const workflowPackage: WorkflowPackage = {
      kind: "workflow_package",
      version: 2,
      workflow: { name: "Imported package" },
      included_sections: ["flow", "settings.general"],
      omitted_fields: ["settings.browser_launch.proxy_password"],
      flow: linearGraphFromSteps([sleepStep]),
      settings: {
        general: {
          name: "Imported package",
          description: "Shared workflow",
          tags: [],
          notes: "",
        },
      },
    };
    const importedWorkflow = {
      id: "workflow-imported",
      name: "Imported package (imported)",
      created_at: "3",
      updated_at: "3",
    };
    let listCalls = 0;

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_workflows: () => {
        listCalls += 1;
        return listCalls === 1
          ? [workflow]
          : [{ ...importedWorkflow, step_count: 0 }, workflow];
      },
      preview_workflow_package: {
        workflow_name: "Imported package",
        includes_flow: true,
        settings_sections: ["general"],
        omitted_fields: ["settings.browser_launch.proxy_password"],
      },
      import_workflow_package: {
        workflow: importedWorkflow,
        steps: [],
      },
      get_workflow: {
        workflow: importedWorkflow,
        steps: [],
      },
      get_workflow_graph: workflowPackage.flow,
      get_workflow_settings: {
        ...workflowDetailScenario([]).get_workflow_settings,
        workflow_id: "workflow-imported",
        general: {
          ...workflowDetailScenario([]).get_workflow_settings.general,
          name: "Imported package (imported)",
          description: "Shared workflow",
          created_at: "3",
          updated_at: "3",
        },
      },
    });

    renderApp();

    await openWorkflows();

    const file = new File([JSON.stringify(workflowPackage)], "workflow.json", {
      type: "application/json",
    });
    await userEvent.upload(
      await screen.findByLabelText("Workflow package file"),
      file,
    );
    const dialog = await screen.findByRole("dialog", { name: "Import Workflow" });
    expect(within(dialog).getByText("Imported package")).toBeInTheDocument();
    expect(within(dialog).getByText("Flow")).toBeInTheDocument();
    expect(within(dialog).getByText("General")).toBeInTheDocument();
    expect(within(dialog).getByText(/never overwrites an existing one/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/Failed validation leaves no partial workflow/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/Omitted or sanitized fields/i))
      .toHaveTextContent("settings.browser_launch.proxy_password");

    await userEvent.click(within(dialog).getByRole("button", { name: "Import" }));

    await waitFor(() => {
      expect(workflowBridgeMock.previewWorkflowPackage).toHaveBeenCalledWith(
        workflowPackage,
      );
      expect(workflowBridgeMock.importWorkflowPackage).toHaveBeenCalledWith(
        workflowPackage,
        {
          include_flow: true,
          settings_sections: ["general"],
        },
      );
    });
    expect(await screen.findByRole("button", { name: "Back to Workflows" }))
      .toBeInTheDocument();
  });

  test("rejects oversized workflow packages before reading JSON", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));
    renderApp();

    await openWorkflows();

    const file = new File([new Uint8Array(5 * 1024 * 1024 + 1)], "huge.workflow.json", {
      type: "application/json",
    });
    const textSpy = vi.fn(async () => "{}");
    Object.defineProperty(file, "text", { value: textSpy });

    await userEvent.upload(
      await screen.findByLabelText("Workflow package file"),
      file,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Workflow package file must be 5 MB or smaller",
    );
    expect(textSpy).not.toHaveBeenCalled();
    expect(workflowBridgeMock.previewWorkflowPackage).not.toHaveBeenCalled();
  });

  test("opens workflow settings General from the list edit action", async () => {
    const scenario = workflowDetailScenario([]);
    mockWorkflowBridgeCommands({
      ...scenario,
      ...listWorkflowScenario([workflow]),
      get_workflow_settings: {
        ...scenario.get_workflow_settings,
        general: {
          ...scenario.get_workflow_settings.general,
          description: "Signs into the QA account",
          tags: ["qa"],
        },
      },
      save_workflow_settings_section: undefined,
    });

    renderApp();

    await openWorkflows();

    expect(await findWorkflowRow("Login flow")).toBeInTheDocument();

    const menu = await openMoreActions();
    await userEvent.click(within(menu).getByRole("menuitem", {
      name: "Settings Login flow",
    }));
    const dialog = await screen.findByRole("dialog", { name: "Workflow Settings" });

    expect(within(dialog).getByRole("tab", { name: "General" }))
      .toHaveAttribute("aria-selected", "true");
    expect(within(dialog).getByLabelText("Workflow name")).toHaveValue("Login flow");
    expect(within(dialog).getByLabelText("Description")).toHaveValue(
      "Signs into the QA account",
    );
    expect(within(dialog).getByLabelText("Tags")).toHaveValue("qa");

    await userEvent.clear(within(dialog).getByLabelText("Workflow name"));
    await userEvent.type(within(dialog).getByLabelText("Workflow name"), "Updated login flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(workflowBridgeMock.saveWorkflowSettingsSection).toHaveBeenCalledWith(
        "workflow-1",
        "general",
        expect.objectContaining({
          name: "Updated login flow",
          description: "Signs into the QA account",
          tags: ["qa"],
        }),
      );
    });
  });

  test("clears a previous workflow run error when creating a new workflow", async () => {
    mockWorkflowBridgeCommands({
      list_workflows: [workflow],
      get_run_state: idleRunState,
      get_workflow: (args: unknown) => {
        const id = (args as { id: string }).id;
        return id === "workflow-2"
          ? { workflow: newWorkflow, steps: [] }
          : { workflow, steps: [sleepStep] };
      },
      save_workflow_graph: undefined,
      run_workflow: {
        status: "failed",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: [],
        error: {
          step_id: "step-1",
          step_number: 1,
          step_name: "Wait for page",
          action_type: "wait",
          reason: "XPath not found",
        },
      },
      create_workflow: newWorkflow,
    });

    renderApp();

    await openWorkflows();

    await openWorkflowGraph();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await confirmLaunchRun(controlsRow);

    expect(await screen.findByText("Failed at step 1: XPath not found"))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to Workflows" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create Workflow" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Workflow" });
    await userEvent.type(within(dialog).getByLabelText("New workflow name"), "Checkout flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create Workflow" }));

    expect(await screen.findByText("Checkout flow")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText("Failed at step 1: XPath not found"))
      .not.toBeInTheDocument();
  });
});

function recordingSession(): RecordingSession {
  return {
    id: "rec_1",
    workflow_id: null,
    mode: "new_workflow",
    status: "recording",
    started_at: "2026-05-27T10:00:00.000Z",
    stopped_at: null,
    browser_identity: {
      identity_id: "bi_recording",
      display_name: "Recorded identity",
      profile_dir: "bi_recording",
      profile_name: "bi_recording",
      fingerprint_seed_hash: "seed-hash",
      persona_id: "persona",
      persona_label: "Persona",
      humanize: true,
      human_preset: "default",
      headless: false,
    },
    workflow_settings_snapshot: workflowDetailScenario([]).get_workflow_settings,
    page_url: null,
    event_count: 2,
    warnings: [],
  };
}

function recordingDraft(sessionId: string): RecordingWorkflowDraft {
  return {
    id: "draft-1",
    session_id: sessionId,
    workflow_id: null,
    mode: "new_workflow",
    status: "draft",
    generated_at: "2026-05-27T10:01:00.000Z",
    workflow_settings_snapshot: workflowDetailScenario([]).get_workflow_settings,
    steps: [
      {
        id: "recording-step-1",
        source_event_ids: ["event-1"],
        action: {
          type: "navigate",
          config: { url: "https://fixture.owned.test/form" },
        },
        label: "Navigate",
        included: true,
        locator_confidence: null,
        warnings: [],
      },
      {
        id: "recording-step-2",
        source_event_ids: ["event-2"],
        action: {
          type: "input_text",
          config: {
            target: { locators: [{ kind: "test_id", value: "email" }] },
            text: "qa@example.test",
            clear_before_input: true,
          },
        },
        label: "Fill Field",
        included: true,
        locator_confidence: "high",
        warnings: [],
      },
    ],
    graph: linearGraphFromSteps([]),
    validation_issues: [],
    warnings: [],
  };
}
