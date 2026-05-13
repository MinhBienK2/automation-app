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
});
