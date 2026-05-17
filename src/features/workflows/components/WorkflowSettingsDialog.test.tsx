import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import type { WorkflowSettings } from "../../../types/workflow";
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

  test("renders Browser Identity controls without restoring Owned Test Gates", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    settings.browser_launch.proxy_enabled = true;

    render(
      <WorkflowSettingsDialog
        activeSection="browser_launch"
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

    const dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    expect(within(dialog).getAllByRole("tab").map((tab) => tab.textContent)).toEqual([
      "General",
      "Run Policy",
      "Browser Launch",
      "Graph",
      "Environment",
    ]);
    expect(within(dialog).queryByRole("tab", { name: "Owned Test Gates" }))
      .not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Identity display name")).toHaveValue("Checkout QA identity");
    expect(within(dialog).getByLabelText("Identity id")).toHaveValue("bi_workflow-1");
    const identityRow = within(dialog)
      .getByLabelText("Identity id")
      .closest(".workflow-settings-identity-row");
    expect(identityRow).not.toBeNull();
    expect(within(dialog).getByLabelText("Identity display name").closest(".workflow-settings-identity-row"))
      .toBe(identityRow);
    expect(
      Array.from(identityRow?.querySelectorAll("label") ?? []).map((label) =>
        label.textContent,
      ),
    ).toEqual(["Identity id", "Identity display name"]);
    expect(within(dialog).getByLabelText("Identity id").closest("label"))
      .toHaveClass("workflow-settings-identity-id-field");
    expect(within(dialog).getByLabelText("Identity display name").closest("label"))
      .toHaveClass("workflow-settings-identity-name-field");
    expect(within(dialog).queryByLabelText("Profile directory")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Legacy profile key")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Fingerprint seed")).toHaveValue("14523");
    expect(within(dialog).getByLabelText("Fingerprint seed")).toHaveAttribute("type", "password");
    expect(within(dialog).getByRole("button", { name: "Show fingerprint seed" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Copy fingerprint seed" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Proxy label")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Proxy provider")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Test account binding")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Proxy bypass")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Timezone")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Locale")).toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "GeoIP from proxy" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Fingerprint platform")).toHaveValue("");
    expect(within(dialog).getByLabelText("Hardware concurrency")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Device memory GB")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Storage quota MB")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Fingerprint fonts directory")).toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "Humanize browser input" })).toBeChecked();
    expect(within(dialog).getByLabelText("Humanize preset")).toHaveValue("default");
    expect(within(dialog).queryByLabelText("Behavior fidelity")).not.toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "Fingerprint preflight" })).toBeInTheDocument();
  });

  test("groups graph link wait defaults into a reusable settings field group", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    settings.graph_defaults.default_edge_delay = {
      type: "random",
      min_ms: 3000,
      max_ms: 5000,
    };

    render(
      <WorkflowSettingsDialog
        activeSection="graph_defaults"
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

    const dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    expect(within(dialog).getByRole("tab", { name: "Graph" })).toHaveAttribute("data-active", "true");
    expect(within(dialog).getByRole("heading", { name: "Graph" })).toBeInTheDocument();

    const linkWaitGroup = within(dialog).getByRole("group", { name: "New link wait" });
    expect(linkWaitGroup).toHaveClass("settings-field-group");
    expect(within(linkWaitGroup).getByText("Choose the wait copied to new links after saving."))
      .toBeInTheDocument();
    expect(within(linkWaitGroup).getByLabelText("Mode")).toHaveValue("random");
    expect(within(linkWaitGroup).getByLabelText("Minimum wait ms")).toHaveValue(3000);
    expect(within(linkWaitGroup).getByLabelText("Maximum wait ms")).toHaveValue(5000);
    expect(within(linkWaitGroup).getByText(/Existing links keep their own wait/i))
      .toHaveClass("settings-field-group-footer");
  });

  test("can reveal and copy the fingerprint seed", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    render(
      <WorkflowSettingsDialog
        activeSection="browser_launch"
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

    await user.click(screen.getByRole("button", { name: "Show fingerprint seed" }));
    expect(screen.getByLabelText("Fingerprint seed")).toHaveAttribute("type", "text");

    await user.click(screen.getByRole("button", { name: "Copy fingerprint seed" }));
    expect(writeText).toHaveBeenCalledWith("14523");
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

  test("reuse session toggles persistent storage without changing the saved identity", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const initialSettings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });

    function Harness() {
      const [settings, setSettings] = useState<WorkflowSettings>(initialSettings);
      return (
        <WorkflowSettingsDialog
          activeSection="browser_launch"
          hasUnsavedChanges={false}
          open
          settings={settings}
          onActiveSectionChange={vi.fn()}
          onDiscardChanges={vi.fn()}
          onOpenChange={vi.fn()}
          onSaveSettings={vi.fn()}
          onSettingsChange={(nextSettings) => {
            onSettingsChange(nextSettings);
            setSettings(nextSettings);
          }}
        />
      );
    }

    render(
      <Harness />,
    );

    expect(screen.getByRole("switch", { name: "Enable Run from selected" }))
      .not.toBeDisabled();

    await user.click(screen.getByRole("switch", { name: "Reuse login session" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        browser_launch: expect.objectContaining({
          session_mode: "temporary",
          profile_name: null,
          identity_id: "bi_workflow-1",
          profile_dir: "bi_workflow-1",
        }),
      }),
    );

    await user.click(screen.getByRole("switch", { name: "Reuse login session" }));
    await user.click(screen.getByRole("switch", { name: "Enable Run from selected" }));

    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        browser_launch: expect.objectContaining({
          session_mode: "persistent_profile",
          run_from_selected_enabled: true,
        }),
      }),
    );
  });

  test("resets and duplicates browser identity with explicit operator controls", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const initialSettings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    initialSettings.browser_launch.proxy_enabled = true;
    initialSettings.browser_launch.proxy_server = "http://proxy.test:8080";
    initialSettings.browser_launch.timezone = "America/New_York";
    initialSettings.browser_launch.locale = "en-US";

    function Harness() {
      const [settings, setSettings] = useState<WorkflowSettings>(initialSettings);
      return (
        <WorkflowSettingsDialog
          activeSection="browser_launch"
          hasUnsavedChanges={false}
          open
          settings={settings}
          onActiveSectionChange={vi.fn()}
          onDiscardChanges={vi.fn()}
          onOpenChange={vi.fn()}
          onSaveSettings={vi.fn()}
          onSettingsChange={(nextSettings) => {
            onSettingsChange(nextSettings);
            setSettings(nextSettings);
          }}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Reset identity" }));
    const resetLaunch = onSettingsChange.mock.lastCall?.[0].browser_launch;
    expect(confirmSpy).toHaveBeenCalled();
    expect(resetLaunch.identity_id).toMatch(/^bi_/);
    expect(resetLaunch.identity_id).not.toBe("bi_workflow-1");
    expect(resetLaunch.profile_dir).toBe(resetLaunch.identity_id);
    expect(resetLaunch.profile_name).toBe(resetLaunch.identity_id);
    expect(resetLaunch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(resetLaunch.fingerprint_seed).not.toBe("14523");
    expect(resetLaunch.display_name).toBe("Checkout QA identity");
    expect(resetLaunch.proxy_enabled).toBe(true);
    expect(resetLaunch.proxy_server).toBe("http://proxy.test:8080");
    expect(resetLaunch.timezone).toBe("America/New_York");
    expect(resetLaunch.locale).toBe("en-US");

    await user.click(screen.getByRole("button", { name: "Duplicate identity" }));
    const duplicateLaunch = onSettingsChange.mock.lastCall?.[0].browser_launch;
    expect(duplicateLaunch.identity_id).toMatch(/^bi_/);
    expect(duplicateLaunch.identity_id).not.toBe(resetLaunch.identity_id);
    expect(duplicateLaunch.profile_dir).toBe(duplicateLaunch.identity_id);
    expect(duplicateLaunch.profile_name).toBe(duplicateLaunch.identity_id);
    expect(duplicateLaunch.display_name).toBe("Checkout QA identity copy");
    expect(duplicateLaunch.proxy_server).toBe("http://proxy.test:8080");

    confirmSpy.mockRestore();
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
