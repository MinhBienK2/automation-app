import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TemplateTextField } from "./TemplateTextField";

describe("TemplateTextField", () => {
  test("renders input and highlights tokens inside the backdrop", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const handleChange = vi.fn();

    render(
      <TemplateTextField
        label="My Input"
        value="hello {{var1}} world"
        onChange={handleChange}
      />
    );

    // Should display the label
    expect(screen.getByText("My Input")).toBeInTheDocument();

    // Should display the input value
    const input = screen.getByRole("textbox", { name: "My Input" });
    expect(input).toHaveValue("hello {{var1}} world");

    // The token {{var1}} should be highlighted inside the backdrop
    const highlighted = screen.getByText("{{var1}}");
    expect(highlighted).toBeInTheDocument();
    expect(highlighted).toHaveClass("text-[var(--app-accent)]");

    // We can click the Braces button to toggle popover
    const trigger = screen.getByRole("button", { name: /Insert variable for My Input/i });
    expect(trigger).toBeInTheDocument();
    
    // Trigger popover
    await user.click(trigger);

    // Popover search input should be visible
    const search = screen.getByPlaceholderText("Search variables...");
    expect(search).toBeInTheDocument();
  });
});
