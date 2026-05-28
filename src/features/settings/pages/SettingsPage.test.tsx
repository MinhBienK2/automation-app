import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { describe, expect, test, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import type { CloakBrowserDiagnostics } from "../../../types/workflow";

describe("SettingsPage", () => {
  test("renders app-level settings sections and autosave state", async () => {
    const onGraphAutosaveEnabledChange = vi.fn();
    renderSettings({
      graphAutosaveEnabled: true,
      onGraphAutosaveEnabledChange,
    });

    expect(screen.getByRole("heading", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByText("App preferences, local runtime readiness, and maintenance."))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Workflow editing settings" }))
      .toHaveTextContent("Graph persistence");
    expect(screen.getByRole("region", { name: "Environment readiness" }))
      .toHaveTextContent("Environment readiness");
    expect(screen.getByRole("region", { name: "Maintenance" })).toHaveTextContent("Maintenance");
    expect(screen.getByRole("region", { name: "Graph shortcuts" })).toHaveTextContent("Graph shortcuts");
    expect(screen.getByText("Graph edits save after changes.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("switch", { name: "Autosave graph changes" }));
    expect(onGraphAutosaveEnabledChange).toHaveBeenCalledWith(false);
  });

  test("shows manual save copy when autosave is disabled", () => {
    renderSettings({ graphAutosaveEnabled: false });

    expect(screen.getByText("Manual save is required")).toBeInTheDocument();
    expect(screen.getByText("Graph edits remain unsaved until you choose Save in the workflow detail."))
      .toBeInTheDocument();
  });

  test("renders sanitized diagnostics readiness cards and preserves them during refresh", () => {
    renderSettings({ diagnosticsLoading: true });
    expect(screen.getByText("Refreshing...")).toBeInTheDocument();

    const readiness = screen.getByRole("region", { name: "Environment readiness" });
    expect(readiness).toHaveTextContent("Installed 120.0.1");
    expect(readiness).toHaveTextContent("Wrapper 1.2.3");
    expect(readiness).toHaveTextContent("Checksum skip enabled");
    expect(readiness).toHaveTextContent("GeoIP unavailable");
    expect(readiness).toHaveTextContent("Unavailable");
    expect(readiness).toHaveTextContent("Warning");
    expect(readiness).toHaveTextContent("24 font files");
    expect(readiness).toHaveTextContent("2 managed profiles");
    expect(readiness).toHaveTextContent("1 retained session active");
    expect(readiness).toHaveTextContent("1 orphaned profile can be cleaned");
    expect(readiness).toHaveTextContent("Not recorded");
    expect(readiness).not.toHaveTextContent("/home/minhbien");
    expect(readiness).not.toHaveTextContent("download.example");
  });

  test("shows loading and diagnostics errors inside environment readiness", () => {
    const { rerender } = renderSettings({
      diagnostics: null,
      diagnosticsLoading: true,
    });

    expect(screen.getByText("Loading diagnostics...")).toBeInTheDocument();

    rerender(
      <SettingsPage
        {...settingsProps({
          diagnosticsError: "No DISPLAY at /home/minhbien/.cache/runtime",
        })}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("No DISPLAY at local runtime path");
  });

  test("guards install and cleanup maintenance actions", async () => {
    const onInstallBinary = vi.fn().mockResolvedValue(undefined);
    const onCleanupProfiles = vi.fn().mockResolvedValue(undefined);
    renderSettings({
      onInstallBinary,
      onCleanupProfiles,
      maintenanceMessage: "Deleted 1 orphaned profile. Reclaimed about 4 KB.",
    });

    await userEvent.click(screen.getByRole("button", { name: "Install CloakBrowser Binary" }));
    expect(onInstallBinary).not.toHaveBeenCalled();
    let dialog = await screen.findByRole("dialog", { name: "Install CloakBrowser Binary" });
    expect(within(dialog).getByText(/local CloakBrowser-managed browser runtime/)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Install Binary" }));
    await waitFor(() => expect(onInstallBinary).toHaveBeenCalledTimes(1));

    await userEvent.click(screen.getByRole("button", { name: "Cleanup Orphaned Profiles" }));
    expect(onCleanupProfiles).not.toHaveBeenCalled();
    dialog = await screen.findByRole("dialog", { name: "Cleanup Orphaned Profiles" });
    expect(within(dialog).getByText(/Delete only orphaned inactive browser profiles/))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/Workflows, evidence, settings, and active profiles are preserved/))
      .toBeInTheDocument();
    expect(within(dialog).getByText("1 orphaned profile can be cleaned")).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Cleanup Profiles" }));
    await waitFor(() => expect(onCleanupProfiles).toHaveBeenCalledTimes(1));

    expect(screen.getByRole("status")).toHaveTextContent("Deleted 1 orphaned profile");
  });

  test("renders graph shortcut guide groups", () => {
    renderSettings();

    const shortcuts = screen.getByRole("region", { name: "Graph shortcuts" });
    expect(within(shortcuts).getByRole("region", { name: "Navigation shortcuts" }))
      .toHaveTextContent("Drag empty canvas");
    expect(within(shortcuts).getByRole("region", { name: "Selection shortcuts" }))
      .toHaveTextContent("Click node or link");
    expect(within(shortcuts).getByRole("region", { name: "Editing shortcuts" }))
      .toHaveTextContent("Ctrl/Cmd + C");
    expect(within(shortcuts).getByRole("region", { name: "Run and save shortcuts" }))
      .toHaveTextContent("Ctrl/Cmd + Enter");
  });
});

type SettingsPageTestProps = ComponentProps<typeof SettingsPage>;

function renderSettings(overrides: Partial<SettingsPageTestProps> = {}) {
  return render(<SettingsPage {...settingsProps(overrides)} />);
}

function settingsProps(overrides: Partial<SettingsPageTestProps> = {}) {
  return {
    graphAutosaveEnabled: true,
    diagnostics: diagnosticsFixture(),
    diagnosticsLoading: false,
    diagnosticsError: "",
    maintenanceMessage: "",
    onGraphAutosaveEnabledChange: vi.fn(),
    onRefreshDiagnostics: vi.fn(),
    onInstallBinary: vi.fn(),
    onCleanupProfiles: vi.fn(),
    ...overrides,
  };
}

function diagnosticsFixture(): CloakBrowserDiagnostics {
  return {
    wrapper_version: "1.2.3",
    binary: {
      version: "120.0.1",
      platform: "linux",
      installed: true,
      binary_path: "/home/minhbien/.cache/cloakbrowser/chrome",
      cache_dir: "/home/minhbien/.cache/cloakbrowser",
      download_url: "https://download.example/chrome.zip",
    },
    auto_update_enabled: false,
    checksum_skip_enabled: true,
    geoip_available: false,
    profile_root: "/home/minhbien/.config/automation-app/browser-profiles",
    font_checklist: {
      status: "warning",
      reason: "Missing fonts under /home/minhbien/fonts",
      directories: [
        {
          path: "/home/minhbien/fonts",
          status: "warning",
          reason: "Missing expected font families: Arial",
          file_count: 24,
          total_size_bytes: 4096,
          normalized_hash: "abcdef1234567890",
          expected_families_present: ["Ubuntu"],
          missing_expected_families: ["Arial"],
          workflow_ids: ["workflow-1", "workflow-2"],
          workflow_names: ["Login flow", "Audit flow"],
        },
      ],
    },
    last_smoke_result: {
      status: "not_recorded",
      reason: null,
    },
    headed_display: {
      available: false,
      reason: "No DISPLAY or WAYLAND_DISPLAY is configured for headed Linux runs",
    },
    profiles: [
      {
        profile_dir: "profile-managed",
        identity_id: "bi_managed",
        display_name: "Managed",
        workflow_id: "workflow-1",
        workflow_name: "Login flow",
        approximate_size_bytes: 2048,
        last_modified_at: null,
        last_run_at: null,
        active_session: true,
      },
      {
        profile_dir: "orphan-profile",
        identity_id: null,
        display_name: null,
        workflow_id: null,
        workflow_name: null,
        approximate_size_bytes: 4096,
        last_modified_at: null,
        last_run_at: null,
        active_session: false,
      },
    ],
  };
}
