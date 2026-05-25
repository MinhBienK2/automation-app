import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { StepHelpModal } from "./StepHelpModal";

describe("StepHelpModal", () => {
  test("renders action guide title and compact language toggle in the header", async () => {
    render(
      <StepHelpModal
        actionType="scroll"
        language="vi"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );

    const help = await screen.findByRole("dialog", { name: "Scroll Help" });
    const header = within(help).getByTestId("action-help-header");

    expect(within(header).getByText("Hướng dẫn action")).toBeInTheDocument();
    expect(within(header).getByRole("group", { name: "Help language" }))
      .toHaveClass("help-language-switch-compact");
    expect(within(help).getByText("Tất cả field và option")).toBeInTheDocument();
  });

  test("groups field references by category and keeps mistakes inside field cards", async () => {
    render(
      <StepHelpModal
        actionType="assert_text"
        language="en"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );

    const help = await screen.findByRole("dialog", { name: "Assert Text Help" });
    const fieldsSection = within(help)
      .getByText("All fields and options")
      .closest("details")!;

    expect(within(fieldsSection).getByText("Required")).toBeInTheDocument();
    expect(within(fieldsSection).getByText("Optional")).toBeInTheDocument();
    expect(within(fieldsSection).getByText("Advanced")).toBeInTheDocument();
    expect(within(fieldsSection).getAllByText("required").length).toBeGreaterThan(0);
    expect(within(fieldsSection).getAllByText("Use when").length).toBeGreaterThan(0);
    expect(within(fieldsSection).getAllByText("Avoid when").length).toBeGreaterThan(0);
    expect(within(help).queryByText("Common mistakes and fixes")).not.toBeInTheDocument();
  });

  test("lets readers expand and collapse help sections and field groups", async () => {
    render(
      <StepHelpModal
        actionType="assert_text"
        language="en"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );

    const help = await screen.findByRole("dialog", { name: "Assert Text Help" });
    const setupSection = within(help)
      .getByText("Minimum setup")
      .closest("details") as HTMLDetailsElement | null;
    const fieldsSection = within(help)
      .getByText("All fields and options")
      .closest("details") as HTMLDetailsElement | null;

    expect(setupSection).not.toBeNull();
    expect(setupSection?.open).toBe(true);
    expect(fieldsSection).not.toBeNull();
    expect(fieldsSection?.open).toBe(false);

    await userEvent.click(within(fieldsSection!).getByText("All fields and options"));
    expect(fieldsSection?.open).toBe(true);

    const optionalGroup = within(fieldsSection!)
      .getByText("Optional")
      .closest("details") as HTMLDetailsElement | null;

    expect(optionalGroup).not.toBeNull();
    expect(optionalGroup?.open).toBe(false);

    await userEvent.click(within(optionalGroup!).getByText("Optional"));
    expect(optionalGroup?.open).toBe(true);
  });

  test("lets readers expand and collapse individual field and option details", async () => {
    render(
      <StepHelpModal
        actionType="assert_text"
        language="en"
        onClose={vi.fn()}
        onLanguageChange={vi.fn()}
      />,
    );

    const help = await screen.findByRole("dialog", { name: "Assert Text Help" });
    const fieldsSection = within(help)
      .getByText("All fields and options")
      .closest("details") as HTMLDetailsElement;

    await userEvent.click(within(fieldsSection).getByText("All fields and options"));

    const fieldItem = fieldsSection.querySelector(".help-field-reference") as HTMLDetailsElement | null;
    const optionItem = fieldsSection.querySelector(".help-option-item") as HTMLDetailsElement | null;

    expect(fieldItem).not.toBeNull();
    expect(fieldItem?.tagName).toBe("DETAILS");
    expect(fieldItem?.open).toBe(false);

    await userEvent.click(fieldItem!.querySelector("summary")!);
    expect(fieldItem?.open).toBe(true);

    expect(optionItem).not.toBeNull();
    expect(optionItem?.tagName).toBe("DETAILS");
    expect(optionItem?.open).toBe(false);
  });
});
