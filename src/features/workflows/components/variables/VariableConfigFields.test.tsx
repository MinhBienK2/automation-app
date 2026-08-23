import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SetVariablesConfigFields } from "./VariableConfigFields";

describe("SetVariablesConfigFields", () => {
  test("renders variable insert button for every value type and never a math button", () => {
    const config = {
      variables: [
        { name: "var_text", value_type: "text", value: "hello" },
        { name: "var_number", value_type: "number", value: "123" },
        { name: "var_json", value_type: "json", value: "{}" },
        { name: "var_bool", value_type: "boolean", value: "true" },
      ] as any[],
    };

    render(<SetVariablesConfigFields config={config} onChange={vi.fn()} />);

    for (let index = 1; index <= 4; index += 1) {
      expect(screen.getByRole("button", { name: new RegExp(`Insert variable for variable ${index}`, "i") })).toBeInTheDocument();
      expect(screen.queryByRole("button", { name: new RegExp(`Insert math for variable ${index}`, "i") })).not.toBeInTheDocument();
    }
  });
});
