import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import type { BrowserProfile, WorkflowPersona, WorkflowSettings } from "../../../types/workflow";
import { defaultWorkflowSettings } from "../lib/workflowSettings";
import { WorkflowSettingsDialog } from "./WorkflowSettingsDialog";

const persona: WorkflowPersona = {
  id: "persona-1",
  label: "Linux desktop",
  rationale: "Stable owned lab desktop posture.",
  os_bucket: "linux_desktop",
  browser_channel_bucket: "chromium_stable",
  viewport: { width: 1365, height: 768 },
  window: { width: 1365, height: 768 },
  timezone: "Asia/Ho_Chi_Minh",
  locale: "vi-VN",
  proxy_geo_policy: "direct",
  webrtc_mode: "default",
  font_bundle: {
    label: "Default",
    expected_families: ["Arial"],
  },
  behavioral_timing_profile: "default",
};

const browserProfiles: BrowserProfile[] = [
  {
    id: "profile-1",
    project_id: "project-1",
    name: "Buyer A",
    description: "",
    is_default: false,
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: "bi_profile_1",
      display_name: "Buyer A",
      persona_id: persona.id,
      persona,
      profile_dir: "bi_profile_1",
      fingerprint_seed: "12345",
      profile_name: "bi_profile_1",
      proxy_enabled: false,
      headless: false,
      geoip: true,
      webrtc_policy: "default",
      humanize: true,
      human_preset: "default",
    },
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "profile-2",
    project_id: "project-1",
    name: "Buyer B",
    description: "",
    is_default: false,
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: "bi_profile_2",
      display_name: "Buyer B",
      persona_id: persona.id,
      persona,
      profile_dir: "bi_profile_2",
      fingerprint_seed: "23456",
      profile_name: "bi_profile_2",
      proxy_enabled: false,
      headless: false,
      geoip: true,
      webrtc_policy: "default",
      humanize: true,
      human_preset: "default",
    },
    created_at: "2026-01-02T00:00:00.000Z",
    updated_at: "2026-01-02T00:00:00.000Z",
  },
];

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

  test("renders Browser Profile selection without identity internals", async () => {
    const user = userEvent.setup();
    const onBrowserProfileChange = vi.fn();
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });

    render(
      <WorkflowSettingsDialog
        activeSection="browser_launch"
        hasUnsavedChanges={false}
        open
        browserProfiles={browserProfiles}
        selectedBrowserProfileId="profile-1"
        settings={settings}
        onActiveSectionChange={vi.fn()}
        onBrowserProfileChange={onBrowserProfileChange}
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
    expect(within(dialog).getByLabelText("Browser profile")).toHaveValue("profile-1");
    expect(within(dialog).getByRole("option", { name: "Buyer A" })).toBeInTheDocument();
    expect(within(dialog).getByRole("option", { name: "Buyer B" })).toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Identity display name")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Identity id")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Profile directory")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Legacy profile key")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Fingerprint seed")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Reset identity" })).not.toBeInTheDocument();
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
    expect(within(dialog).queryByLabelText("Proxy bypass")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Timezone")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Locale")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "GeoIP location" })).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("group", { name: "Fingerprint" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Fingerprint fonts directory")).not.toBeInTheDocument();
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
    expect(within(dialog).queryByRole("switch", { name: "Humanize browser input" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Humanize preset")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Behavior fidelity")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Fingerprint preflight" })).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Preflight probe URL")).not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Allowed probe origins")).not.toBeInTheDocument();

    await user.selectOptions(within(dialog).getByLabelText("Browser profile"), "profile-2");
    expect(onBrowserProfileChange).toHaveBeenCalledWith("profile-2");
  });

  test("does not expose session source or fork controls in Browser Launch", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });

    render(
      <WorkflowSettingsDialog
        activeSection="browser_launch"
        hasUnsavedChanges={false}
        open
        browserProfiles={browserProfiles}
        selectedBrowserProfileId="profile-1"
        settings={settings}
        onActiveSectionChange={vi.fn()}
        onBrowserProfileChange={vi.fn()}
        onDiscardChanges={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveSettings={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    expect(within(dialog).queryByLabelText("Session source")).not.toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Fork current session" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByText(/Shared with/i)).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText("Browser profile")).toBeInTheDocument();
    expect(within(dialog).queryByRole("switch", { name: "Reuse login session" }))
      .not.toBeInTheDocument();
    expect(within(dialog).queryByLabelText("Fingerprint seed")).not.toBeInTheDocument();
  });

  test("groups graph live run and link wait defaults into reusable settings field groups", () => {
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

    const liveRunGroup = within(dialog).getByRole("group", { name: "Live run" });
    expect(liveRunGroup).toHaveClass("settings-field-group");
    expect(within(liveRunGroup).getByRole("switch", { name: "Live Run" }))
      .toHaveAttribute("aria-checked", "true");
    expect(within(liveRunGroup).getByRole("switch", { name: "Follow current" }))
      .toHaveAttribute("aria-checked", "false");

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

  test("hides follow current when Live Run is disabled", async () => {
    const user = userEvent.setup();
    const initialSettings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });

    function Harness() {
      const [settings, setSettings] = useState<WorkflowSettings>(initialSettings);
      return (
        <WorkflowSettingsDialog
          activeSection="graph_defaults"
          hasUnsavedChanges={false}
          open
          settings={settings}
          onActiveSectionChange={vi.fn()}
          onDiscardChanges={vi.fn()}
          onOpenChange={vi.fn()}
          onSaveSettings={vi.fn()}
          onSettingsChange={setSettings}
        />
      );
    }

    render(<Harness />);

    const dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    const liveRunGroup = within(dialog).getByRole("group", { name: "Live run" });
    await user.click(within(liveRunGroup).getByRole("switch", { name: "Live Run" }));

    expect(within(liveRunGroup).queryByRole("switch", { name: "Follow current" }))
      .not.toBeInTheDocument();
  });

  test("groups workflow settings sections by related controls", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    settings.browser_launch.proxy_enabled = true;

    const props = {
      browserProfiles,
      hasUnsavedChanges: false,
      open: true,
      selectedBrowserProfileId: "profile-1",
      settings,
      onActiveSectionChange: vi.fn(),
      onBrowserProfileChange: vi.fn(),
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
    const expectedBrowserGroups = ["Browser Profile"];
    for (const groupName of expectedBrowserGroups) {
      expect(within(dialog).getByRole("group", { name: groupName })).toHaveClass("settings-field-group");
    }
    expect(within(within(dialog).getByRole("group", { name: "Browser Profile" })).getByLabelText("Browser profile"))
      .toBeInTheDocument();

    rerender(
      <WorkflowSettingsDialog
        {...props}
        activeSection="environment"
      />,
    );
    dialog = screen.getByRole("dialog", { name: "Workflow Settings" });
    expect(within(dialog).queryByRole("group", { name: "Initial variables" })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Add variable row" })).toBeInTheDocument();
  });

  test("does not edit profile-owned fingerprint settings in Workflow Settings", () => {
    const initialSettings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });
    render(
      <WorkflowSettingsDialog
        activeSection="browser_launch"
        browserProfiles={browserProfiles}
        hasUnsavedChanges={false}
        open
        selectedBrowserProfileId="profile-1"
        settings={initialSettings}
        onActiveSectionChange={vi.fn()}
        onBrowserProfileChange={vi.fn()}
        onDiscardChanges={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveSettings={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Show fingerprint seed" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Copy fingerprint seed" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fingerprint fonts directory")).not.toBeInTheDocument();
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

  test("does not render Run from selected controls in Workflow Settings Run Policy", () => {
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
        onSettingsChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("switch", { name: "Enable Run from selected" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Run from selected scope")).not.toBeInTheDocument();
  });

  test("does not expose workflow-level identity reset", () => {
    const initialSettings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Checkout QA",
    });

    render(
      <WorkflowSettingsDialog
        activeSection="browser_launch"
        browserProfiles={browserProfiles}
        hasUnsavedChanges={false}
        open
        selectedBrowserProfileId="profile-1"
        settings={initialSettings}
        onActiveSectionChange={vi.fn()}
        onBrowserProfileChange={vi.fn()}
        onDiscardChanges={vi.fn()}
        onOpenChange={vi.fn()}
        onSaveSettings={vi.fn()}
        onSettingsChange={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Reset identity" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Reset browser identity" })).not.toBeInTheDocument();
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
