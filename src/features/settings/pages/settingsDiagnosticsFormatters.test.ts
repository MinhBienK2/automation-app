import { describe, expect, test } from "vitest";
import type {
  BrowserProfileCleanupResult,
  CloakBrowserDiagnostics,
} from "../../../types/workflow";
import {
  formatBytes,
  formatCleanupResult,
  formatDiagnosticsReadiness,
  redactLocalPaths,
} from "./settingsDiagnosticsFormatters";

describe("settings diagnostics formatters", () => {
  test("formats readiness without exposing local paths", () => {
    const cards = formatDiagnosticsReadiness(diagnosticsFixture());
    const rendered = JSON.stringify(cards);

    expect(cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "CloakBrowser",
          value: "Installed 120.0.1",
          tone: "ready",
        }),
        expect.objectContaining({
          label: "GeoIP",
          value: "GeoIP unavailable",
          tone: "attention",
        }),
        expect.objectContaining({
          label: "Headed display",
          value: "Unavailable",
          tone: "attention",
        }),
        expect.objectContaining({
          label: "Smoke check",
          value: "Not recorded",
          tone: "neutral",
        }),
      ]),
    );
    expect(rendered).toContain("Wrapper 1.2.3");
    expect(rendered).toContain("Checksum skip enabled");
    expect(rendered).toContain("2 managed profiles");
    expect(rendered).toContain("1 retained session active");
    expect(rendered).toContain("1 orphaned profile can be cleaned");
    expect(rendered).toContain("font set hash abcdef123456");
    expect(rendered).not.toContain("/home/minhbien");
    expect(rendered).not.toContain("C:\\Users");
    expect(rendered).not.toContain("download.example");
  });

  test("formats byte and cleanup summaries", () => {
    expect(formatBytes(128)).toBe("128 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5 MB");

    const result: BrowserProfileCleanupResult = {
      deleted_profiles: ["orphan-a", "orphan-b"],
      skipped_profiles: [diagnosticsFixture().profiles[0]],
      reclaimed_bytes: 4096,
    };

    expect(formatCleanupResult(result)).toEqual([
      "Deleted 2 orphaned profiles.",
      "Skipped 1 managed or active profile.",
      "Reclaimed about 4 KB.",
      "Managed and active profiles were preserved.",
    ]);
  });

  test("redacts local paths from backend messages", () => {
    expect(redactLocalPaths("Failed at /home/minhbien/.cache/cloak/browser")).toBe(
      "Failed at local runtime path",
    );
    expect(redactLocalPaths("Failed at C:\\Users\\qa\\cloak\\browser")).toBe(
      "Failed at local runtime path",
    );
  });
});

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
