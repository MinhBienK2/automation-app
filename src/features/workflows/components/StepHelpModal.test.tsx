import { render, screen, within } from "@testing-library/react";
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
      .getByRole("heading", { name: "All fields and options" })
      .closest("section")!;

    expect(within(fieldsSection).getByText("Required")).toBeInTheDocument();
    expect(within(fieldsSection).getByText("Optional")).toBeInTheDocument();
    expect(within(fieldsSection).getByText("Advanced")).toBeInTheDocument();
    expect(within(fieldsSection).getAllByText("required").length).toBeGreaterThan(0);
    expect(within(fieldsSection).getAllByText("Use when").length).toBeGreaterThan(0);
    expect(within(fieldsSection).getAllByText("Avoid when").length).toBeGreaterThan(0);
    expect(within(help).queryByText("Common mistakes and fixes")).not.toBeInTheDocument();
  });
});
