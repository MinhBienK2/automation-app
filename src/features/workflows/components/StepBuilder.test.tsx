import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { invokeMock, mockTauriCommands, resetTauriInvoke } from "../../../tests/mocks/tauri";
import {
  clickStep,
  sleepStep,
  workflow,
} from "../../../tests/mocks/workflowFixtures";
import {
  idleRunState,
  workflowDetailScenario,
} from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";

describe("Workflow step builder integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
  });

  test("opens builder and adds a sleep step", async () => {
    const commandDetailSteps: typeof sleepStep[] = [];
    mockTauriCommands({
      ...workflowDetailScenario(commandDetailSteps),
      get_workflow: { workflow, steps: commandDetailSteps },
      add_step: sleepStep,
    });

    renderApp();

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

  test("shows validation errors from save step", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      update_step: () => {
        throw { field: "seconds", message: "Seconds must be greater than 0" };
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Seconds"));
    await userEvent.type(screen.getByLabelText("Seconds"), "0");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    expect(
      await screen.findByText("Seconds must be greater than 0"),
    ).toBeInTheDocument();
  });

  test("selects an existing step and shows its detail form", async () => {
    mockTauriCommands(workflowDetailScenario([sleepStep, clickStep]));

    renderApp();

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
    mockTauriCommands({
      list_workflows: [workflow],
      get_run_state: idleRunState,
      get_workflow: () => ({
        workflow,
        steps: [sleepStep, saved ? savedClickStep : clickStep],
      }),
      update_step: () => {
        saved = true;
        return undefined;
      },
    });

    renderApp();

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

  test("asks for confirmation before deleting a step", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      delete_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: "Delete Step" }));

    expect(confirmSpy).toHaveBeenCalledWith("Delete this step?");
    expect(invokeMock).not.toHaveBeenCalledWith("delete_step", {
      stepId: "step-1",
    });
  });
});
