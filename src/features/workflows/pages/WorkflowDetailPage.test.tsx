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
    expect(within(controlsRow).queryByText("Graph workspace")).not.toBeInTheDocument();
    expect(within(controlsRow).queryByText("Updated 1")).not.toBeInTheDocument();
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

  test("opens workflow settings on the Browser section from the detail header", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      get_workflow_settings: {
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
          headless: false,
        },
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
      },
      save_workflow_settings_section: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    expect(screen.queryByRole("dialog", { name: "Workflow Settings" }))
      .not.toBeInTheDocument();

    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));
    const settingsDialog = await screen.findByRole("dialog", {
      name: "Workflow Settings",
    });

    expect(within(settingsDialog).getByRole("tab", { name: "Variables" }))
      .toBeInTheDocument();
    expect(within(settingsDialog).queryByRole("tab", { name: "Inputs & Variables" }))
      .not.toBeInTheDocument();
    await userEvent.click(within(settingsDialog).getByRole("tab", { name: "Variables" }));
    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Add variable row",
    }));
    expect(within(settingsDialog).getByLabelText("Variable 2 name")).toBeInTheDocument();
    await userEvent.click(within(settingsDialog).getByRole("tab", { name: "Browser" }));
    expect(within(settingsDialog).getByRole("tab", { name: "Browser" }))
      .toHaveAttribute("aria-selected", "true");
    expect(within(settingsDialog).getByLabelText("Profile name")).toHaveValue(
      "qa-profile",
    );
    expect(within(settingsDialog).getByRole("switch", { name: "Reuse login session" }))
      .toHaveAttribute("aria-checked", "true");
    expect(within(settingsDialog).getByRole("switch", { name: "Proxy enabled" }))
      .toHaveAttribute("aria-checked", "true");
    expect(within(settingsDialog).getByLabelText("Device profile")).toHaveValue("custom");
    expect(within(settingsDialog).getByLabelText("User agent")).toHaveValue("WorkflowBot/1.0");
    await userEvent.clear(within(settingsDialog).getByLabelText("Profile name"));
    await userEvent.type(within(settingsDialog).getByLabelText("Profile name"), "release");
    await userEvent.clear(within(settingsDialog).getByLabelText("Viewport width"));
    await userEvent.type(within(settingsDialog).getByLabelText("Viewport width"), "1440");
    await userEvent.click(within(settingsDialog).getByRole("switch", { name: "Touch input" }));
    await userEvent.selectOptions(
      within(settingsDialog).getByLabelText("Challenge policy"),
      "detect_only",
    );
    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Browser help",
    }));
    expect(await screen.findByText("Browser Settings Help")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "English" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await userEvent.click(screen.getByRole("button", { name: "Tiếng Việt" }));
    expect(await screen.findByText("Trợ giúp Cài đặt Trình duyệt")).toBeInTheDocument();
    expect(screen.getByText("profile_name")).toBeInTheDocument();
    expect(screen.getByText("proxy_server")).toBeInTheDocument();
    expect(screen.getByText("challenge_policy")).toBeInTheDocument();
    expect(screen.getByText(/Không dùng mục này để vượt qua CAPTCHA/i))
      .toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(within(settingsDialog).getByRole("button", {
      name: "Save Settings",
    }));

    expect(invokeMock).toHaveBeenCalledWith("save_workflow_settings_section", {
      workflowId: "workflow-1",
      section: "browser",
      sectionValue: expect.objectContaining({
        profile_name: "release",
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        viewport_width: 1440,
        viewport_height: 720,
        touch: true,
        challenge_policy: "detect_only",
      }),
    });
    expect(await screen.findByRole("status")).toHaveTextContent(
      "Workflow settings saved.",
    );
  });

  test("asks before closing workflow settings with unsaved changes", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_settings_section: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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

  test("shows trigger settings as planned instead of active scheduler controls", async () => {
    mockTauriCommands(workflowDetailScenario([sleepStep]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));
    const settingsDialog = await screen.findByRole("dialog", {
      name: "Workflow Settings",
    });

    await userEvent.click(within(settingsDialog).getByRole("tab", { name: "Triggers" }));

    expect(
      within(settingsDialog).getByText(/Triggers are saved for compatibility/i),
    ).toBeInTheDocument();
    expect(
      within(settingsDialog).queryByRole("checkbox", { name: "Enable trigger" }),
    ).not.toBeInTheDocument();
    expect(
      within(settingsDialog).queryByLabelText("Trigger mode"),
    ).not.toBeInTheDocument();
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

  test("keeps graph issues visible after an edit and marks them for recheck", async () => {
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
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
