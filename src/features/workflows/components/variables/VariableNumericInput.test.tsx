import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { VariableNumericInput } from "./VariableNumericInput";
import { VariableOptionsContext } from "./TemplateTextField";

describe("VariableNumericInput", () => {
  test("renders standard numeric input and handles value changes", async () => {
    const handleChange = vi.fn();
    render(
      <VariableNumericInput
        label="Target Index"
        value={5}
        onChange={handleChange}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "Target Index" });
    expect(input).toHaveValue(5);

    fireEvent.change(input, { target: { value: "10" } });
    expect(handleChange).toHaveBeenLastCalledWith(10);
  });

  test("toggles to variable mode and lists variables from context and props", async () => {
    const handleChange = vi.fn();
    const contextVariables = [
      { name: "envVar1", source: "Workflow Settings Env" },
      { name: "envVar2", source: "Workflow Settings Env" },
    ];
    const propVariables = [
      { name: "propVar1", source: "Custom Source" },
    ];

    render(
      <VariableOptionsContext.Provider value={contextVariables}>
        <VariableNumericInput
          label="Target Index"
          value={null}
          onChange={handleChange}
          variableOptions={propVariables}
        />
      </VariableOptionsContext.Provider>
    );

    // Toggle mode
    const toggleBtn = screen.getByRole("button", { name: /Switch to variable/i });
    await userEvent.click(toggleBtn);

    // Select variable dropdown should be visible
    const dropdown = screen.getByRole("combobox", { name: "Target Index" });
    expect(dropdown).toBeInTheDocument();

    // Verify list of options in select
    const options = screen.getAllByRole("option");
    const optionValues = options.map((opt) => opt.textContent?.trim());

    // Expect system defaults, prop variables, AND context variables
    expect(optionValues).toContain("envVar1 (Workflow Settings Env)");
    expect(optionValues).toContain("envVar2 (Workflow Settings Env)");
    expect(optionValues).toContain("propVar1 (Custom Source)");
    expect(optionValues).toContain("system.loop.index (Loop current item)");
  });
});
