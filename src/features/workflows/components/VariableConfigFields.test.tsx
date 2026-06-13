import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SetVariablesConfigFields } from "./VariableConfigFields";

describe("SetVariablesConfigFields", () => {
  test("hides calculation math button when type is json or boolean, but shows it for text and number", () => {
    const config = {
      variables: [
        { name: "var_text", value_type: "text", value: "hello" },
        { name: "var_number", value_type: "number", value: "123" },
        { name: "var_json", value_type: "json", value: "{}" },
        { name: "var_bool", value_type: "boolean", value: "true" },
      ] as any[],
    };

    render(<SetVariablesConfigFields config={config} onChange={vi.fn()} />);

    // Check Text row (index 0)
    expect(screen.getByRole("button", { name: /Insert math for variable 1/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Insert variable for variable 1/i })).toBeInTheDocument();

    // Check Number row (index 1)
    expect(screen.getByRole("button", { name: /Insert math for variable 2/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Insert variable for variable 2/i })).toBeInTheDocument();

    // Check JSON row (index 2) - should not have math button
    expect(screen.queryByRole("button", { name: /Insert math for variable 3/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Insert variable for variable 3/i })).toBeInTheDocument();

    // Check Boolean row (index 3) - should not have math button
    expect(screen.queryByRole("button", { name: /Insert math for variable 4/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Insert variable for variable 4/i })).toBeInTheDocument();
  });
});
