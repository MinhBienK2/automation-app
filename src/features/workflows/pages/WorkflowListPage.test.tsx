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

describe("Workflow list integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
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

  test("renames a workflow from the list edit dialog", async () => {
    mockTauriCommands({
      ...listWorkflowScenario([workflow]),
      rename_workflow: undefined,
    });

    renderApp();

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
          action_type: "sleep",
          reason: "XPath not found",
        },
      },
      create_workflow: newWorkflow,
    });

    renderApp();

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
});
