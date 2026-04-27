import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import App from "./App";
import { invoke } from "@tauri-apps/api/core";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

const invokeMock = vi.mocked(invoke);

const workflow = {
  id: "workflow-1",
  name: "Login flow",
  step_count: 0,
  created_at: "1",
  updated_at: "1",
};

const newWorkflow = {
  id: "workflow-2",
  name: "Checkout flow",
  step_count: 0,
  created_at: "2",
  updated_at: "2",
};

const sleepStep = {
  id: "step-1",
  name: "Wait for page",
  workflow_id: "workflow-1",
  order_index: 0,
  action_type: "sleep",
  config: { type: "sleep", config: { seconds: 1 } },
  created_at: "1",
  updated_at: "1",
};

const clickStep = {
  id: "step-2",
  name: "Click login button",
  workflow_id: "workflow-1",
  order_index: 1,
  action_type: "click",
  config: { type: "click", config: { xpath: "//*[@id=\"submit\"]" } },
  created_at: "1",
  updated_at: "1",
};

describe("App workflow UI", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  test("opens workflow details on a separate screen and returns to the list", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") return { workflow, steps: [sleepStep] };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

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

  test("lists workflows and creates a workflow from a dialog", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "create_workflow") return workflow;
      if (command === "get_workflow") return { workflow, steps: [] };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

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

  test("renames a workflow from the list edit dialog", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "rename_workflow") return undefined;
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "Edit Login flow" }));
    const dialog = await screen.findByRole("dialog", { name: "Edit Workflow" });

    await userEvent.clear(within(dialog).getByLabelText("Workflow name"));
    await userEvent.type(within(dialog).getByLabelText("Workflow name"), "Updated login flow");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Changes" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("rename_workflow", {
        id: "workflow-1",
        name: "Updated login flow",
      });
    });
  });

  test("toggles the application sidebar", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    const toggle = await screen.findByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).not.toHaveTextContent("Collapse sidebar");
    expect(within(toggle).getByTestId("sidebar-toggle-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await userEvent.click(toggle);

    const collapsedToggle = screen.getByRole("button", { name: "Expand sidebar" });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(collapsedToggle).not.toHaveTextContent("Expand sidebar");
  });

  test("renders the sidebar and scrollable content as separate layout regions", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByRole("complementary", { name: "Application sidebar" }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Application content" }))
      .toHaveClass("app-content");
  });

  test("clears a previous workflow run error when creating a new workflow", async () => {
    invokeMock.mockImplementation(async (command, args) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") {
        const id = (args as { id: string }).id;
        return id === "workflow-2"
          ? { workflow: newWorkflow, steps: [] }
          : { workflow, steps: [sleepStep] };
      }
      if (command === "run_workflow") {
        return {
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
            action_type: "sleep",
            reason: "XPath not found",
          },
        };
      }
      if (command === "create_workflow") return newWorkflow;
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: "Run Workflow" }));

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

  test("opens builder and adds a sleep step", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") {
        return { workflow, steps: commandDetailSteps };
      }
      if (command === "add_step") return sleepStep;
      throw new Error(`Unexpected command: ${command}`);
    });
    const commandDetailSteps: typeof sleepStep[] = [];

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    expect(await screen.findByText("Steps")).toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Action type"), "sleep");
    await userEvent.click(screen.getByRole("button", { name: "Add Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("add_step", {
        workflowId: "workflow-1",
        actionType: "sleep",
      });
    });
  });

  test("shows workflow detail header without inline workflow name editing", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") return { workflow, steps: [sleepStep] };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

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
      .toBeInTheDocument();
    const breadcrumb = within(titleRow).getByRole("navigation", {
      name: "Workflow breadcrumb",
    });
    expect(within(breadcrumb).getByRole("button", { name: "Workflows" }))
      .toBeInTheDocument();
    expect(within(breadcrumb).getByText("Login flow")).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(titleRow).queryByRole("heading", { name: "Login flow" }))
      .not.toBeInTheDocument();
    expect(within(titleRow).getByText("Workflow Detail")).toBeInTheDocument();
    expect(within(controlsRow).getByText("1 step")).toBeInTheDocument();
    expect(within(controlsRow).getByText("Updated 1")).toBeInTheDocument();
    expect(within(controlsRow).getByText("Status")).toBeInTheDocument();
    expect(within(controlsRow).getByText("idle")).toBeInTheDocument();
    expect(screen.queryByLabelText("Workflow name")).not.toBeInTheDocument();
    expect(within(controlsRow).getByRole("button", { name: "Run Workflow" }))
      .toBeInTheDocument();
  });

  test("shows validation errors from save step", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") return { workflow, steps: [sleepStep] };
      if (command === "update_step") {
        throw { field: "seconds", message: "Seconds must be greater than 0" };
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Seconds"));
    await userEvent.type(screen.getByLabelText("Seconds"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    expect(
      await screen.findByText("Seconds must be greater than 0"),
    ).toBeInTheDocument();
  });

  test("selects an existing step and shows its detail form", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") return { workflow, steps: [sleepStep, clickStep] };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    expect(await screen.findByLabelText("Seconds")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Click/ }));

    expect(await screen.findByLabelText("Step name")).toHaveValue(
      "Click login button",
    );
    expect(await screen.findByLabelText("XPath")).toHaveValue('//*[@id="submit"]');
  });

  test("saves the step name with the selected step config", async () => {
    const savedClickStep = {
      ...clickStep,
      name: "Submit login form",
      config: { type: "click", config: { xpath: "saved-xpath" } },
    };
    let saved = false;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") {
        return { workflow, steps: [sleepStep, saved ? savedClickStep : clickStep] };
      }
      if (command === "update_step") {
        saved = true;
        return undefined;
      }
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: /Click/ }));
    await userEvent.clear(await screen.findByLabelText("Step name"));
    await userEvent.type(screen.getByLabelText("Step name"), "Submit login form");
    await userEvent.clear(await screen.findByLabelText("XPath"));
    await userEvent.type(screen.getByLabelText("XPath"), "saved-xpath");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-2",
        name: "Submit login form",
        config: { type: "click", config: { xpath: "saved-xpath" } },
      });
    });
    expect(await screen.findByLabelText("XPath")).toHaveValue("saved-xpath");
    expect(screen.getByLabelText("Step name")).toHaveValue("Submit login form");
    expect(screen.queryByLabelText("Seconds")).not.toBeInTheDocument();
  });

  test("opens a test step monitor with progress and xpath suggestions", async () => {
    let runStateCalls = 0;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_workflow") return { workflow, steps: [sleepStep, clickStep] };
      if (command === "get_run_state") {
        runStateCalls += 1;
        if (runStateCalls < 2) return { status: "idle", error: null };
        if (runStateCalls < 4) {
          return {
            status: "running",
            mode: "test_step",
            target_step_id: "step-2",
            current_step_id: "step-2",
            current_step_number: 2,
            completed_step_ids: ["step-1"],
            error: null,
          };
        }
        return {
          status: "failed",
          mode: "test_step",
          target_step_id: "step-2",
          current_step_id: null,
          current_step_number: null,
          completed_step_ids: ["step-1"],
          error: {
            step_id: "step-2",
            step_number: 2,
            step_name: "Click login button",
            action_type: "click",
            reason: "XPath not found",
          },
        };
      }
      if (command === "test_step") return {
        status: "running",
        mode: "test_step",
        target_step_id: "step-2",
        current_step_id: "step-1",
        current_step_number: 1,
        completed_step_ids: [],
        error: null,
      };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: /Click login button/ }));
    await userEvent.click(screen.getByRole("button", { name: "Test to Here" }));

    const monitor = await screen.findByRole("dialog", { name: "Test Step Monitor" });
    expect(monitor).toBeInTheDocument();
    expect(within(monitor).getAllByText("Wait for page").length).toBeGreaterThan(0);
    expect(within(monitor).getAllByText("Click login button").length).toBeGreaterThan(0);
    expect(await screen.findByText("Failed at step 2: Click login button"))
      .toBeInTheDocument();
    expect(screen.getByText("Check the XPath in the Chromium window that remains open."))
      .toBeInTheDocument();
    expect(screen.getByText("Add a Sleep step before this step if the element loads slowly."))
      .toBeInTheDocument();
  });

  test("explains selected-step testing and can test all steps", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_workflow") return { workflow, steps: [sleepStep, clickStep] };
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "test_step") return {
        status: "running",
        mode: "test_step",
        target_step_id: "step-2",
        current_step_id: "step-1",
        current_step_number: 1,
        completed_step_ids: [],
        error: null,
      };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    const testToHere = screen.getByRole("button", { name: "Test to Here" });
    expect(testToHere).toHaveAttribute(
      "title",
      "Runs from step 1 through the selected step.",
    );
    expect(screen.getByRole("button", { name: "Test All" })).toHaveAttribute(
      "title",
      "Runs every step in this workflow.",
    );

    await userEvent.click(screen.getByRole("button", { name: /Click login button/ }));
    await userEvent.click(screen.getByRole("button", { name: "Test All" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("test_step", {
        workflowId: "workflow-1",
        stepId: "step-2",
      });
    });

    const monitor = await screen.findByRole("dialog", { name: "Test Step Monitor" });
    expect(within(monitor).getByText("Testing steps 1-2 of 2")).toBeInTheDocument();
    expect(
      within(monitor).getByText(
        "This test runs every step in the workflow.",
      ),
    ).toBeInTheDocument();
  });

  test("disables run actions while running and polls final failure", async () => {
    let runStateCalls = 0;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_workflow") return { workflow, steps: [sleepStep] };
      if (command === "get_run_state") {
        runStateCalls += 1;
        return runStateCalls < 3
          ? { status: "running", error: null }
          : {
              status: "failed",
              error: {
                step_number: 1,
                action_type: "sleep",
                reason: "XPath not found",
              },
            };
      }
      if (command === "run_workflow") return { status: "running", error: null };
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: "Run Workflow" }));

    expect(screen.getByRole("button", { name: "Run Workflow" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Test to Here" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Test All" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();

    expect(
      await screen.findByText("Failed at step 1: XPath not found"),
    ).toBeInTheDocument();
  });

  test("asks for confirmation before deleting a step", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [workflow];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "get_workflow") return { workflow, steps: [sleepStep] };
      if (command === "delete_step") return undefined;
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Step" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this step?");
    expect(invokeMock).not.toHaveBeenCalledWith("delete_step", {
      stepId: "step-1",
    });
  });
});
