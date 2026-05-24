// @vitest-environment node

import { describe, expect, test } from "vitest";
import { buildFingerprintRegressionReport } from "./fingerprintRegression";

describe("fingerprint regression report", () => {
  test("passes the required owned preflight matrix when evidence matches persona", () => {
    const report = buildFingerprintRegressionReport({
      browserIdentity: browserIdentity(),
      preflight: preflightVerdict({
        evidence: {
          navigator: {
            webdriver: false,
            user_agent: "Mozilla/5.0 Chrome/130",
            languages: ["en-US", "en"],
            platform: "Win32",
          },
          hashes: {
            canvas: "canvas-bucket-a",
            webgl: "webgl-bucket-a",
            audio: "audio-bucket-a",
          },
          fonts: {
            count: 74,
            hash: "fonts-bucket-a",
            expected_families_present: ["Arial", "Calibri"],
          },
          timezone: "America/New_York",
          locale: "en-US",
          webrtc: {
            mode: "default",
            leak_status: "none",
          },
          viewport: { width: 1365, height: 768 },
          window: { width: 1440, height: 900 },
          screen: { width: 1440, height: 900 },
          proxy: {
            expected_region: "us-east",
            observed_region: "us-east",
            aligned: true,
          },
          storage: {
            persistent: true,
            continuity: "same_profile",
          },
          automation: {
            headless_leak: false,
          },
        },
      }),
    });

    expect(report.schema_version).toBe(1);
    expect(report.summary).toMatchObject({
      failed: 0,
      missing: 0,
    });
    expect(report.checks.map((check) => check.id)).toEqual([
      "navigator.webdriver",
      "navigator.user_agent",
      "navigator.languages",
      "canvas.hash",
      "webgl.hash",
      "audio.hash",
      "fonts.hash",
      "timezone.match",
      "locale.match",
      "webrtc.mode",
      "display.viewport",
      "display.window",
      "display.screen",
      "proxy.geo",
      "storage.continuity",
      "automation.headless",
    ]);
  });

  test("flags missing and mismatched metrics without copying raw sensitive evidence", () => {
    const report = buildFingerprintRegressionReport({
      browserIdentity: browserIdentity(),
      preflight: preflightVerdict({
        evidence: {
          navigator: { webdriver: true },
          hashes: { canvas: "canvas-bucket-a" },
          timezone: "Europe/Dublin",
          locale: "en-IE",
          viewport: { width: 1024, height: 768 },
          storage: {},
          token: "[REDACTED]",
        },
      }),
    });

    expect(report.summary.failed).toBeGreaterThan(0);
    expect(report.summary.missing).toBeGreaterThan(0);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "timezone.match",
          status: "failed",
          expected: "America/New_York",
          observed: "Europe/Dublin",
        }),
        expect.objectContaining({
          id: "webgl.hash",
          status: "missing",
        }),
        expect.objectContaining({
          id: "automation.headless",
          status: "failed",
        }),
      ]),
    );
    expect(JSON.stringify(report)).not.toContain("secret");
  });
});

function browserIdentity() {
  return {
    run_id: "run-fp",
    identity_id: "bi_identity",
    profile_dir: "bi_identity",
    session_mode: "persistent_profile",
    persona: {
      id: "desktop_us_east_careful",
      label: "US East desktop careful",
      os_bucket: "windows_desktop",
      browser_channel_bucket: "chromium_stable",
      viewport: { width: 1365, height: 768 },
      window: { width: 1440, height: 900 },
      timezone: "America/New_York",
      locale: "en-US",
      proxy_geo_policy: "match_proxy_region",
      proxy_region: "us-east",
      webrtc_mode: "default",
      font_bundle: {
        label: "Windows 11 core fonts",
        expected_families: ["Arial", "Calibri"],
      },
      behavioral_timing_profile: "careful",
    },
    timezone: "America/New_York",
    locale: "en-US",
    proxy_region: "us-east",
    webrtc_policy: "default",
    cloakbrowser: { wrapper_version: "0.3.30" },
  };
}

function preflightVerdict(overrides: Record<string, unknown>) {
  return {
    passed: true,
    verdict: "passed",
    risk_score: 0,
    run_id: "probe-run",
    profile_id: "bi_identity",
    mismatches: [],
    ...overrides,
  };
}
