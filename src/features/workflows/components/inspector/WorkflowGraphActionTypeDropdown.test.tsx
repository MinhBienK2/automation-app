import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import {
  ActionTypeDropdown,
  actionTypeFromConfig,
  isActionConfig,
  matchesActionSearch,
} from "./WorkflowGraphActionTypeDropdown";

describe("WorkflowGraphActionTypeDropdown", () => {
  test("filters and chooses visible action types", async () => {
    const onChange = vi.fn();
    render(<ActionTypeDropdown value={null} onChange={onChange} />);

    await userEvent.click(screen.getByRole("combobox", { name: "Action type" }));
    await userEvent.type(screen.getByLabelText("Search action types"), "navigate");
    await userEvent.click(within(screen.getByRole("listbox")).getByRole("option", {
      name: "Navigate",
    }));

    expect(onChange).toHaveBeenCalledWith("navigate");
  });

  test("matches search terms against action labels and descriptions", () => {
    expect(matchesActionSearch("input_text", "fill field")).toBe(true);
    expect(matchesActionSearch("input_text", "not-a-real-term")).toBe(false);
  });

  test("identifies user-selectable action configs", () => {
    expect(actionTypeFromConfig({ type: "navigate", config: { url: "" } })).toBe("navigate");
    expect(actionTypeFromConfig({ type: "graph_noop", config: { kind: "merge" } })).toBeNull();
    expect(isActionConfig({ type: "navigate", config: {} })).toBe(true);
    expect(isActionConfig({ type: "navigate" })).toBe(false);
  });
});
