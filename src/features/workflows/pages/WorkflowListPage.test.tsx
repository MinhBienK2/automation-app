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

  test("hides step counts and raw updated timestamps from workflow cards", async () => {
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

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");

    expect(workflowCard).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("1733 steps"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Updated 1733-raw-timestamp"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("1733 steps")).not.toBeInTheDocument();
  });

  test("lists workflows and creates a workflow from a dialog", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      create_workflow: workflow,
      get_workflow: { workflow, steps: [] },
    });

    renderApp();

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument();
    expect(screen.queryByLabelText("New workflow name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create Workflow" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Workflow" });

    await userEvent.type(within(dialog).getByLabelText("New workflow name"), "Login flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

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

    await userEvent.click(await screen.findByRole("button", {
      name: "Record Workflow",
    }));
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
    await userEvent.clear(within(dialog).getByLabelText("Step label Fill Field"));
    await userEvent.type(within(dialog).getByLabelText("Step label Fill Field"), "Fill recorded email");
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

    await userEvent.click(await screen.findByRole("button", {
      name: "Record Workflow",
    }));
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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

  test("shows icon-only workflow card actions with duplicate", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");

    expect(workflowCard).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "View Details",
    })).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Run Login flow",
    })).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Edit Login flow",
    })).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Duplicate Login flow",
    })).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Delete Login flow",
    })).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Delete Login flow",
    })).toHaveAttribute("data-tooltip", "Delete Login flow");
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Run Login flow",
    })).toHaveAttribute("data-tooltip", "Run Login flow");
    expect(within(workflowCard as HTMLElement).queryByText("View Details"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Run"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Edit"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Duplicate"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Delete"))
      .not.toBeInTheDocument();
  });

  test("runs a saved workflow from the list without opening the detail page", async () => {
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      run_workflow: {
        run_id: "run-1",
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        source: "manual",
        started_at: "2026-05-17T09:00:00.000Z",
        status: "running",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: [],
        outputs: {},
        error: null,
        state: {
          ...idleRunState,
          status: "running",
          mode: "run_workflow",
        },
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", {
      name: "Run Login flow",
    }));

    await waitFor(() => {
      expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
    });
    expect(workflowBridgeMock.getWorkflow).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Back to Workflows" }))
      .not.toBeInTheDocument();
    expect(await screen.findByText("Running")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run Login flow" })).toBeDisabled();
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

    expect(await screen.findByRole("button", { name: "Run Login flow" }))
      .toBeDisabled();
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

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Duplicate Login flow",
    })).toBeDisabled();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Export Login flow",
    })).toBeDisabled();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Delete Login flow",
    })).toBeDisabled();

    await userEvent.click(within(workflowCard as HTMLElement).getByRole("button", {
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

    const loginCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");
    const supportCard = (await screen.findByText("Support flow")).closest("[data-slot='card']");

    expect(within(loginCard as HTMLElement).getByRole("button", {
      name: "Run Login flow",
    })).toBeDisabled();
    expect(within(loginCard as HTMLElement).getByText("Running step 1"))
      .toBeInTheDocument();
    await userEvent.click(within(loginCard as HTMLElement).getByRole("button", {
      name: "Stop Login flow",
    }));

    expect(within(supportCard as HTMLElement).getByRole("button", {
      name: "Run Support flow",
    })).not.toBeDisabled();
    expect(workflowBridgeMock.stopRun).toHaveBeenCalledWith("run-1");
  });

  test("Run Center renders multiple active runs and stops the selected run", async () => {
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

    await userEvent.click(await screen.findByRole("button", { name: "Run Center" }));

    const runCenter = await screen.findByRole("region", { name: "Run Center" });
    expect(within(runCenter).getByRole("heading", { name: "Run Center" }))
      .toBeInTheDocument();
    expect(within(runCenter).getByText("Login flow")).toBeInTheDocument();
    expect(within(runCenter).getByText("Support flow")).toBeInTheDocument();
    expect(within(runCenter).getByText("schedule")).toBeInTheDocument();

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

    await userEvent.click(await screen.findByRole("button", { name: "Delete Login flow" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete Workflow" });
    expect(within(dialog).getByText(/This removes Login flow/i)).toBeInTheDocument();
    const profileDataCheckbox = within(dialog).getByRole("checkbox", {
      name: "Delete private browser profile data",
    });
    expect(profileDataCheckbox).not.toBeChecked();
    expect(within(dialog).getByText(/Keep it when you want retained login state/i))
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
    let listCalls = 0;

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_workflows: () => {
        listCalls += 1;
        return listCalls === 1 ? [workflow] : [workflow, copiedWorkflow];
      },
      duplicate_workflow: {
        workflow: {
          id: copiedWorkflow.id,
          name: copiedWorkflow.name,
          created_at: copiedWorkflow.created_at,
          updated_at: copiedWorkflow.updated_at,
        },
        steps: [sleepStep],
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", {
      name: "Duplicate Login flow",
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

    await userEvent.click(await screen.findByRole("button", {
      name: "Export Login flow",
    }));
    const dialog = await screen.findByRole("dialog", { name: "Export Workflow" });
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

    expect((await screen.findByText("Login flow")).closest("[data-slot='card']"))
      .toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "Edit Login flow" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await userEvent.click(within(controlsRow).getByRole("button", { name: "Run" }));

    expect(await screen.findByText("Failed at step 1: XPath not found"))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to Workflows" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create Workflow" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Workflow" });
    await userEvent.type(within(dialog).getByLabelText("New workflow name"), "Checkout flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

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
