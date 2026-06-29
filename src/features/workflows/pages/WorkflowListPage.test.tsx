import { screen, waitFor, within } from "@testing-library/react";
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
vi.mock("../../../components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: any) => <>{children}</>,
  DropdownMenuTrigger: ({ children }: any) => <>{children}</>,
  DropdownMenuContent: ({ children }: any) => <div data-testid="dropdown-content">{children}</div>,
  DropdownMenuItem: ({ children, onSelect, disabled }: any) => (
    <button onClick={onSelect} disabled={disabled} role="menuitem">
      {children}
    </button>
  ),
  DropdownMenuSeparator: () => <hr />,
}));

describe("Workflow list integration", () => {
  beforeEach(() => {
    resetWorkflowBridge();
  });

  async function launchRun(scope: HTMLElement = document.body) {
    await userEvent.click(within(scope).getByRole("button", { name: "Run" }));
  }

  async function openWorkflows() {
    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    const grid = await screen.findByRole("list", { name: /projects/i });
    const projectCard = within(grid).getAllByRole("button")[0];
    await userEvent.click(projectCard);
    const projectDetail = await screen.findByRole("region", { name: "Project detail" });
    const collections = await within(projectDetail).findByRole("navigation", {
      name: "Project sections",
    });
    await within(collections).findByRole("button", { name: "Workflows" });
  }

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

    await openWorkflows();

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");

    expect(workflowCard).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("1733 steps"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Updated 1733-raw-timestamp"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("1733 steps")).not.toBeInTheDocument();
  });

  test("lists workflows and creates a workflow with browser profile selection", async () => {
    const project = {
      id: "project-1",
      name: "Main",
      description: "",
      created_at: "1",
      updated_at: "1",
    };
    const environments = [
      {
        id: "environment-default",
        project_id: project.id,
        name: "Project browser profile",
        description: "",
        is_default: true,
        browser_launch: null,
        created_at: "1",
        updated_at: "1",
      },
      {
        id: "environment-staging",
        project_id: project.id,
        name: "Staging Chrome",
        description: "Shared staging posture",
        is_default: false,
        browser_launch: null,
        created_at: "1",
        updated_at: "1",
      },
    ];
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([]),
      list_projects: [project],
      list_browser_profiles: environments,
      create_workflow: workflow,
      get_workflow: { workflow, steps: [] },
    });

    renderApp();

    await openWorkflows();

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument();
    expect(screen.queryByText("Workflow Automation Manager")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("New workflow name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create Workflow" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Workflow" });

    await userEvent.type(within(dialog).getByLabelText("New workflow name"), "Login flow");
    expect(within(dialog).getByLabelText("Browser Profile")).toHaveValue("environment-default");
    
    // Choose the staging profile
    await userEvent.selectOptions(within(dialog).getByLabelText("Browser Profile"), "environment-staging");
    
    expect(within(dialog).queryByLabelText("Browser session")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Use project browser profile")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Create new workflow session")).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(workflowBridgeMock.createWorkflow).toHaveBeenCalledWith(
        "Login flow",
        {
          project_id: project.id,
          browser_profile_id: "environment-staging",
        },
      );
    });
    expect(await screen.findByRole("button", { name: "Back to Workflows" }))
      .toBeInTheDocument();
  });

  test("does not surface project environment session labels on workflow rows or detail header", async () => {
    const environmentAwareWorkflow = {
      ...workflow,
      project_id: "project-1",
      environment_id: "environment-staging",
      environment_name: "Staging Chrome",
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      list_workflows: [environmentAwareWorkflow],
      get_workflow: {
        workflow: environmentAwareWorkflow,
        steps: [],
      },
    });

    renderApp();

    await openWorkflows();
    expect(screen.queryByText("Environment: Staging Chrome")).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    expect(within(header).queryByText("Environment: Staging Chrome")).not.toBeInTheDocument();
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

    await openWorkflows();

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

  test("shows icon-only workflow card actions with duplicate", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await openWorkflows();

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");

    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "View Details",
    })).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "Run Login flow",
    })).toBeInTheDocument();
    
    const moreActionsBtn = within(workflowCard as HTMLElement).getByRole("button", {
      name: "More actions for Login flow",
    });
    expect(moreActionsBtn).toBeInTheDocument();
    expect(moreActionsBtn).toHaveAttribute("data-tooltip", "More actions for Login flow");

    await userEvent.click(moreActionsBtn);

    expect(screen.getByRole("menuitem", { name: "Edit" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Export" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
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

    await openWorkflows();

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

    await openWorkflows();

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");
    const moreActionsBtn = within(workflowCard as HTMLElement).getByRole("button", {
      name: "More actions for Login flow",
    });
    await userEvent.click(moreActionsBtn);

    expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Export" })).toBeDisabled();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled();

    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

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

  test("workflow list handles multiple active runs without a Runs sidebar workspace", async () => {
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

    expect(screen.queryByRole("button", { name: "Runs" })).not.toBeInTheDocument();

    const loginCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");
    const supportCard = (await screen.findByText("Support flow")).closest("[data-slot='card']");
    expect(within(loginCard as HTMLElement).getByText("Running step 1")).toBeInTheDocument();
    expect(within(supportCard as HTMLElement).getByText("Running")).toBeInTheDocument();

    await userEvent.click(within(supportCard as HTMLElement).getByRole("button", {
      name: "Stop Support flow",
    }));

    expect(workflowBridgeMock.stopRun).toHaveBeenCalledWith("run-2");
  });

  test("confirms deletion in an app dialog instead of using the browser confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await openWorkflows();

    await userEvent.click(await screen.findByRole("button", { name: "More actions for Login flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    const dialog = await screen.findByRole("dialog", { name: "Delete Workflow" });
    expect(within(dialog).getByText(/This removes Login flow/i)).toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete Workflow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.deleteWorkflow).toHaveBeenCalledWith("workflow-1", undefined);
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

    await openWorkflows();

    await userEvent.click(await screen.findByRole("button", { name: "More actions for Login flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Duplicate" }));

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

    await userEvent.click(await screen.findByRole("button", {
      name: "More actions for Login flow",
    }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Export" }));
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
      project_id: "project-1",
      environment_id: "environment-imported",
      environment_name: "Imported package imported session",
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
          target_project_id: "project-1",
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

    expect((await screen.findByText("Login flow")).closest("[data-slot='card']"))
      .toBeInTheDocument();

    await userEvent.click(await screen.findByRole("button", { name: "More actions for Login flow" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Edit" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await launchRun(controlsRow);

    expect(await screen.findByText("Run failed at step 1: Wait for page"))
      .toBeInTheDocument();
    expect(screen.getByText("XPath not found")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to Workflows" }));
    await userEvent.click(await screen.findByRole("button", { name: "Create Workflow" }));
    const dialog = await screen.findByRole("dialog", { name: "Create Workflow" });
    await userEvent.type(within(dialog).getByLabelText("New workflow name"), "Checkout flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Create" }));

    expect(await screen.findByText("Checkout flow")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.queryByText("Run failed at step 1: Wait for page"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("XPath not found"))
      .not.toBeInTheDocument();
  });

  test("does not render the global run status indicator in the header", async () => {
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
            status: "failed",
            mode: "run_workflow",
            error: {
              step_id: "step-1",
              step_number: 1,
              step_name: "Wait",
              action_type: "wait",
              reason: "XPath not found",
            },
          },
        },
      ],
    });

    renderApp();

    await openWorkflows();

    expect(screen.queryByText(/Run failed/i)).not.toBeInTheDocument();
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
