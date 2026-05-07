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

  test("shows the visible default delay for Fill Field type keys mode", () => {
    const config: ActionConfig = {
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "user@example.com",
        clear_before_input: true,
        typing_mode: "type",
        delay_ms: null,
      },
    };

    render(<ActionConfigEditor config={config} onChange={vi.fn()} />);

    expect(screen.getByLabelText("Delay ms")).toHaveValue(80);
  });
});
