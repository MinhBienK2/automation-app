import {
  fireEvent,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
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
    vi.restoreAllMocks();
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
    expect(await screen.findByText("Builder Steps")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add Step" }));
    const palette = await screen.findByRole("dialog", {
      name: "Choose an action type",
    });
    await userEvent.type(within(palette).getByLabelText("Search actions"), "sleep");
    await userEvent.click(within(palette).getByRole("button", { name: /Sleep/ }));

    expect(screen.queryByRole("dialog", { name: "Choose an action type" }))
      .not.toBeInTheDocument();

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("add_step", {
        workflowId: "workflow-1",
        actionType: "sleep",
      });
    });
  });

  test("filters add step palette actions by category and search", async () => {
    mockTauriCommands(workflowDetailScenario([]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: "Add Step" }));

    const palette = await screen.findByRole("dialog", {
      name: "Choose an action type",
    });

    expect(within(palette).getByRole("button", { name: "All" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(palette).getByRole("button", { name: /Navigate/ }))
      .toHaveAttribute("data-value", "navigate");
    expect(within(palette).getByRole("button", { name: /Sleep/ }))
      .toHaveAttribute("data-value", "sleep");
    expect(within(palette).getByRole("button", { name: /Use Proxy/ }))
      .toHaveAttribute("data-value", "use_proxy");
    expect(within(palette).getByRole("button", { name: /Take Screenshot/ }))
      .toHaveAttribute("data-value", "take_screenshot");

    await userEvent.click(within(palette).getByRole("button", { name: "Data" }));

    expect(within(palette).getByRole("button", { name: /Extract Text/ }))
      .toHaveAttribute(
      "data-value",
      "extract_text",
    );
    expect(within(palette).getByRole("button", { name: /Take Screenshot/ }))
      .toHaveAttribute(
      "data-value",
      "take_screenshot",
    );
    expect(within(palette).queryByRole("button", { name: /Click/ }))
      .not.toBeInTheDocument();

    await userEvent.type(within(palette).getByLabelText("Search actions"), "click");

    const clickResult = within(palette)
      .getAllByRole("button", { name: /Click/ })
      .find((button) => button.getAttribute("data-value") === "click");

    expect(clickResult)
      .toHaveAttribute("data-value", "click");
    expect(within(palette).queryByRole("button", { name: /Extract Text/ }))
      .not.toBeInTheDocument();
  });

  test("shows a compact builder steps header with total beside the title", async () => {
    mockTauriCommands(workflowDetailScenario([sleepStep, clickStep]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    const panel = screen.getByRole("region", { name: "Builder Steps" });
    const heading = within(panel).getByRole("heading", { name: "Builder Steps" });

    expect(heading).toHaveClass("builder-steps-title");
    expect(within(panel).getByText("2 total")).toHaveAttribute("data-slot", "badge");
    expect(within(panel).queryByText("Builder")).not.toBeInTheDocument();
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

  test("saves phase seven network device config from the form", async () => {
    const viewportStep: WorkflowStep = {
      id: "step-viewport",
      name: "Mobile viewport",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "set_viewport",
      config: {
        type: "set_viewport",
        config: {
          width: 1280,
          height: 720,
          device_scale_factor: 1,
          mobile: false,
          touch: false,
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([viewportStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Width"));
    await userEvent.type(screen.getByLabelText("Width"), "390");
    await userEvent.clear(screen.getByLabelText("Height"));
    await userEvent.type(screen.getByLabelText("Height"), "844");
    await userEvent.selectOptions(screen.getByLabelText("Mobile"), "true");
    await userEvent.selectOptions(screen.getByLabelText("Touch"), "true");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-viewport",
        name: "Mobile viewport",
        config: {
          type: "set_viewport",
          config: {
            width: 390,
            height: 844,
            device_scale_factor: 1,
            mobile: true,
            touch: true,
          },
        },
      });
    });
  });

  test("saves phase eight human verification config from the form", async () => {
    const detectStep: WorkflowStep = {
      id: "step-detect",
      name: "Detect challenge",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "detect_challenge",
      config: {
        type: "detect_challenge",
        config: {
          output_name: "challenge_found",
          patterns: ["captcha"],
          timeout_ms: 1000,
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([detectStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    fireEvent.change(await screen.findByLabelText("Patterns"), {
      target: { value: "captcha\nverify you are human" },
    });
    await userEvent.clear(screen.getByLabelText("Timeout ms"));
    await userEvent.type(screen.getByLabelText("Timeout ms"), "1500");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-detect",
        name: "Detect challenge",
        config: {
          type: "detect_challenge",
          config: {
            output_name: "challenge_found",
            patterns: ["captcha", "verify you are human"],
            timeout_ms: 1500,
          },
        },
      });
    });
  });

  test("saves phase nine reliability config from the form", async () => {
    const fallbackStep: WorkflowStep = {
      id: "step-fallback",
      name: "Find save button",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "fallback_selector",
      config: {
        type: "fallback_selector",
        config: {
          output_name: "save_xpath",
          xpaths: ["//*[@id='old-save']"],
          timeout_ms: 1000,
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([fallbackStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    fireEvent.change(await screen.findByLabelText("XPaths"), {
      target: { value: "//*[@id='missing']\n//*[@id='save']" },
    });
    await userEvent.clear(screen.getByLabelText("Timeout ms"));
    await userEvent.type(screen.getByLabelText("Timeout ms"), "1500");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-fallback",
        name: "Find save button",
        config: {
          type: "fallback_selector",
          config: {
            output_name: "save_xpath",
            xpaths: ["//*[@id='missing']", "//*[@id='save']"],
            timeout_ms: 1500,
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
    expect(screen.getByRole("button", { name: /Click login button/ }))
      .toHaveAttribute("data-slot", "button");
    expect(await screen.findByLabelText("XPath")).toHaveValue('//*[@id="submit"]');
    expect(screen.getByLabelText("Step name")).toHaveAttribute("data-slot", "input");
    expect(screen.getByLabelText("Mode")).toHaveAttribute("data-slot", "select");
    expect(screen.getByRole("button", { name: "Save Step" })).toHaveAttribute(
      "data-slot",
      "button",
    );
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
    expect(screen.getByText("Step saved successfully.")).toHaveAttribute(
      "role",
      "status",
    );
    expect(screen.getByText("Step saved successfully.")).toHaveClass("toast-alert");
    expect(
      screen.getByText("Step saved successfully.").closest(".step-form"),
    ).not.toBeInTheDocument();
  });

  test("hides the save success message after a short delay", async () => {
    let saved = false;
    mockTauriCommands({
      list_workflows: [workflow],
      get_run_state: idleRunState,
      get_workflow: () => ({
        workflow,
        steps: [saved ? { ...sleepStep, name: "Wait saved" } : sleepStep],
      }),
      update_step: () => {
        saved = true;
        return undefined;
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Step name"));
    await userEvent.type(screen.getByLabelText("Step name"), "Wait saved");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    expect(await screen.findByText("Step saved successfully.")).toHaveAttribute(
      "role",
      "status",
    );

    await waitForElementToBeRemoved(
      () => screen.queryByText("Step saved successfully."),
      {
        timeout: 3500,
      },
    );
  });

  test("duplicates the selected step with the current action type and form values", async () => {
    const duplicatedStep: WorkflowStep = {
      ...clickStep,
      id: "step-3",
      name: "Click login button Copy",
      order_index: 2,
      config: { type: "click", config: { xpath: "copied-xpath" } },
    };
    let duplicated = false;
    mockTauriCommands({
      list_workflows: [workflow],
      get_run_state: idleRunState,
      get_workflow: () => ({
        workflow,
        steps: duplicated ? [sleepStep, clickStep, duplicatedStep] : [sleepStep, clickStep],
      }),
      add_step: () => {
        duplicated = true;
        return duplicatedStep;
      },
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(screen.getByRole("button", { name: /Click/ }));
    await userEvent.clear(await screen.findByLabelText("XPath"));
    await userEvent.type(screen.getByLabelText("XPath"), "copied-xpath");
    await userEvent.click(screen.getByRole("button", { name: "Duplicate Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("add_step", {
        workflowId: "workflow-1",
        actionType: "click",
      });
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-3",
        name: "Click login button Copy",
        config: { type: "click", config: { xpath: "copied-xpath" } },
      });
    });
    expect(await screen.findByLabelText("XPath")).toHaveValue("copied-xpath");
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

  test("opens bilingual help for the selected scroll step", async () => {
    const scrollStep: WorkflowStep = {
      id: "step-scroll",
      name: "Scroll to quiz",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "scroll",
      config: {
        type: "scroll",
        config: {
          mode: "until_visible",
          direction: "down",
          pixels: 250,
          xpath: "//h2[normalize-space(.)='HTML Quiz Test']",
          iframe_xpath: "//*[@id='main']/div[3]/iframe",
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands(workflowDetailScenario([scrollStep]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Open Scroll help" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Scroll Help" });
    expect(dialog).toHaveAttribute("data-slot", "dialog-content");
    expect(within(dialog).queryByRole("button", { name: "Close" }))
      .not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Close dialog" }))
      .toBeInTheDocument();
    expect(dialog).toHaveTextContent("Cuộn cho đến khi element đích hiện ra");
    expect(dialog).toHaveTextContent("không phải box scroll");

    await userEvent.click(screen.getByRole("tab", { name: "English" }));
    expect(screen.getByRole("tab", { name: "English" })).toHaveAttribute(
      "data-slot",
      "tabs-trigger",
    );

    expect(dialog).toHaveTextContent("Scroll until the target element becomes visible");
    expect(dialog).toHaveTextContent("not the scroll box");
  });

  test("saves a drag and drop phase one action config", async () => {
    const dragStep: WorkflowStep = {
      id: "step-drag",
      name: "Move card",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "drag_and_drop",
      config: {
        type: "drag_and_drop",
        config: {
          source_xpath: "//*[@id='source']",
          target_xpath: "//*[@id='target']",
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([dragStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Source XPath"));
    fireEvent.change(screen.getByLabelText("Source XPath"), {
      target: { value: "//*[@id='card']" },
    });
    await userEvent.clear(screen.getByLabelText("Target XPath"));
    fireEvent.change(screen.getByLabelText("Target XPath"), {
      target: { value: "//*[@id='lane']" },
    });
    await userEvent.clear(screen.getByLabelText("Timeout ms"));
    await userEvent.type(screen.getByLabelText("Timeout ms"), "3000");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-drag",
        name: "Move card",
        config: {
          type: "drag_and_drop",
          config: {
            source_xpath: "//*[@id='card']",
            target_xpath: "//*[@id='lane']",
            timeout_ms: 3000,
          },
        },
      });
    });
  });

  test("saves an upload file phase two action config", async () => {
    const uploadStep: WorkflowStep = {
      id: "step-upload",
      name: "Upload invoice",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "upload_file",
      config: {
        type: "upload_file",
        config: {
          xpath: "//*[@id='file']",
          files: ["/tmp/a.txt"],
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([uploadStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Files"));
    fireEvent.change(screen.getByLabelText("Files"), {
      target: { value: "/tmp/a.txt\n/tmp/b.txt" },
    });
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-upload",
        name: "Upload invoice",
        config: {
          type: "upload_file",
          config: {
            xpath: "//*[@id='file']",
            files: ["/tmp/a.txt", "/tmp/b.txt"],
          },
        },
      });
    });
  });

  test("saves an extract attribute phase four action config", async () => {
    const extractStep: WorkflowStep = {
      id: "step-extract",
      name: "Capture link",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "extract_attribute",
      config: {
        type: "extract_attribute",
        config: {
          xpath: "//*[@id='link']",
          attribute: "href",
          output_name: "link_href",
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([extractStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Attribute"));
    await userEvent.type(screen.getByLabelText("Attribute"), "data-id");
    await userEvent.clear(screen.getByLabelText("Output name"));
    await userEvent.type(screen.getByLabelText("Output name"), "link_id");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-extract",
        name: "Capture link",
        config: {
          type: "extract_attribute",
          config: {
            xpath: "//*[@id='link']",
            attribute: "data-id",
            output_name: "link_id",
          },
        },
      });
    });
  });

  test("saves a switch tab phase three action config", async () => {
    const switchTabStep: WorkflowStep = {
      id: "step-switch-tab",
      name: "Switch to second tab",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "switch_tab",
      config: {
        type: "switch_tab",
        config: { index: 0 },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([switchTabStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Tab index"));
    await userEvent.type(screen.getByLabelText("Tab index"), "1");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-switch-tab",
        name: "Switch to second tab",
        config: {
          type: "switch_tab",
          config: { index: 1 },
        },
      });
    });
  });

  test("saves a wait for download phase three action config", async () => {
    const downloadStep: WorkflowStep = {
      id: "step-download",
      name: "Capture download",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "wait_for_download",
      config: {
        type: "wait_for_download",
        config: {
          output_name: "download_path",
        },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([downloadStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Output name"));
    await userEvent.type(screen.getByLabelText("Output name"), "invoice_path");
    await userEvent.clear(screen.getByLabelText("Timeout ms"));
    await userEvent.type(screen.getByLabelText("Timeout ms"), "3000");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-download",
        name: "Capture download",
        config: {
          type: "wait_for_download",
          config: {
            output_name: "invoice_path",
            timeout_ms: 3000,
          },
        },
      });
    });
  });

  test("saves a set variable phase five action config", async () => {
    const variableStep: WorkflowStep = {
      id: "step-variable",
      name: "Set customer",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "set_variable",
      config: {
        type: "set_variable",
        config: { name: "customer", value: "Old" },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([variableStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Value"));
    await userEvent.type(screen.getByLabelText("Value"), "Ada");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-variable",
        name: "Set customer",
        config: {
          type: "set_variable",
          config: { name: "customer", value: "Ada" },
        },
      });
    });
  });

  test("saves a set secret phase six action config", async () => {
    const secretStep: WorkflowStep = {
      id: "step-secret",
      name: "Set password",
      workflow_id: "workflow-1",
      order_index: 0,
      action_type: "set_secret",
      config: {
        type: "set_secret",
        config: { name: "password", value: "old" },
      },
      created_at: "1",
      updated_at: "1",
    };
    mockTauriCommands({
      ...workflowDetailScenario([secretStep]),
      update_step: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    await userEvent.clear(await screen.findByLabelText("Value"));
    await userEvent.type(screen.getByLabelText("Value"), "new-secret");
    await userEvent.click(screen.getByRole("button", { name: "Save Step" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith("update_step", {
        stepId: "step-secret",
        name: "Set password",
        config: {
          type: "set_secret",
          config: { name: "password", value: "new-secret" },
        },
      });
    });
  });
});
