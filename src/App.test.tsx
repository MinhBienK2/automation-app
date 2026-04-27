import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
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
  workflow_id: "workflow-1",
  order_index: 0,
  action_type: "sleep",
  config: { type: "sleep", config: { seconds: 1 } },
  created_at: "1",
  updated_at: "1",
};

const clickStep = {
  id: "step-2",
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

    expect(await screen.findByLabelText("XPath")).toHaveValue('//*[@id="submit"]');
  });

  test("keeps the current step selected after saving it", async () => {
    const savedClickStep = {
      ...clickStep,
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
    await userEvent.clear(await screen.findByLabelText("XPath"));
    await userEvent.type(screen.getByLabelText("XPath"), "saved-xpath");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    expect(await screen.findByLabelText("XPath")).toHaveValue("saved-xpath");
    expect(screen.queryByLabelText("Seconds")).not.toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Test Step" })).toBeDisabled();
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
