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
      "Graph",
      "Run Policy",
      "Browser Launch",
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
    expect(within(dialog).getByLabelText("Fingerprint seed")).toHaveAttribute("type", "text");
    expect(within(dialog).queryByLabelText("Browser brand")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Show fingerprint seed" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Copy fingerprint seed" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Duplicate identity" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Proxy label")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Proxy region")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Proxy provider")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Test account binding")).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Proxy bypass")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Timezone")).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Locale")).toBeInTheDocument();
    expect(within(dialog).getByText(
      `Detected on this machine: ${expectedLocalTimezone()} / ${expectedLocalLocale()}`,
    )).toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "GeoIP location" })).toBeInTheDocument();
    expect(within(dialog).getByRole("group", { name: "Fingerprint" })).toBeInTheDocument();
    expect(within(dialog).getByLabelText("Fingerprint fonts directory")).toHaveValue("");
    expect(within(dialog).queryByLabelText("Fingerprint platform")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Hardware concurrency")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Device memory GB")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Storage quota MB")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Viewport width")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Viewport height")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Device scale factor")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Mobile viewport" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Touch input" }))
      .not.toBeInTheDocument();
    expect(within(dialog).getByRole("switch", { name: "Humanize browser input" })).toBeChecked();
    expect(within(dialog).getByLabelText("Humanize preset")).toHaveValue("default");
    expect(within(dialog).queryByLabelText("Behavior fidelity")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Fingerprint preflight" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Preflight probe URL")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Allowed probe origins")).not.toBeInTheDocument();
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

  test("groups workflow settings sections by related controls", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    settings.browser_launch.proxy_enabled = true;

    const props = {
      hasUnsavedChanges: false,
      open: true,
      settings,
      onActiveSectionChange: vi.fn(),
      onDiscardChanges: vi.fn(),
      onOpenChange: vi.fn(),
      onSaveSettings: vi.fn(),
      onSettingsChange: vi.fn(),
    };

    const { rerender } = render(
      <WorkflowSettingsDialog
        {...props}
        activeSection="general"
      />,
    );
    let dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    const workflowDetails = within(dialog).getByRole("group", { name: "Workflow details" });
    expect(within(workflowDetails).getByLabelText("Workflow name")).toBeInTheDocument();
    expect(within(workflowDetails).getByLabelText("Notes")).toBeInTheDocument();

    rerender(
      <WorkflowSettingsDialog
        {...props}
        activeSection="run_policy"
      />,
    );
    dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    const runLifecycle = within(dialog).getByRole("group", { name: "Run lifecycle" });
    const batchDefaults = within(dialog).getByRole("group", { name: "Batch defaults" });
    expect(within(runLifecycle).getByLabelText("Max workflow duration ms")).toBeInTheDocument();
    expect(within(runLifecycle).getByRole("switch", { name: "Allow Run JavaScript" })).toBeChecked();
    expect(within(batchDefaults).getByLabelText("Batch concurrency limit")).toBeDisabled();
    expect(within(batchDefaults).getByText("Batch controls are paused until Batch Run UI is ready."))
      .toHaveClass("settings-field-group-footer");

    rerender(
      <WorkflowSettingsDialog
        {...props}
        activeSection="browser_launch"
      />,
    );
    dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    const expectedBrowserGroups = [
      "Session & identity",
      "Proxy",
      "Location",
      "Fingerprint",
      "Humanization",
      "Launch",
    ];
    for (const groupName of expectedBrowserGroups) {
      expect(within(dialog).getByRole("group", { name: groupName })).toHaveClass("settings-field-group");
    }
    expect(within(within(dialog).getByRole("group", { name: "Session & identity" })).getByLabelText("Identity id"))
      .toBeInTheDocument();
    expect(within(within(dialog).getByRole("group", { name: "Proxy" })).getByLabelText("Proxy server"))
      .toBeInTheDocument();
    expect(within(within(dialog).getByRole("group", { name: "Launch" })).getByRole("switch", { name: "Headless browser" }))
      .toBeInTheDocument();

    rerender(
      <WorkflowSettingsDialog
        {...props}
        activeSection="environment"
      />,
    );
    dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    expect(within(dialog).getByRole("group", { name: "Initial variables" })).toHaveClass("settings-field-group");
  });

  test("can edit the fingerprint fonts directory without seed reveal or copy actions", async () => {
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

    render(<Harness />);

    expect(screen.queryByRole("button", { name: "Show fingerprint seed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy fingerprint seed" })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText("Fingerprint fonts directory"), "/opt/fp-fonts");

    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        browser_launch: expect.objectContaining({
          fingerprint_fonts_dir: "/opt/fp-fonts",
        }),
      }),
    );
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

    await user.click(screen.getByRole("switch", { name: "Allow Run JavaScript" }));

    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        run_policy: expect.objectContaining({ execute_js_enabled: false }),
      }),
    );
  });

  test("renders Run from selected controls in Run Policy with a scope select", async () => {
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
          activeSection="run_policy"
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

    expect(screen.getByRole("switch", { name: "Enable Run from selected" }))
      .not.toBeDisabled();
    expect(screen.queryByLabelText("Run from selected scope")).not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Enable Run from selected" }));

    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        run_policy: expect.objectContaining({
          run_from_selected_enabled: true,
          run_from_selected_mode: "from_selected",
        }),
      }),
    );
    expect(screen.getByLabelText("Run from selected scope")).toBeInTheDocument();
    const runFromSelectedGroup = screen
      .getByRole("switch", { name: "Enable Run from selected" })
      .closest(".workflow-run-from-selected-group");
    expect(runFromSelectedGroup).not.toBeNull();
    expect(screen.getByLabelText("Run from selected scope").closest(".workflow-run-from-selected-group"))
      .toBe(runFromSelectedGroup);
    expect(screen.getByRole("option", { name: "Only rerun selected node" }))
      .toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Run from selected node onward" }))
      .toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Chỉ chạy lại mỗi node được select" }))
      .not.toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Chạy từ node đó đổ đi" }))
      .not.toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Run from selected scope"), "selected_only");

    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        run_policy: expect.objectContaining({
          run_from_selected_enabled: true,
          run_from_selected_mode: "selected_only",
        }),
      }),
    );
  });

  test("reuse session toggles persistent storage without changing the saved identity", async () => {
    const user = userEvent.setup();
    const onSettingsChange = vi.fn();
    const defaultSettings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    const initialSettings = {
      ...defaultSettings,
      run_policy: {
        ...defaultSettings.run_policy,
        run_from_selected_enabled: true,
        run_from_selected_mode: "from_selected" as const,
      },
    };

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

    expect(screen.queryByRole("switch", { name: "Enable Run from selected" }))
      .not.toBeInTheDocument();

    await user.click(screen.getByRole("switch", { name: "Reuse login session" }));
    expect(onSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        browser_launch: expect.objectContaining({
          session_mode: "temporary",
          profile_name: null,
          identity_id: "bi_workflow-1",
          profile_dir: "bi_workflow-1",
        }),
        run_policy: expect.objectContaining({
          run_from_selected_enabled: false,
        }),
      }),
    );
  });

  test("resets browser identity through an in-app confirmation and backend callback", async () => {
    const user = userEvent.setup();
    const onResetBrowserIdentity = vi.fn();
    const confirmSpy = vi.spyOn(window, "confirm");
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
            setSettings(nextSettings);
          }}
          onResetBrowserIdentity={onResetBrowserIdentity}
        />
      );
    }

    render(<Harness />);

    await user.click(screen.getByRole("button", { name: "Reset identity" }));
    const dialog = screen.getByRole("dialog", { name: "Reset browser identity" });

    expect(within(dialog).getByText(/creates a new backend-generated identity id/i))
      .toBeInTheDocument();
    expect(confirmSpy).not.toHaveBeenCalled();
    expect(onResetBrowserIdentity).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole("button", { name: "Reset identity" }));

    expect(onResetBrowserIdentity).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Duplicate identity" }))
      .not.toBeInTheDocument();

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
    expect(within(help).getAllByText(/Batch controls are paused until Batch Run UI is ready/i).length)
      .toBeGreaterThan(0);
    expect(within(help).getByTestId("workflow-settings-help-header"))
      .toHaveClass("workflow-settings-help-header");
    expect(within(help).getByTestId("workflow-settings-help-body"))
      .toHaveClass("workflow-settings-help-body");

    const bestForSection = within(help)
      .getByText("Use it when")
      .closest("details") as HTMLDetailsElement | null;
    const mistakesSection = within(help)
      .getByText("Common mistakes")
      .closest("details") as HTMLDetailsElement | null;

    expect(bestForSection).not.toBeNull();
    expect(bestForSection?.open).toBe(true);
    expect(mistakesSection).not.toBeNull();
    expect(mistakesSection?.open).toBe(false);

    await userEvent.click(within(mistakesSection!).getByText("Common mistakes"));

    expect(mistakesSection?.open).toBe(true);
    expect(within(mistakesSection!).getByText(/Expecting Run Policy to add pacing/i))
      .toBeInTheDocument();

    const fieldGuideSection = within(help)
      .getByText("Field guide")
      .closest("details") as HTMLDetailsElement | null;
    const fieldItem = fieldGuideSection?.querySelector(
      ".workflow-settings-help-item",
    ) as HTMLDetailsElement | null;
    const mistakeItem = mistakesSection!.querySelector(
      ".workflow-settings-help-item",
    ) as HTMLDetailsElement | null;

    expect(fieldItem).not.toBeNull();
    expect(fieldItem?.tagName).toBe("DETAILS");
    expect(fieldItem?.open).toBe(false);
    expect(mistakeItem).not.toBeNull();
    expect(mistakeItem?.tagName).toBe("DETAILS");
    expect(mistakeItem?.open).toBe(false);
  });
});

function expectedLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function expectedLocalLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}
