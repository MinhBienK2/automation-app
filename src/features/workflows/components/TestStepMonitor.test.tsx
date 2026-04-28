import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { invokeMock, mockTauriCommands, resetTauriInvoke } from "../../../tests/mocks/tauri";
import {
  clickStep,
  sleepStep,
  workflow,
} from "../../../tests/mocks/workflowFixtures";
import { idleRunState } from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";

describe("Test step monitor integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
  });

  test("opens a test step monitor with progress and xpath suggestions", async () => {
    let runStateCalls = 0;
    mockTauriCommands({
      list_workflows: [workflow],
      get_workflow: { workflow, steps: [sleepStep, clickStep] },
      get_run_state: () => {
        runStateCalls += 1;
        if (runStateCalls < 2) return idleRunState;
        if (runStateCalls < 4) {
          return {
            ...idleRunState,
            status: "running",
            mode: "test_step",
            target_step_id: "step-2",
            current_step_id: "step-2",
            current_step_number: 2,
            completed_step_ids: ["step-1"],
          };
        }
        return {
          ...idleRunState,
          status: "failed",
          mode: "test_step",
          target_step_id: "step-2",
          completed_step_ids: ["step-1"],
          error: {
            step_id: "step-2",
            step_number: 2,
            step_name: "Click login button",
            action_type: "click",
            reason: "XPath not found",
          },
        };
      },
      test_step: {
        ...idleRunState,
        status: "running",
        mode: "test_step",
        target_step_id: "step-2",
        current_step_id: "step-1",
        current_step_number: 1,
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: /Click login button/ }));
    await userEvent.click(screen.getByRole("button", { name: "Test to Here" }));

    const monitor = await screen.findByRole("dialog", { name: "Test Step Monitor" });
    expect(monitor).toBeInTheDocument();
    expect(monitor).toHaveAttribute("data-slot", "dialog-content");
    expect(within(monitor).queryByRole("button", { name: "Close" }))
      .not.toBeInTheDocument();
    expect(within(monitor).getByRole("button", { name: "Close dialog" }))
      .toBeInTheDocument();
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
    mockTauriCommands({
      list_workflows: [workflow],
      get_workflow: { workflow, steps: [sleepStep, clickStep] },
      get_run_state: idleRunState,
      test_step: {
        ...idleRunState,
        status: "running",
        mode: "test_step",
        target_step_id: "step-2",
        current_step_id: "step-1",
        current_step_number: 1,
      },
    });

    renderApp();

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
    expect(within(monitor).getByText("Step Progress").closest("[data-slot='card']"))
      .toBeInTheDocument();
    expect(within(monitor).getByText("Testing steps 1-2 of 2")).toBeInTheDocument();
    expect(
      within(monitor).getByText(
        "This test runs every step in the workflow.",
      ),
    ).toBeInTheDocument();
  });
});
