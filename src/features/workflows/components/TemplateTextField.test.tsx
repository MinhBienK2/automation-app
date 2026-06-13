import { render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TemplateTextField, TemplateTextareaField } from "./TemplateTextField";

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

  test("renders textarea and handles variable insertion via popover", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const handleChange = vi.fn();

    render(
      <TemplateTextareaField
        label="My Textarea"
        value="hello {{var1}} world"
        onChange={handleChange}
      />
    );

    // Should display the label
    expect(screen.getByText("My Textarea")).toBeInTheDocument();

    // Should display the textarea value
    const textarea = screen.getByRole("textbox", { name: "My Textarea" }) as HTMLTextAreaElement;
    expect(textarea).toHaveValue("hello {{var1}} world");

    // The token {{var1}} should be highlighted inside the backdrop
    const highlighted = screen.getByText("{{var1}}");
    expect(highlighted).toBeInTheDocument();
    expect(highlighted).toHaveClass("template-token-highlight");

    // Set cursor to the end of the textarea
    textarea.focus();
    textarea.setSelectionRange(20, 20);

    // We can click the Braces button to toggle popover
    const trigger = screen.getByRole("button", { name: /Insert variable for My Textarea/i });
    await user.click(trigger);

    // Click an option in the portal popover
    const option = screen.getByRole("option", { name: /user.name/i });
    await user.click(option);

    // onChange should be called with updated value
    expect(handleChange).toHaveBeenCalledWith("hello {{var1}} world{{user.name}}");
  });

  test("positions variable picker above the element if space below is insufficient", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const handleChange = vi.fn();

    // Mock window.innerHeight to be 400
    const originalInnerHeight = window.innerHeight;
    Object.defineProperty(window, "innerHeight", { writable: true, value: 400 });

    const { container } = render(
      <TemplateTextField
        label="Test Placement"
        value=""
        onChange={handleChange}
      />
    );

    // Mock container getBoundingClientRect to place it near the bottom of the screen (rect.bottom = 350)
    const containerDiv = container.firstChild as HTMLElement;
    containerDiv.getBoundingClientRect = () => ({
      top: 312,
      bottom: 350,
      left: 100,
      right: 400,
      width: 300,
      height: 38,
      x: 100,
      y: 312,
      toJSON: () => {},
    });

    // Click the braces trigger to open popover
    const trigger = screen.getByRole("button", { name: /Insert variable for Test Placement/i });
    await user.click(trigger);

    // Get the popover element
    const popover = screen.getByRole("listbox", { name: "Test Placement variables" });
    
    // The popover top position should be less than rect.top (312) because it was pushed upwards
    const topValue = parseFloat(popover.style.top);
    expect(topValue).toBeLessThan(312);

    // Restore innerHeight
    Object.defineProperty(window, "innerHeight", { writable: true, value: originalInnerHeight });
  });
});
