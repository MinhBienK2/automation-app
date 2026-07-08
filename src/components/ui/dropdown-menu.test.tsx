import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

/*
  daisyUI dropdown (details/summary based). Sibling content stays visible to
  assistive technology because the menu is rendered inline, not in a modal
  portal that flips aria-hidden on the document tree.
*/

describe("DropdownMenu", () => {
  test("does not hide sibling elements from assistive technology when open", async () => {
    const user = userEvent.setup();
    render(
      <main>
        <p>Sibling text</p>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button">Open menu</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Action</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </main>,
    );

    const sibling = screen.getByText("Sibling text");
    expect(sibling).not.toHaveAttribute("aria-hidden");

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    // Sibling stays visible to AT — no modal-ish aria-hidden lockdown on siblings.
    expect(sibling).not.toHaveAttribute("aria-hidden");
    expect(document.querySelectorAll("[aria-hidden='true']").length).toBe(0);

    // Menu item is present in the DOM (content is rendered; details just toggles open state).
    expect(screen.getByText("Action")).toBeInTheDocument();
  });
});
