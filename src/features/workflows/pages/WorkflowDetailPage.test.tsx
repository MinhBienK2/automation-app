import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  workflowCommandCallMock,
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
} from "../../../tests/mocks/electron";
import { sleepStep, workflow } from "../../../tests/mocks/workflowFixtures";
import type { WorkflowGraph, WorkflowRunSnapshot, WorkflowStep } from "../../../types/workflow";
import {
  idleRunState,
  workflowDetailScenario,
} from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
import { nodePorts } from "../lib/workflowGraph";

describe("Workflow detail integration", () => {
  const scrollIntoViewMock = vi.fn();

  beforeEach(() => {
    resetWorkflowBridge();
    scrollIntoViewMock.mockClear();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });
  });

  async function launchRun(scope: HTMLElement = document.body) {
    await userEvent.click(within(scope).getByRole("button", { name: "Launch Run" }));
  }

  async function openWorkflows() {
    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    const projectDetail = await screen.findByRole("region", { name: "Project detail" });
    const collections = await within(projectDetail).findByRole("navigation", {
      name: "Project sections",
    });
    await within(collections).findByRole("button", { name: "Workflows" });
  }

  async function openWorkflowDetails() {
    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
  }

  function runSnapshot(state: WorkflowRunSnapshot["state"]): WorkflowRunSnapshot {
    return {
      run_id: "run-1",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      source: "manual",
      started_at: "2026-05-27T09:00:00.000Z",
      state,
      ...state,
    };
  }

  test("opens workflow details on a separate screen and returns to the list", async () => {
    mockWorkflowBridgeCommands(workflowDetailScenario([sleepStep]));

    renderApp();

    await openWorkflows();
    expect(await screen.findByRole("heading", { name: "Workflows" })).toBeInTheDocument();
    expect(screen.queryByLabelText("New workflow name")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Main navigation" }))
      .toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "View Details" }));

    expect(await screen.findByRole("button", { name: "Back to Workflows" }))
      .toBeInTheDocument();
    expect(screen.getByText("Login flow")).toHaveAttribute("aria-current", "page");
    expect(screen.queryByLabelText("New workflow name")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Back to Workflows" }));

    expect(await screen.findByRole("button", { name: "Create Workflow" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Back to Workflows" }))
      .not.toBeInTheDocument();
  });

  test("shows workflow detail header without inline workflow name editing", async () => {
    mockWorkflowBridgeCommands(workflowDetailScenario([sleepStep]));

    renderApp();

    await openWorkflowDetails();

    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const titleRow = within(header).getByRole("group", {
      name: "Workflow title row",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });

    expect(within(titleRow).getByRole("button", { name: "Back to Workflows" }))
      .toHaveClass("page-back-button");
    const breadcrumb = within(titleRow).getByRole("navigation", {
      name: "Workflow breadcrumb",
    });
    expect(within(breadcrumb).getByRole("button", { name: "Workflows" }))
      .toHaveAttribute("data-slot", "button");
    expect(within(breadcrumb).getByText("Login flow")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(titleRow).queryByRole("heading", { name: "Login flow" }))
      .not.toBeInTheDocument();
    expect(within(titleRow).getByText("Workflow Detail")).toBeInTheDocument();
    expect(within(controlsRow).queryByText("Graph workspace")).not.toBeInTheDocument();
    expect(within(controlsRow).queryByText("Updated 1")).not.toBeInTheDocument();
    expect(within(controlsRow).getByText("Status")).toBeInTheDocument();
    expect(within(controlsRow).getByText("Idle")).toHaveAttribute(
      "data-slot",
      "badge",
    );
    expect(within(controlsRow).getByRole("button", { name: "Settings" }))
      .toHaveClass("workflow-command-icon");
    expect(within(controlsRow).getByRole("button", { name: "Settings" }))
      .toHaveAttribute("data-tooltip", "Settings");
    expect(within(controlsRow).getByRole("button", { name: "Validate" }))
      .toHaveClass("workflow-command-icon");
    expect(within(controlsRow).getByRole("button", { name: "Save" }))
      .toHaveClass("workflow-command-icon");
    expect(screen.queryByLabelText("Workflow name")).not.toBeInTheDocument();
    expect(within(controlsRow).getByRole("button", { name: "Launch Run" }))
      .toHaveAttribute("data-slot", "button");
    expect(within(controlsRow).queryByRole("button", { name: "Record Replacement" }))
      .not.toBeInTheDocument();
    const editor = screen.getByRole("region", { name: "Visual Graph" });
    expect(editor).toBeInTheDocument();
    expect(within(editor).queryByRole("heading", { name: "Visual Graph" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Builder Steps" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Step Detail")).not.toBeInTheDocument();
  });

  test("launches the full graph immediately without a confirmation dialog", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
      run_workflow: { ...idleRunState, status: "running" },
    });

    renderApp();

    await openWorkflowDetails();
    await userEvent.click(await screen.findByRole("button", { name: "Launch Run" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("run_workflow", {
        workflowId: "workflow-1",
      });
    });
    expect(screen.queryByRole("dialog", { name: "Launch Run" })).not.toBeInTheDocument();
  });

  test("shows run monitor event timeline in execution order and focuses the current graph node", async () => {
    const fillStep: WorkflowStep = {
      id: "step-2",
      name: "Fill credentials",
      workflow_id: workflow.id,
      order_index: 1,
      action_type: "input_text",
      config: {
        type: "input_text",
        config: {
          target: {
            locators: [{ kind: "css", value: "#email" }],
            constraints: {},
          },
          text: "qa@example.test",
          clear_before_input: true,
        },
      },
      created_at: "2",
      updated_at: "2",
    };
    const submitStep: WorkflowStep = {
      id: "step-3",
      name: "Submit login",
      workflow_id: workflow.id,
      order_index: 2,
      action_type: "click",
      config: {
        type: "click",
        config: {
          target: {
            locators: [{ kind: "css", value: "button[type=submit]" }],
            constraints: {},
          },
        },
      },
      created_at: "3",
      updated_at: "3",
    };
    const runningState = {
      ...idleRunState,
      status: "running" as const,
      mode: "run_workflow" as const,
      current_step_id: "step-2",
      current_step_number: 2,
      completed_step_ids: ["step-1", "step-1"],
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep, fillStep, submitStep]),
      list_run_states: [runSnapshot(runningState)],
      get_run_state: runningState,
    });

    renderApp();

    await openWorkflowDetails();

    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    expect(within(controlsRow).getByRole("button", { name: "Monitor" }))
      .toBeInTheDocument();

    const monitor = await screen.findByRole("complementary", {
      name: "Run Monitor",
    });
    expect(within(monitor).getAllByText("Running step 2").length).toBeGreaterThan(0);
    expect(within(monitor).queryByRole("region", { name: "Current run step" }))
      .not.toBeInTheDocument();
    expect(within(monitor).queryByRole("button", { name: "Focus current" }))
      .not.toBeInTheDocument();
    const timeline = within(monitor).getByRole("region", { name: "Run timeline" });
    expect(within(timeline).getByText("3 events")).toBeInTheDocument();
    const timelineButtons = within(timeline).getAllByRole("button");
    expect(timelineButtons.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Event 1 completed: Step 1 Wait for page",
      "Event 2 completed: Step 1 Wait for page",
      "Event 3 running: Step 2 Fill credentials",
    ]);
    expect(timelineButtons.every((button) => button.getAttribute("data-current") !== "true"))
      .toBe(true);
    expect(within(timeline).queryByRole("button", { name: /Submit login/ }))
      .not.toBeInTheDocument();
    expect(within(timeline).queryByRole("button", { name: /End Success/ }))
      .not.toBeInTheDocument();
    expect(within(monitor).queryByRole("switch", { name: "Follow current" }))
      .not.toBeInTheDocument();
    const editor = screen.getByRole("region", { name: "Visual Graph" });
    expect(within(editor).queryByRole("complementary", {
      name: "Graph inspector drawer",
    })).not.toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalled();

    await userEvent.click(within(timeline).getByRole("button", {
      name: "Event 3 running: Step 2 Fill credentials",
    }));

    const inspectorDrawer = await within(editor).findByRole("complementary", {
      name: "Graph inspector drawer",
    });
    expect(within(inspectorDrawer).getByRole("heading", { name: "Fill credentials" }))
      .toBeInTheDocument();

    await userEvent.click(within(monitor).getByRole("button", { name: "Close monitor" }));
    expect(screen.queryByRole("complementary", { name: "Run Monitor" }))
      .not.toBeInTheDocument();
    expect(editor).toBeInTheDocument();

    await userEvent.click(within(controlsRow).getByRole("button", { name: "Monitor" }));
    expect(await screen.findByRole("complementary", { name: "Run Monitor" }))
      .toBeInTheDocument();
  });

  test("shows terminal monitor status without the Run prefix", async () => {
    const successState = {
      ...idleRunState,
      status: "success" as const,
      mode: "run_workflow" as const,
      completed_step_ids: ["step-1"],
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      list_run_states: [runSnapshot(successState)],
      get_run_state: successState,
    });

    renderApp();

    await openWorkflowDetails();
    await userEvent.click(await screen.findByRole("button", { name: "Monitor" }));

    const monitor = await screen.findByRole("complementary", { name: "Run Monitor" });
    expect(within(monitor).getByRole("heading", { name: "Succeeded" }))
      .toBeInTheDocument();
    expect(within(monitor).queryByRole("heading", { name: "Run succeeded" }))
      .not.toBeInTheDocument();
  });

  test("hides the run monitor when Graph settings disable Live Run", async () => {
    const runningState = {
      ...idleRunState,
      status: "running" as const,
      mode: "run_workflow" as const,
      current_step_id: "step-1",
      current_step_number: 1,
      completed_step_ids: [],
    };
    const scenario = workflowDetailScenario([sleepStep]);
    mockWorkflowBridgeCommands({
      ...scenario,
      list_run_states: [runSnapshot(runningState)],
      get_run_state: runningState,
      get_workflow_settings: {
        ...scenario.get_workflow_settings,
        graph_defaults: {
          ...scenario.get_workflow_settings.graph_defaults,
          live_run_enabled: false,
          live_run_follow_current: false,
        },
      },
    });

    renderApp();

    await openWorkflowDetails();

    expect(screen.queryByRole("complementary", { name: "Run Monitor" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Monitor" }))
      .not.toBeInTheDocument();
  });

  test("runs from the selected node when a retained persistent session is available", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
      get_run_state: {
        ...idleRunState,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile",
          reason: null,
        },
      },
      get_workflow_settings: {
        ...workflowDetailScenario([sleepStep]).get_workflow_settings,
        run_policy: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.run_policy,
          browser_retention: "retain",
          run_from_selected_enabled: true,
          run_from_selected_mode: "from_selected",
        },
        browser_launch: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.browser_launch,
          session_mode: "persistent_profile",
          profile_dir: "qa-profile",
          profile_name: "qa-profile",
        },
      },
      run_workflow_from_node: {
        status: "running",
        mode: "run_workflow",
        target_step_id: "step-1",
        current_step_id: "step-1",
        current_step_number: 1,
        completed_step_ids: [],
        outputs: {},
        error: null,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile",
          reason: null,
        },
      },
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    const runFromSelected = await screen.findByRole("button", { name: "Run from selected" });
    await waitFor(() => expect(runFromSelected).toBeEnabled());
    await userEvent.click(runFromSelected);

    expect(workflowCommandCallMock).toHaveBeenCalledWith("run_workflow_from_node", {
      workflowId: "workflow-1",
      startNodeId: "step-1",
    });
  });

  test("enables Run from selected when the retained session matches the profile directory", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
      get_run_state: {
        ...idleRunState,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile-dir",
          reason: null,
        },
      },
      get_workflow_settings: {
        ...workflowDetailScenario([sleepStep]).get_workflow_settings,
        run_policy: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.run_policy,
          browser_retention: "retain",
          run_from_selected_enabled: true,
          run_from_selected_mode: "from_selected",
        },
        browser_launch: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.browser_launch,
          session_mode: "persistent_profile",
          profile_dir: "qa-profile-dir",
          profile_name: "legacy-display-name",
        },
      },
      run_workflow_from_node: {
        status: "running",
        mode: "run_workflow",
        target_step_id: "step-1",
        current_step_id: "step-1",
        current_step_number: 1,
        completed_step_ids: [],
        outputs: {},
        error: null,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile-dir",
          reason: null,
        },
      },
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    const runFromSelected = await screen.findByRole("button", { name: "Run from selected" });
    await waitFor(() => expect(runFromSelected).toBeEnabled());
    await userEvent.click(runFromSelected);

    expect(workflowCommandCallMock).toHaveBeenCalledWith("run_workflow_from_node", {
      workflowId: "workflow-1",
      startNodeId: "step-1",
    });
  });

  test("enables Run from selected for a main-path node after a merge", async () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: {},
          ports: [{ id: "out", label: "Out", direction: "output" }],
          group_id: null,
        },
        {
          id: "merge",
          node_type: "merge",
          label: "Merge",
          position: { x: 220, y: 0 },
          config: {},
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
          group_id: null,
        },
        {
          id: "after-merge",
          node_type: "action",
          label: "After Merge",
          position: { x: 440, y: 0 },
          config: sleepStep.config,
          ports: [
            { id: "in", label: "In", direction: "input" },
            { id: "out", label: "Out", direction: "output" },
          ],
          group_id: null,
        },
      ],
      edges: [
        {
          id: "edge-start-merge",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "merge",
          target_port: "in",
          label: "next",
          condition: null,
        },
        {
          id: "edge-merge-after",
          source_node_id: "merge",
          source_port: "out",
          target_node_id: "after-merge",
          target_port: "in",
          label: "next",
          condition: null,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      get_workflow_graph: graph,
      save_workflow_graph: undefined,
      get_run_state: {
        ...idleRunState,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile",
          reason: null,
        },
      },
      get_workflow_settings: {
        ...workflowDetailScenario([sleepStep]).get_workflow_settings,
        run_policy: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.run_policy,
          browser_retention: "retain",
          run_from_selected_enabled: true,
          run_from_selected_mode: "from_selected",
        },
        browser_launch: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.browser_launch,
          session_mode: "persistent_profile",
          profile_dir: "qa-profile",
          profile_name: "qa-profile",
        },
      },
      run_workflow_from_node: {
        status: "running",
        mode: "run_workflow",
        target_step_id: "after-merge",
        current_step_id: "after-merge",
        current_step_number: 1,
        completed_step_ids: [],
        outputs: {},
        error: null,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile",
          reason: null,
        },
      },
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node after-merge" }));
    const runFromSelected = await screen.findByRole("button", { name: "Run from selected" });
    await waitFor(() => expect(runFromSelected).toBeEnabled());
    await userEvent.click(runFromSelected);

    expect(workflowCommandCallMock).toHaveBeenCalledWith("run_workflow_from_node", {
      workflowId: "workflow-1",
      startNodeId: "after-merge",
    });
  });

  test("does not show Run from selected until the workflow setting is enabled", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      get_run_state: {
        ...idleRunState,
        retained_session: {
          available: true,
          workflow_id: "workflow-1",
          profile_name: "qa-profile",
          reason: null,
        },
      },
      get_workflow_settings: {
        ...workflowDetailScenario([sleepStep]).get_workflow_settings,
        browser_launch: {
          ...workflowDetailScenario([sleepStep]).get_workflow_settings.browser_launch,
          session_mode: "persistent_profile",
          profile_name: "qa-profile",
        },
      },
    });

    renderApp();

    await openWorkflowDetails();

    expect(screen.queryByRole("button", { name: "Run from selected" }))
      .not.toBeInTheDocument();
  });

  test("opens workflow settings on the Browser Launch section from the detail header", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      get_workflow_settings: {
        workflow_id: "workflow-1",
        version: 2,
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
          batch_concurrency_limit: 1,
          batch_headless: false,
          batch_stop_on_first_failed_row: false,
        },
        browser_launch: {
          session_mode: "persistent_profile",
          identity_id: "bi_workflow-1",
          display_name: "QA Profile identity",
          profile_dir: "bi_workflow-1",
          fingerprint_seed: "14523",
          profile_name: "bi_workflow-1",
          fingerprint_fonts_dir: null,
          timezone: null,
          locale: null,
          geoip: false,
          webrtc_policy: "default",
          webrtc_ip: null,
          proxy_enabled: true,
          proxy_server: "http://proxy.local:8080",
          proxy_username: "agent",
          proxy_password: "secret",
          headless: false,
        },
        environment: {
          initial_variables: [],
        },
        migration_notes: [],
        created_at: "1",
        updated_at: "1",
      },
      save_workflow_settings_section: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    expect(screen.queryByRole("dialog", { name: "Workflow Settings" }))
      .not.toBeInTheDocument();

    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));
    const settingsDialog = await screen.findByRole("dialog", {
      name: "Workflow Settings",
    });

    expect(
      within(settingsDialog).getByText("Configure workflow settings before running this workflow."),
    ).toBeInTheDocument();
    expect(within(settingsDialog).getByRole("tab", { name: "Environment" }))
      .toBeInTheDocument();
    expect(within(settingsDialog).queryByRole("tab", { name: "Triggers" }))
      .not.toBeInTheDocument();
    await userEvent.click(within(settingsDialog).getByRole("tab", { name: "Environment" }));
    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Add variable row",
    }));
    expect(within(settingsDialog).getByLabelText("Variable 2 name")).toBeInTheDocument();
    await userEvent.click(within(settingsDialog).getByRole("tab", { name: "Browser Launch" }));
    expect(within(settingsDialog).getByRole("tab", { name: "Browser Launch" }))
      .toHaveAttribute("aria-selected", "true");
    expect(within(settingsDialog).getByLabelText("Identity display name")).toHaveValue(
      "QA Profile identity",
    );
    expect(within(settingsDialog).getByLabelText("Identity id")).toHaveValue(
      "bi_workflow-1",
    );
    expect(within(settingsDialog).queryByLabelText("Profile directory"))
      .not.toBeInTheDocument();
    expect(within(settingsDialog).getByLabelText("Fingerprint seed")).toHaveValue("14523");
    expect(within(settingsDialog).getByRole("switch", { name: "Reuse login session" }))
      .toHaveAttribute("aria-checked", "true");
    expect(within(settingsDialog).getByRole("switch", { name: "Use proxy" }))
      .toHaveAttribute("aria-checked", "true");
    await userEvent.clear(within(settingsDialog).getByLabelText("Identity display name"));
    await userEvent.type(within(settingsDialog).getByLabelText("Identity display name"), "Release identity");
    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Browser Identity Settings Help",
    }));
    expect(await screen.findByText("Browser Identity Settings Help")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Save Settings",
    }));

    expect(workflowCommandCallMock).toHaveBeenCalledWith("save_workflow_settings_section", {
      workflowId: "workflow-1",
      section: "browser_launch",
      sectionValue: expect.objectContaining({
        session_mode: "persistent_profile",
        display_name: "Release identity",
        profile_dir: "bi_workflow-1",
        fingerprint_seed: "14523",
        fingerprint_fonts_dir: null,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Workflow settings saved.",
    );
  });

  test("asks before closing workflow settings with unsaved changes", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_settings_section: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));
    const settingsDialog = await screen.findByRole("dialog", {
      name: "Workflow Settings",
    });

    await userEvent.click(within(settingsDialog).getByRole("tab", { name: "General" }));
    await userEvent.type(within(settingsDialog).getByLabelText("Description"), " changed");
    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Close dialog",
    }));

    const confirmDialog = await screen.findByRole("dialog", {
      name: "Unsaved changes",
    });
    expect(within(confirmDialog).getByText(/You have unsaved changes/i))
      .toBeInTheDocument();

    await userEvent.click(within(confirmDialog).getByRole("button", {
      name: "Keep editing",
    }));
    expect(screen.getByRole("dialog", { name: "Workflow Settings" })).toBeInTheDocument();

    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Close dialog",
    }));
    await userEvent.click(await screen.findByRole("button", {
      name: "Discard changes",
    }));

    expect(screen.queryByRole("dialog", { name: "Workflow Settings" }))
      .not.toBeInTheDocument();
  });

  test("omits removed trigger and preflight settings", async () => {
    mockWorkflowBridgeCommands(workflowDetailScenario([sleepStep]));

    renderApp();

    await openWorkflowDetails();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));
    const settingsDialog = await screen.findByRole("dialog", {
      name: "Workflow Settings",
    });

    expect(within(settingsDialog).queryByRole("tab", { name: "Triggers" }))
      .not.toBeInTheDocument();
    expect(within(settingsDialog).queryByRole("switch", { name: "Fingerprint preflight" }))
      .not.toBeInTheDocument();
    expect(within(settingsDialog).queryByLabelText("Preflight probe URL"))
      .not.toBeInTheDocument();
    expect(
      within(settingsDialog).queryByRole("checkbox", { name: "Enable trigger" }),
    ).not.toBeInTheDocument();
    expect(
      within(settingsDialog).queryByLabelText("Trigger mode"),
    ).not.toBeInTheDocument();
  });

  test("shows blocking validation issues in the run issue panel", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      validate_workflow_graph: [
        {
          level: "error",
          node_id: "step-1",
          edge_id: null,
          message: "Choose an action type before running this node",
        },
      ],
    });

    renderApp();

    await openWorkflowDetails();
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    const panel = await screen.findByRole("region", { name: "Run issues" });
    expect(within(panel).getByText("Run blocked")).toBeInTheDocument();
    expect(within(panel).getByText("Fix 1 issue before running this workflow."))
      .toBeInTheDocument();
    expect(within(panel).getByText("Choose an action type before running this node"))
      .toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Select node" }))
      .toBeInTheDocument();
  });

  test("keeps graph issues visible after an edit and marks them for recheck", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      validate_workflow_graph: [
        {
          level: "error",
          node_id: "step-1",
          edge_id: null,
          message: "Choose an action type before running this node",
        },
      ],
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));
    const panel = await screen.findByRole("region", { name: "Run issues" });

    await userEvent.click(screen.getByRole("button", { name: "New node" }));

    expect(within(panel).getByText("Needs recheck")).toBeInTheDocument();
    expect(within(panel).getByText("Run issues may be out of date after graph edits."))
      .toBeInTheDocument();
    expect(within(panel).getByText("Choose an action type before running this node"))
      .toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Validate again" }))
      .toBeInTheDocument();
  });

  test("disables graph run actions while running and polls final failure", async () => {
    let runStateCalls = 0;
    mockWorkflowBridgeCommands({
      list_workflows: [workflow],
      get_workflow: { workflow, steps: [sleepStep] },
      get_workflow_browser_config: {
        workflow_id: "workflow-1",
        profile_name: null,
        proxy_enabled: false,
        proxy_server: null,
        proxy_username: null,
        proxy_password: null,
      },
      get_workflow_graph: {
        version: 1,
        nodes: [
          {
            id: "start",
            node_type: "start",
            label: "Start",
            position: { x: 0, y: 0 },
            config: {},
            ports: [{ id: "out", label: "Out", direction: "output" }],
            group_id: null,
          },
          {
            id: "end_success",
            node_type: "end_success",
            label: "End Success",
            position: { x: 220, y: 0 },
            config: {},
            ports: [{ id: "in", label: "In", direction: "input" }],
            group_id: null,
          },
        ],
        edges: [
          {
            id: "edge-start-end_success",
            source_node_id: "start",
            source_port: "out",
            target_node_id: "end_success",
            target_port: "in",
            label: "next",
            condition: null,
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      get_run_state: () => {
        runStateCalls += 1;
        return runStateCalls < 3
          ? { ...idleRunState, status: "running" }
          : {
              ...idleRunState,
              status: "failed",
              error: {
                step_id: "end_success",
                step_number: 1,
                step_name: "Wait",
                action_type: "wait",
                reason: "XPath not found",
              },
            };
      },
      save_workflow_graph: undefined,
      save_workflow_browser_config: undefined,
      run_workflow: { ...idleRunState, status: "running" },
    });

    renderApp();

    await openWorkflowDetails();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await launchRun(controlsRow);

    expect(within(controlsRow).getByRole("button", { name: "Launch Run" })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Test to Here" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Test All" }))
      .not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toHaveAttribute(
      "data-slot",
      "button",
    );

    const panel = await screen.findByRole("region", { name: "Run issues" });
    expect(within(controlsRow).getByText("Run failed")).toBeInTheDocument();
    expect(within(controlsRow).queryByText(/Failed at step 1/)).not.toBeInTheDocument();
    expect(within(controlsRow).queryByText("XPath not found")).not.toBeInTheDocument();
    expect(panel).toHaveClass("run-issue-panel-runtime");
    expect(within(panel).getByText("Run failed at step 1: Wait")).toBeInTheDocument();
    expect(within(panel).getByText("XPath not found")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Select failed node" }))
      .toBeInTheDocument();
  });

  test("maps nested subflow runtime failures back to the Call Subflow node", async () => {
    const graph: WorkflowGraph = {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: {},
          ports: nodePorts("start"),
          group_id: null,
        },
        {
          id: "call-login",
          node_type: "call_subflow",
          label: "Login subflow",
          position: { x: 220, y: 0 },
          config: { subflow_id: "subflow-login", input_mapping: [] },
          ports: nodePorts("call_subflow"),
          group_id: null,
        },
        {
          id: "after-login",
          node_type: "action",
          label: "After login",
          position: { x: 440, y: 0 },
          config: { type: "wait", config: { condition: "duration", duration_ms: 1 } },
          ports: nodePorts("action"),
          group_id: null,
        },
      ],
      edges: [
        {
          id: "start-call-login",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "call-login",
          target_port: "in",
          label: "next",
          condition: null,
        },
        {
          id: "call-login-after-login",
          source_node_id: "call-login",
          source_port: "out",
          target_node_id: "after-login",
          target_port: "in",
          label: "next",
          condition: null,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: graph,
      save_workflow_graph: undefined,
      run_workflow: {
        ...idleRunState,
        status: "failed",
        error: {
          step_id: "call-login::assert-email",
          step_number: 1,
          step_name: "Login subflow > Assert email",
          action_type: "assert_output",
          reason: "Output email did not equal ready",
          diagnostics: {
            compiled_step_id: "call-login::assert-email",
            parent_step_id: "call-login",
            subflow_node_id: "assert-email",
            label_path: ["Login subflow", "Assert email"],
            action_summary: "Output email equals ready",
            subflow_id: "subflow-login",
            subflow_name: "Login subflow",
            subflow_step_number: 2,
            subflow_step_count: 3,
          },
        },
      },
    });

    renderApp();

    await openWorkflowDetails();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await launchRun(controlsRow);

    const panel = await screen.findByRole("region", { name: "Run issues" });
    expect(
      within(panel).getByText("Run failed at step 1: Login subflow > Assert email"),
    ).toBeInTheDocument();
    expect(within(panel).getByText("Location: Login subflow > Assert email"))
      .toBeInTheDocument();
    expect(within(panel).getByText("Subflow step: 2 of 3 · node assert_output"))
      .toBeInTheDocument();
    expect(within(panel).getByText("Action target: Output email equals ready"))
      .toBeInTheDocument();

    const editor = screen.getByRole("region", { name: "Visual Graph" });
    const callSubflowButton = within(editor).getByRole("button", {
      name: "Graph canvas node call-login",
    });
    expect(callSubflowButton.closest(".graph-node")).toHaveClass("graph-node-failed");

    await userEvent.click(within(panel).getByRole("button", { name: "Select failed node" }));
    expect(callSubflowButton.closest(".graph-node")).toHaveClass("graph-node-selected");
  });

  test("keeps detail run controls scoped to the opened workflow", async () => {
    const supportWorkflow = {
      id: "workflow-2",
      name: "Support flow",
      step_count: 0,
      created_at: "2",
      updated_at: "2",
    };
    const scenario = workflowDetailScenario([sleepStep]);
    mockWorkflowBridgeCommands({
      ...scenario,
      list_workflows: [workflow, supportWorkflow],
      get_run_state: {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
      },
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
      get_workflow: ({ id }: { id: string }) =>
        id === supportWorkflow.id
          ? { workflow: supportWorkflow, steps: [sleepStep] }
          : { workflow, steps: [sleepStep] },
      get_workflow_settings: ({ workflowId }: { workflowId: string }) => ({
        ...scenario.get_workflow_settings,
        workflow_id: workflowId,
        general: {
          ...scenario.get_workflow_settings.general,
          name: workflowId === supportWorkflow.id ? supportWorkflow.name : workflow.name,
        },
      }),
    });

    renderApp();

    await openWorkflows();
    const supportCard = (await screen.findByText("Support flow")).closest("[data-slot='card']");
    await userEvent.click(within(supportCard as HTMLElement).getByRole("button", {
      name: "View Details",
    }));
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });

    expect(within(controlsRow).getByRole("button", { name: "Launch Run" }))
      .not.toBeDisabled();
    expect(within(controlsRow).queryByRole("button", { name: "Stop" }))
      .not.toBeInTheDocument();
  });

  test("keeps long runtime errors compact with copyable details in panel and inspector", async () => {
    const longReason = [
      "page.goto: net::ERR_NAME_NOT_RESOLVED at https://owned.example.test/path/with/a/very/long/token/abcdefghijklmnopqrstuvwxyz0123456789",
      "Call log:",
      "  - navigating to https://owned.example.test/path/with/a/very/long/token/abcdefghijklmnopqrstuvwxyz0123456789, waiting until load",
    ].join("\n");
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
      run_workflow: {
        ...idleRunState,
        status: "failed",
        error: {
          step_id: "step-1",
          step_number: 1,
          step_name: "Navigate",
          action_type: "navigate",
          reason: longReason,
        },
      },
    });

    renderApp();

    await openWorkflowDetails();
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await launchRun(controlsRow);

    const panel = await screen.findByRole("region", { name: "Run issues" });
    expect(within(panel).getByText("Run failed at step 1: Navigate")).toBeInTheDocument();
    expect(within(panel).getByText(/page.goto: net::ERR_NAME_NOT_RESOLVED/))
      .toHaveClass("run-issue-summary-text");
    expect(within(panel).queryByText(/waiting until load/)).not.toBeInTheDocument();
    await userEvent.click(within(panel).getByRole("button", { name: "Copy details" }));
    expect(writeText).toHaveBeenCalledWith(longReason);
    await userEvent.click(within(panel).getByRole("button", { name: "Details" }));
    expect(within(panel).getByText(/waiting until load/)).toHaveClass("run-issue-details");

    const editor = screen.getByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    const inspectorError = within(editor).getByRole("region", { name: "Last run error" });
    expect(within(inspectorError).getByText(/page.goto: net::ERR_NAME_NOT_RESOLVED/))
      .toHaveClass("graph-error-summary");
    expect(within(inspectorError).queryByText(/waiting until load/)).not.toBeInTheDocument();
    await userEvent.click(within(inspectorError).getByRole("button", { name: "View details" }));
    expect(within(inspectorError).getByText(/waiting until load/)).toHaveClass("graph-error-details");
  });
});
