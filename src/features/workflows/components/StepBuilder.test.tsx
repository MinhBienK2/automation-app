import { fireEvent, screen, waitFor } from "@testing-library/react";
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
import type { WorkflowStep } from "../../../types/workflow";

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

  test("groups real user action types in the action picker", async () => {
    mockTauriCommands(workflowDetailScenario([]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    const actionType = await screen.findByLabelText("Action type");
    expect(actionType.querySelector('optgroup[label="Core"]')).toBeInTheDocument();
    expect(actionType.querySelector('optgroup[label="Forms"]')).toBeInTheDocument();
    expect(actionType.querySelector('optgroup[label="Keyboard"]')).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Navigate" })).toHaveValue("navigate");
    expect(screen.getByRole("option", { name: "Input Text" })).toHaveValue("input_text");
    expect(screen.getByRole("option", { name: "Hotkey" })).toHaveValue("hotkey");
  });

  test("saves input text config from the taxonomy form", async () => {
    const inputStep: WorkflowStep = {
      id: "step-input",
      name: "Input email",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "input_text",
      config: {
        type: "input_text",
        config: {
          xpath: "//*[@name='email']",
          text: "",
          clear_before_input: true,
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([inputStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Text"));
    await userEvent.type(screen.getByLabelText("Text"), "user@example.com");
    await userEvent.selectOptions(screen.getByLabelText("Typing mode"), "type");
    await userEvent.clear(screen.getByLabelText("Delay ms"));
    await userEvent.type(screen.getByLabelText("Delay ms"), "25");
    await userEvent.selectOptions(screen.getByLabelText("Wait until"), "visible");
    await userEvent.clear(screen.getByLabelText("Timeout ms"));
    await userEvent.type(screen.getByLabelText("Timeout ms"), "3000");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-input",
        name: "Input email",
        config: {
          type: "input_text",
          config: {
            xpath: "//*[@name='email']",
            text: "user@example.com",
            clear_before_input: true,
            typing_mode: "type",
            delay_ms: 25,
            wait_until: "visible",
            timeout_ms: 3000,
          },
        },
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

  test("shows real click controls and saves advanced click config", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([clickStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.selectOptions(await screen.findByLabelText("Mode"), "real");
    await userEvent.selectOptions(screen.getByLabelText("Button"), "right");
    await userEvent.selectOptions(screen.getByLabelText("Click count"), "2");
    await userEvent.selectOptions(screen.getByLabelText("Scroll into view"), "false");
    await userEvent.selectOptions(screen.getByLabelText("Block"), "end");
    await userEvent.selectOptions(screen.getByLabelText("Inline"), "center");
    await userEvent.clear(screen.getByLabelText("Iframe XPath"));
    fireEvent.change(screen.getByLabelText("Iframe XPath"), {
      target: { value: "//*[@id='frame']" },
    });
    await userEvent.clear(screen.getByLabelText("Post-click wait ms"));
    await userEvent.type(screen.getByLabelText("Post-click wait ms"), "250");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-2",
        name: "Click login button",
        config: {
          type: "click",
          config: {
            xpath: '//*[@id="submit"]',
            mode: "real",
            button: "right",
            click_count: 2,
            scroll_into_view: false,
            block: "end",
            inline: "center",
            iframe_xpath: "//*[@id='frame']",
            post_click_wait_ms: 250,
          },
        },
      });
    });
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

  test("shows advanced scroll controls and saves until-visible config", async () => {
    const scrollStep: WorkflowStep = {
      id: "step-scroll",
      name: "Scroll to result",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "scroll",
      config: { type: "scroll", config: { direction: "down", pixels: 300 } },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([scrollStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.selectOptions(await screen.findByLabelText("Mode"), "until_visible");
    await userEvent.selectOptions(screen.getByLabelText("Direction"), "right");
    await userEvent.clear(screen.getByLabelText("XPath"));
    fireEvent.change(screen.getByLabelText("XPath"), {
      target: { value: "//*[@id='target']" },
    });
    await userEvent.clear(screen.getByLabelText("Max attempts"));
    await userEvent.type(screen.getByLabelText("Max attempts"), "5");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-scroll",
        name: "Scroll to result",
        config: {
          type: "scroll",
          config: {
            direction: "right",
            pixels: 300,
            mode: "until_visible",
            xpath: "//*[@id='target']",
            max_attempts: 5,
          },
        },
      });
    });
  });
});
