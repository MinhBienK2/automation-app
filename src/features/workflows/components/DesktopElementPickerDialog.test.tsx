import { describe, expect, test, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DesktopElementPickerDialog } from "./DesktopElementPickerDialog";
import type { DesktopInspection } from "../../../types/desktopTargets";

/**
 * The picker's job is to make a choice legible before it is made. These cover
 * the three answers it can give: a good locator, a fragile one, and a window
 * with nothing in it — the last being the one an operator most needs stated
 * plainly rather than as an error.
 */

const inspection = (over: Partial<DesktopInspection> = {}): DesktopInspection => ({
  tier: "element",
  warnings: [],
  tree: {
    elements: [
      {
        index: 0,
        role: "Button",
        label: "Save",
        depth: 3,
        suggestion: {
          locator: { role: "Button", name: { kind: "exact", value: "Save" } },
          matchedBy: "name",
          explanation: 'Identified by name — it is the only Button called "Save" in this window.',
          fragile: false,
        },
      },
      {
        index: 1,
        role: "ListItem",
        label: "Row",
        depth: 4,
        suggestion: {
          locator: { role: "ListItem", name: { kind: "exact", value: "Row" }, ordinal: 1 },
          matchedBy: "ordinal",
          explanation:
            "3 elements match ListItem \"Row\" and no named container separates them, so this step points at number 2 of 3. It will act on the wrong element if they are reordered or one is removed.",
          fragile: true,
        },
      },
    ],
  },
  ...over,
});

function renderPicker(over: Partial<DesktopInspection> = {}) {
  const onPick = vi.fn();
  const inspect = vi.fn(async () => inspection(over));

  render(
    <DesktopElementPickerDialog
      open
      targetId="target-1"
      targetName="Notepad"
      onClose={vi.fn()}
      onPick={onPick}
      inspect={inspect}
    />,
  );

  return { onPick, inspect };
}

describe("DesktopElementPickerDialog", () => {
  test("hands back the locator the backend wrote, not one it composed", async () => {
    const { onPick } = renderPicker();

    await screen.findByText("Save");
    await userEvent.click(screen.getByText("Save"));
    await userEvent.click(screen.getByRole("button", { name: "Use this element" }));

    expect(onPick).toHaveBeenCalledWith({
      role: "Button",
      name: { kind: "exact", value: "Save" },
    });
  });

  test("says why the element was identified that way, before it is chosen", async () => {
    // The whole point of the picker over hand-writing: the operator can see
    // that this locator holds because the name is unique, not by accident.
    renderPicker();

    await userEvent.click(await screen.findByText("Save"));

    expect(screen.getByText(/only Button called "Save"/)).toBeInTheDocument();
  });

  test("marks an element that can only be found by position", async () => {
    renderPicker();

    await screen.findByText("Row");

    expect(screen.getByText("position only")).toBeInTheDocument();
  });

  test("a window with no tree is explained, not reported as a failure", async () => {
    // A degraded window is a real answer: it tells the operator to use screen
    // position, which is a decision, not an error.
    renderPicker({
      tier: "pixel",
      tree: { elements: [], degradedReason: "ax_tree_empty" },
    });

    expect(await screen.findByText(/exposes no accessibility tree/)).toBeInTheDocument();
    expect(screen.getByText(/ax_tree_empty/)).toBeInTheDocument();
  });

  test("nothing can be chosen until something is selected", async () => {
    renderPicker();

    await screen.findByText("Save");

    expect(screen.getByRole("button", { name: "Use this element" })).toBeDisabled();
  });

  test("a failure to open the application says what happened", async () => {
    const onPick = vi.fn();
    render(
      <DesktopElementPickerDialog
        open
        targetId="target-1"
        onClose={vi.fn()}
        onPick={onPick}
        inspect={async () => {
          throw new Error("Notepad could not be bound to a window: no windows appeared");
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByText(/could not be bound to a window/)).toBeInTheDocument(),
    );
  });
});
