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
    expect(within(controlsRow).getByText("idle")).toHaveAttribute(
      "data-slot",
      "badge",
    );
    expect(screen.queryByLabelText("Workflow name")).not.toBeInTheDocument();
    expect(within(controlsRow).getByRole("button", { name: "Run" }))
      .toHaveAttribute("data-slot", "button");
    expect(screen.getByRole("region", { name: "Visual Graph" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Builder Steps" }))
      .not.toBeInTheDocument();
    expect(screen.queryByText("Step Detail")).not.toBeInTheDocument();
  });

  test("disables graph run actions while running and polls final failure", async () => {
    let runStateCalls = 0;
    mockTauriCommands({
      list_workflows: [workflow],
      get_workflow: { workflow, steps: [sleepStep] },
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
                step_number: 1,
                action_type: "wait",
                reason: "XPath not found",
              },
            };
      },
      save_workflow_graph: undefined,
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

    expect(
      await screen.findByText("Failed at step 1: XPath not found"),
    ).toBeInTheDocument();
  });
});
