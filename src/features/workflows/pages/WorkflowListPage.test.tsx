import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { invokeMock, mockTauriCommands, resetTauriInvoke } from "../../../tests/mocks/tauri";
import {
  newWorkflow,
  sleepStep,
  workflow,
} from "../../../tests/mocks/workflowFixtures";
import {
  idleRunState,
  listWorkflowScenario,
} from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
import { linearGraphFromSteps } from "../lib/workflowGraph";

describe("Workflow list integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
  });

  test("hides legacy step counts and raw updated timestamps from workflow cards", async () => {
    mockTauriCommands({
      ...listWorkflowScenario([
        {
          ...workflow,
          step_count: 1733,
          updated_at: "1733-legacy-timestamp",
        },
      ]),
    });

    renderApp();

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");

    expect(workflowCard).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("1733 steps"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Updated 1733-legacy-timestamp"))
      .not.toBeInTheDocument();
    expect(screen.queryByText("1733 steps")).not.toBeInTheDocument();
  });

  test("lists workflows and creates a workflow from a dialog", async () => {
    mockTauriCommands({
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
      expect(invokeMock).toHaveBeenCalledWith("create_workflow", {
        name: "Login flow",
      });
    });
    expect(await screen.findByRole("button", { name: "Back to Workflows" }))
      .toBeInTheDocument();
  });

  test("shows icon-only workflow card actions with duplicate", async () => {
    mockTauriCommands(listWorkflowScenario([workflow]));

    renderApp();

    const workflowCard = (await screen.findByText("Login flow")).closest("[data-slot='card']");

    expect(workflowCard).toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).getByRole("button", {
      name: "View Details",
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
    expect(within(workflowCard as HTMLElement).queryByText("View Details"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Edit"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Duplicate"))
      .not.toBeInTheDocument();
    expect(within(workflowCard as HTMLElement).queryByText("Delete"))
      .not.toBeInTheDocument();
  });

  test("duplicates a workflow from the list", async () => {
    const graph = linearGraphFromSteps([sleepStep]);
    const copiedWorkflow = {
      id: "workflow-copy",
      name: "Copy of Login flow",
      step_count: 0,
      created_at: "2",
      updated_at: "2",
    };
    const importedWorkflow = {
      id: copiedWorkflow.id,
      name: "Login flow (imported)",
      created_at: copiedWorkflow.created_at,
      updated_at: copiedWorkflow.updated_at,
    };
    let listCalls = 0;

    mockTauriCommands({
      ...listWorkflowScenario([workflow]),
      list_workflows: () => {
        listCalls += 1;
        return listCalls === 1 ? [workflow] : [workflow, copiedWorkflow];
      },
      export_workflow: {
        version: 1,
        workflow,
        steps: [sleepStep],
        settings: null,
      },
      get_workflow_graph: graph,
      import_workflow: {
        workflow: importedWorkflow,
        steps: [sleepStep],
      },
      save_workflow_graph: undefined,
      rename_workflow: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", {
      name: "Duplicate Login flow",
    }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("export_workflow", {
        workflowId: "workflow-1",
      });
      expect(invokeMock).toHaveBeenCalledWith("get_workflow_graph", {
        workflowId: "workflow-1",
      });
      expect(invokeMock).toHaveBeenCalledWith("save_workflow_graph", {
        workflowId: "workflow-copy",
        graph,
      });
      expect(invokeMock).toHaveBeenCalledWith("rename_workflow", {
        id: "workflow-copy",
        name: "Copy of Login flow",
      });
    });
    expect(await screen.findByText("Copy of Login flow")).toBeInTheDocument();
  });

  test("opens workflow settings General from the list edit action", async () => {
    mockTauriCommands({
      ...listWorkflowScenario([workflow]),
      get_workflow_settings: {
        workflow_id: "workflow-1",
        version: 1,
        general: {
          name: "Login flow",
          description: "Signs into the QA account",
          tags: ["qa"],
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
    await userEvent.click(within(dialog).getByRole("button", { name: "Save General" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("save_workflow_settings_section", {
        workflowId: "workflow-1",
        section: "general",
        sectionValue: expect.objectContaining({
          name: "Updated login flow",
          description: "Signs into the QA account",
          tags: ["qa"],
        }),
      });
    });
  });

  test("clears a previous workflow run error when creating a new workflow", async () => {
    mockTauriCommands({
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
