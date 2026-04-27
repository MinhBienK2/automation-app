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

  test("lists workflows and creates a workflow", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_workflows") return [];
      if (command === "get_run_state") return { status: "idle", error: null };
      if (command === "create_workflow") return workflow;
      throw new Error(`Unexpected command: ${command}`);
    });

    render(<App />);

    expect(await screen.findByText("No workflows yet")).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("Workflow name"), "Login flow");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("create_workflow", {
        name: "Login flow",
      });
    });
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));

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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
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

    await userEvent.click(await screen.findByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Step" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this step?");
    expect(invokeMock).not.toHaveBeenCalledWith("delete_step", {
      stepId: "step-1",
    });
  });
});
