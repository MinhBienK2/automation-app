import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { mockTauriCommands, resetTauriInvoke } from "../../../tests/mocks/tauri";
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

  test("disables run actions while running and polls final failure", async () => {
    let runStateCalls = 0;
    mockTauriCommands({
      list_workflows: [workflow],
      get_workflow: { workflow, steps: [sleepStep] },
      get_run_state: () => {
        runStateCalls += 1;
        return runStateCalls < 3
          ? { ...idleRunState, status: "running" }
          : {
              ...idleRunState,
              status: "failed",
              error: {
                step_number: 1,
                action_type: "sleep",
                reason: "XPath not found",
              },
            };
      },
      run_workflow: { ...idleRunState, status: "running" },
    });

    renderApp();

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
});
