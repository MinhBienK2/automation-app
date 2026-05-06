import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import {
  invokeMock,
  mockTauriCommands,
  resetTauriInvoke,
} from "../../../tests/mocks/tauri";
import { sleepStep, workflow } from "../../../tests/mocks/workflowFixtures";
import {
  idleRunState,
  workflowDetailScenario,
} from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";

describe("Workflow detail integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
  });

  test("opens workflow details on a separate screen and returns to the list", async () => {
    mockTauriCommands(workflowDetailScenario([sleepStep]));

    renderApp();

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
    mockTauriCommands(workflowDetailScenario([sleepStep]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

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
    expect(within(controlsRow).getByText("Graph workspace")).toBeInTheDocument();
    expect(within(controlsRow).getByText("Updated 1")).toBeInTheDocument();
    expect(within(controlsRow).getByText("Status")).toBeInTheDocument();
    expect(within(controlsRow).getByText("Idle")).toHaveAttribute(
      "data-slot",
      "badge",
    );
    expect(screen.queryByLabelText("Workflow name")).not.toBeInTheDocument();
    expect(within(controlsRow).getByRole("button", { name: "Run" }))
      .toHaveAttribute("data-slot", "button");
    const editor = screen.getByRole("region", { name: "Visual Graph" });
    expect(editor).toBeInTheDocument();
    expect(within(editor).queryByRole("heading", { name: "Visual Graph" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Builder Steps" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Step Detail")).not.toBeInTheDocument();
  });

  test("opens, edits, and saves workflow browser runtime config from the header dialog", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      get_workflow_browser_config: {
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
        challenge_policy: "pause_for_human",
      },
      save_workflow_browser_config: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    expect(screen.queryByRole("dialog", { name: "Browser Runtime" }))
      .not.toBeInTheDocument();

    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    await userEvent.click(within(header).getByRole("button", { name: "Runtime" }));
    const configPanel = await screen.findByRole("dialog", {
      name: "Browser Runtime",
    });

    expect(within(configPanel).getByLabelText("Profile name")).toHaveValue(
      "qa-profile",
    );
    expect(within(configPanel).getByLabelText("Proxy enabled")).toBeChecked();
    expect(within(configPanel).getByPlaceholderText("qa-profile")).toBeInTheDocument();
    expect(within(configPanel).getByPlaceholderText("WorkflowBot/1.0")).toBeInTheDocument();
    expect(within(configPanel).getByPlaceholderText("http://proxy.local:8080")).toBeInTheDocument();
    expect(within(configPanel).getByPlaceholderText("agent")).toBeInTheDocument();
    expect(within(configPanel).getByPlaceholderText("secret")).toBeInTheDocument();
    expect(within(configPanel).getByPlaceholderText("1280")).toBeInTheDocument();
    expect(within(configPanel).getByPlaceholderText("720")).toBeInTheDocument();
    expect(
      within(configPanel).getByText(
        "You can also paste a full proxy URL with credentials, e.g. http://agent:secret@proxy.local:8080",
      ),
    ).toBeInTheDocument();
    await userEvent.clear(within(configPanel).getByLabelText("Profile name"));
    await userEvent.type(within(configPanel).getByLabelText("Profile name"), "release");
    await userEvent.clear(within(configPanel).getByLabelText("Viewport width"));
    await userEvent.type(within(configPanel).getByLabelText("Viewport width"), "1440");
    await userEvent.click(within(configPanel).getByLabelText("Touch input"));
    await userEvent.selectOptions(
      within(configPanel).getByLabelText("Challenge policy"),
      "detect_only",
    );
    await userEvent.click(within(configPanel).getByRole("button", {
      name: "Save browser config",
    }));

    expect(invokeMock).toHaveBeenCalledWith("save_workflow_browser_config", {
      workflowId: "workflow-1",
      config: expect.objectContaining({
        workflow_id: "workflow-1",
        profile_name: "release",
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        viewport_width: 1440,
        viewport_height: 720,
        touch: true,
        challenge_policy: "detect_only",
      }),
    });
  });

  test("shows blocking validation issues in the run issue panel", async () => {
    mockTauriCommands({
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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

  test("disables graph run actions while running and polls final failure", async () => {
    let runStateCalls = 0;
    mockTauriCommands({
      list_workflows: [workflow],
      get_workflow: { workflow, steps: [sleepStep] },
      get_workflow_browser_config: {
        workflow_id: "workflow-1",
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    const controlsRow = within(header).getByRole("group", {
      name: "Workflow controls row",
    });
    await userEvent.click(within(controlsRow).getByRole("button", { name: "Run" }));

    expect(within(controlsRow).getByRole("button", { name: "Run" })).toBeDisabled();
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
    expect(within(panel).getByText("Run failed at step 1: Wait")).toBeInTheDocument();
    expect(within(panel).getByText("XPath not found")).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Select failed node" }))
      .toBeInTheDocument();
  });
});
