import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "./dropdown-menu";

describe("DropdownMenu", () => {
  test("does not hide sibling elements from assistive technology when open", async () => {
    const user = userEvent.setup();
    render(
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button">Open menu</button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuItem>Action</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>,
    );

    await user.click(screen.getByRole("button", { name: "Open menu" }));

    // Radix defaults to modal={true} which sets aria-hidden on siblings of the
    // portal. With modal={false} (our default) siblings keep their normal
    // accessibility — the trigger button inside #root stays visible to AT.
    expect(document.querySelectorAll("[aria-hidden='true']").length).toBe(0);
  });
});
