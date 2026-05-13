import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { defaultWorkflowSettings } from "../lib/workflowSettings";
import { WorkflowSettingsDialog } from "./WorkflowSettingsDialog";

describe("WorkflowSettingsDialog", () => {
  test("renders settings help with the scrollable workflow settings help layout", async () => {
    render(
      <WorkflowSettingsDialog
        activeSection="run_policy"
        hasUnsavedChanges={false}
        open
        settings={defaultWorkflowSettings({
          workflowId: "workflow-1",
          workflowName: "Checkout QA",
        })}
        onActiveSectionChange={vi.fn()}
        onDiscardChanges={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveSettings={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Run Policy Settings Help" }));

    const help = await screen.findByRole("dialog", { name: "Run Policy Settings Help" });
    expect(help).toHaveClass("workflow-settings-help-dialog");
    expect(within(help).getByTestId("workflow-settings-help-header"))
      .toHaveClass("workflow-settings-help-header");
    expect(within(help).getByTestId("workflow-settings-help-body"))
      .toHaveClass("workflow-settings-help-body");
  });
});
