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
    expect(within(header).getByRole("tablist", { name: "Help language" }))
      .toHaveClass("help-language-switch-compact");
    expect(within(help).getByText("Tất cả field và option")).toBeInTheDocument();
  });
});
