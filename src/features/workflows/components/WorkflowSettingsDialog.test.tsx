import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { defaultWorkflowSettings } from "../lib/workflowSettings";
import { WorkflowSettingsDialog } from "./WorkflowSettingsDialog";

describe("WorkflowSettingsDialog", () => {
  test("renders batch run policy controls as paused and disabled", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    settings.run_policy.batch_concurrency_limit = 1;
    settings.run_policy.batch_headless = true;
    settings.run_policy.batch_stop_on_first_failed_row = true;

    render(
      <WorkflowSettingsDialog
        activeSection="run_policy"
        hasUnsavedChanges={false}
        open
        settings={settings}
        onActiveSectionChange={vi.fn()}
        onDiscardChanges={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveSettings={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Batch concurrency limit")).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Batch runs are headless" })).toBeDisabled();
    expect(screen.getByRole("switch", { name: "Stop batch on first failed row" })).toBeDisabled();
    expect(
      screen.getByText("Batch controls are paused until Batch Run UI is ready."),
    ).toBeInTheDocument();
  });

  test("does not render Owned Test Gates or fingerprint preflight controls", () => {
    render(
      <WorkflowSettingsDialog
        activeSection="general"
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

    const dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    expect(within(dialog).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "General",
      "Run Policy",
      "Browser Launch",
      "Environment",
    ]);
    expect(within(dialog).queryByRole("tab", { name: "Owned Test Gates" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Fingerprint preflight" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByText(/fingerprint preflight/i)).not.toBeInTheDocument();
  });

  test("does not save disabled batch switch changes but still edits active run policy fields", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });

    render(
      <WorkflowSettingsDialog
        activeSection="run_policy"
        hasUnsavedChanges={false}
        open
        settings={settings}
        onActiveSectionChange={vi.fn()}
        onDiscardChanges={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveSettings={vi.fn()}
        onSettingsChange={onSettingsChange}
      />,
    );

    await user.click(screen.getByRole("switch", { name: "Batch runs are headless" }));
    await user.click(screen.getByRole("switch", { name: "Stop batch on first failed row" }));

    expect(onSettingsChange).not.toHaveBeenCalled();

    await user.selectOptions(screen.getByLabelText("Browser retention"), "close");

    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        run_policy: expect.objectContaining({ browser_retention: "close" }),
      }),
    );
  });

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
    expect(within(help).getByText(/Batch controls are paused until Batch Run UI is ready/i))
      .toBeInTheDocument();
    expect(within(help).getByTestId("workflow-settings-help-header"))
      .toHaveClass("workflow-settings-help-header");
    expect(within(help).getByTestId("workflow-settings-help-body"))
      .toHaveClass("workflow-settings-help-body");
  });
});
