import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CloakBrowserDiagnostics } from "../../types/workflow";
import {
  cleanupOrphanedBrowserProfiles,
  getCloakBrowserDiagnostics,
  installCloakBrowserBinary,
} from "../../lib/api/workflowApi";
import { useSettingsDiagnostics } from "./useSettingsDiagnostics";

vi.mock("../../lib/api/workflowApi", () => ({
  cleanupOrphanedBrowserProfiles: vi.fn(),
  getCloakBrowserDiagnostics: vi.fn(),
  installCloakBrowserBinary: vi.fn(),
}));

describe("useSettingsDiagnostics", () => {
  beforeEach(() => {
    vi.mocked(cleanupOrphanedBrowserProfiles).mockReset();
    vi.mocked(getCloakBrowserDiagnostics).mockReset();
    vi.mocked(installCloakBrowserBinary).mockReset();
  });

  test("loads environment diagnostics", async () => {
    vi.mocked(getCloakBrowserDiagnostics).mockResolvedValue(diagnostics());
    const { result } = renderHook(() => useSettingsDiagnostics());

    await act(async () => {
      await result.current.loadSettingsDiagnostics();
    });

    expect(getCloakBrowserDiagnostics).toHaveBeenCalledOnce();
    expect(result.current.diagnostics?.binary.installed).toBe(true);
    expect(result.current.diagnosticsError).toBe("");
    expect(result.current.diagnosticsLoading).toBe(false);
  });

  test("cleans orphan profiles and refreshes diagnostics with a maintenance message", async () => {
    vi.mocked(cleanupOrphanedBrowserProfiles).mockResolvedValue({
      deleted_profiles: ["profile-a", "profile-b"],
      skipped_profiles: [],
      reclaimed_bytes: 2048,
    });
    vi.mocked(getCloakBrowserDiagnostics).mockResolvedValue(diagnostics());
    const { result } = renderHook(() => useSettingsDiagnostics());

    await act(async () => {
      await result.current.cleanupSettingsBrowserProfiles();
    });

    expect(cleanupOrphanedBrowserProfiles).toHaveBeenCalledOnce();
    expect(getCloakBrowserDiagnostics).toHaveBeenCalledOnce();
    expect(result.current.maintenanceMessage).toBe(
      "Deleted 2 orphaned profiles; reclaimed 2.0 KiB.",
    );
  });
});

function diagnostics(): CloakBrowserDiagnostics {
  return {
    wrapper_version: "1.0.0",
    binary: {
      version: "120.0.0",
      platform: "linux",
      installed: true,
      binary_path: "/tmp/cloak",
      cache_dir: "/tmp/cache",
      download_url: null,
    },
    auto_update_enabled: false,
    checksum_skip_enabled: false,
    geoip_available: true,
    profile_root: "/tmp/profiles",
    font_checklist: {
      status: "ok",
      reason: null,
      directories: [],
    },
    last_smoke_result: {
      status: "not_recorded",
      reason: null,
    },
    headed_display: {
      available: true,
      reason: null,
    },
    profiles: [],
  };
}
