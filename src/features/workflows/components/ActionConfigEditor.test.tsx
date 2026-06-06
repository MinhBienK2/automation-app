import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type { ActionConfig } from "../../../types/workflow";
import { ActionConfigEditor } from "./ActionConfigEditor";

describe("ActionConfigEditor", () => {
  test("edits action config without step-specific controls", async () => {
    const onChange = vi.fn();
    const config: ActionConfig = {
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "",
        clear_before_input: true,
      },
    };

    function Harness() {
      const [currentConfig, setCurrentConfig] = useState(config);
      return (
        <ActionConfigEditor
          config={currentConfig}
          onChange={(nextConfig) => {
            setCurrentConfig(nextConfig);
            onChange(nextConfig);
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.queryByRole("button", { name: "Save Step" })).not.toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Text"), "user@example.com");

    expect(onChange).toHaveBeenLastCalledWith({
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "user@example.com",
        clear_before_input: true,
      },
    });
  });

  test("inserts variable tokens into template fields at the cursor", async () => {
    const onChange = vi.fn();
    const config: ActionConfig = {
      type: "input_text",
      config: {
        xpath: "//*[@name='role']",
        text: "",
        clear_before_input: true,
      },
    };

    function Harness() {
      const [currentConfig, setCurrentConfig] = useState(config);
      return (
        <ActionConfigEditor
          config={currentConfig}
          onChange={(nextConfig) => {
            setCurrentConfig(nextConfig);
            onChange(nextConfig);
          }}
        />
      );
    }

    render(<Harness />);

    await userEvent.click(screen.getByRole("button", { name: "Insert variable for Text" }));
    await userEvent.click(screen.getByRole("option", { name: "roles Set JSON Variables" }));

    expect(screen.getByLabelText("Text")).toHaveValue("{{roles}}");
    expect(within(screen.getByLabelText("Text token preview")).getByText("{{roles}}"))
      .toHaveClass("template-token-highlight");
    expect(onChange).toHaveBeenLastCalledWith({
      type: "input_text",
      config: {
        xpath: "//*[@name='role']",
        text: "{{roles}}",
        clear_before_input: true,
      },
    });
  });

  test("shows graph variable options in template fields", async () => {
    const config: ActionConfig = {
      type: "input_text",
      config: {
        xpath: "//*[@name='account']",
        text: "",
        clear_before_input: true,
      },
    };

    render(
      <ActionConfigEditor
        config={config}
        onChange={vi.fn()}
        variableOptions={[{ name: "session.account_id", source: "Set Variables" }]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Insert variable for Text" }));

    expect(
      screen.getByRole("option", { name: "session.account_id Set Variables" }),
    ).toBeInTheDocument();
  });

  test("shows the visible default delay for Fill Field type keys mode", () => {
    const config: ActionConfig = {
      type: "input_text",
      config: {
        target: null,
        text: "user@example.com",
        clear_before_input: true,
      },
    };

    render(<ActionConfigEditor config={config} onChange={vi.fn()} />);

    expect(screen.queryByLabelText("Delay ms")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Typing mode")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Timeout ms")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Wait until")).not.toBeInTheDocument();
  });

  test("Clear Field editor omits low-level clearing method controls", () => {
    render(<ActionConfigEditor config={{ type: "clear_input", config: { target: null } }} onChange={vi.fn()} />);

    expect(screen.queryByLabelText("Method")).not.toBeInTheDocument();
  });

  test("targetable action editors switch between locator and Find Element ref target sources", async () => {
    const onChange = vi.fn();
    const config: ActionConfig = {
      type: "input_text",
      config: {
        target_ref: "current_like",
        target: {
          locators: [{ kind: "css", value: "button.like-button" }],
          constraints: { visible: true, enabled: true },
          iframe: null,
        },
        text: "hello",
        clear_before_input: true,
        wait_until: "visible",
        timeout_ms: 6000,
      },
    } as ActionConfig;

    function Harness() {
      const [currentConfig, setCurrentConfig] = useState(config);
      return (
        <ActionConfigEditor
          config={currentConfig}
          onChange={(nextConfig) => {
            setCurrentConfig(nextConfig);
            onChange(nextConfig);
          }}
        />
      );
    }

    render(<Harness />);

    const targetSource = screen.getByRole("group", { name: "Target source" });
    expect(within(targetSource).getByRole("button", { name: "Use Find Element ref" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(screen.getByLabelText("Target ref")).toHaveValue("current_like");
    expect(screen.getByText("This action uses the element resolved by a previous Find Element node in this run."))
      .toBeInTheDocument();
    expect(screen.queryByLabelText("Target locator")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Target visibility")).not.toBeInTheDocument();

    await userEvent.click(within(targetSource).getByRole("button", { name: "Use locator" }));

    expect(screen.queryByLabelText("Target ref")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Target locator")).toHaveValue("button.like-button");
    expect(screen.getByLabelText("Target visibility")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      ...config,
      config: {
        ...config.config,
        target_ref: null,
      },
    });

    await userEvent.click(within(targetSource).getByRole("button", { name: "Use Find Element ref" }));

    expect(screen.getByLabelText("Target ref")).toBeInTheDocument();
    expect(screen.queryByLabelText("Target locator")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      ...config,
      config: {
        ...config.config,
        target_ref: "",
      },
    });
  });

  test("Scroll editor shows fields for the selected scroll mode", async () => {
    const onChange = vi.fn();
    const config: ActionConfig = {
      type: "scroll",
      config: { mode: "page", direction: "down", pixels: 500 },
    };

    function Harness() {
      const [currentConfig, setCurrentConfig] = useState(config);
      return (
        <ActionConfigEditor
          config={currentConfig}
          onChange={(nextConfig) => {
            setCurrentConfig(nextConfig);
            onChange(nextConfig);
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByLabelText("Mode")).toHaveValue("page");
    expect(screen.getByRole("option", { name: "Page Scroll" })).toHaveValue("page");
    expect(screen.getByRole("option", { name: "Scroll To Element" })).toHaveValue("into_view");
    expect(screen.getByRole("option", { name: "Scroll Until Element Visible" })).toHaveValue(
      "until_element_visible",
    );
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Page Scroll",
      "Scroll To Element",
      "Scroll Until Element Visible",
      "Human-like",
      "Smooth single wheel",
      "Down",
      "Up",
      "Right",
      "Left",
    ]);
    expect(screen.getByLabelText("Scroll style")).toHaveValue("human_like");
    expect(screen.getByLabelText("Direction")).toBeInTheDocument();
    expect(screen.getByLabelText("Pixels")).toBeInTheDocument();
    expect(screen.queryByLabelText("Target locator")).not.toBeInTheDocument();

    await userEvent.selectOptions(screen.getByLabelText("Scroll style"), "smooth_single");
    expect(onChange).toHaveBeenLastCalledWith({
      type: "scroll",
      config: {
        mode: "page",
        direction: "down",
        pixels: 500,
        scroll_style: "smooth_single",
      },
    });

    await userEvent.selectOptions(screen.getByLabelText("Mode"), "into_view");

    expect(screen.getByLabelText("Target locator")).toBeInTheDocument();
    expect(screen.getByLabelText("Timeout ms")).toBeInTheDocument();
    expect(screen.queryByLabelText("Target visibility")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Target enabled")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Target contains text")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Target index")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Direction")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Pixels")).not.toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      type: "scroll",
      config: {
        mode: "into_view",
        direction: "down",
        pixels: 500,
        target: null,
        timeout_ms: 60000,
      },
    });

    await userEvent.selectOptions(screen.getByLabelText("Mode"), "until_element_visible");

    expect(screen.getByLabelText("Target locator")).toBeInTheDocument();
    expect(screen.getByLabelText("Timeout ms")).toBeInTheDocument();
    expect(screen.getByLabelText("Direction")).toBeInTheDocument();
    expect(screen.getByLabelText("Pixels")).toBeInTheDocument();
    expect(onChange).toHaveBeenLastCalledWith({
      type: "scroll",
      config: {
        mode: "until_element_visible",
        direction: "down",
        pixels: 500,
        target: null,
        timeout_ms: 60000,
      },
    });
  });

  test("Scroll To Element ref mode omits locator-only iframe controls", () => {
    const config: ActionConfig = {
      type: "scroll",
      config: {
        mode: "into_view",
        target_ref: "current_submit",
        target: {
          locators: [{ kind: "css", value: ".submit-button" }],
          constraints: null,
          iframe: null,
        },
        iframe_xpath: "//iframe[@title='legacy']",
        timeout_ms: 60000,
      },
    };

    render(<ActionConfigEditor config={config} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Target ref")).toHaveValue("current_submit");
    expect(screen.queryByLabelText("Target locator")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Iframe XPath")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Timeout ms")).toBeInTheDocument();
  });

  test("Drag and Drop editor exposes destination position controls", async () => {
    const onChange = vi.fn();
    const config: ActionConfig = {
      type: "drag_and_drop",
      config: {
        source_target: { locators: [{ kind: "test_id", value: "volume-thumb" }] },
        target_target: { locators: [{ kind: "test_id", value: "volume-track" }] },
        target_position: { mode: "percent", x_percent: 82, y_percent: 50 },
      },
    } as ActionConfig;

    function Harness() {
      const [currentConfig, setCurrentConfig] = useState(config);
      return (
        <ActionConfigEditor
          config={currentConfig}
          onChange={(nextConfig) => {
            setCurrentConfig(nextConfig);
            onChange(nextConfig);
          }}
        />
      );
    }

    render(<Harness />);

    expect(screen.getByLabelText("Destination position")).toHaveValue("percent");
    expect(screen.getByLabelText("X percent")).toHaveValue(82);
    expect(screen.getByLabelText("Y percent")).toHaveValue(50);

    await userEvent.clear(screen.getByLabelText("X percent"));
    await userEvent.type(screen.getByLabelText("X percent"), "75");

    expect(onChange).toHaveBeenLastCalledWith({
      type: "drag_and_drop",
      config: expect.objectContaining({
        target_position: { mode: "percent", x_percent: 75, y_percent: 50 },
      }),
    });
  });

  test("Set Viewport editor omits launch-time device shape controls", () => {
    render(
      <ActionConfigEditor
        config={{
          type: "set_viewport",
          config: { width: 1280, height: 720 },
        }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Width")).toBeInTheDocument();
    expect(screen.getByLabelText("Height")).toBeInTheDocument();
    expect(screen.queryByLabelText("Device scale factor")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Mobile")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Touch")).not.toBeInTheDocument();
  });
});
