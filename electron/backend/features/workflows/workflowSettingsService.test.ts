// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  deriveFingerprintSeedFromIdentityId,
  WorkflowSettingsService,
} from "./workflowSettingsService";
import { personaCatalog } from "../../../../src/lib/personaCatalog";
import type { WorkflowSettings } from "../../../../src/types/workflow";

describe("WorkflowSettingsService", () => {
  test("normalizes settings defaults and validates browser identity constraints without commands", () => {
    const service = new WorkflowSettingsService({
      directoryReadable: () => true,
      isOptionalModuleAvailable: () => false,
    });
    const workflow = {
      id: "workflow-1",
      name: "Checkout",
      step_count: 0,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    };

    const settings = service.normalizeWorkflowSettings(
      {
        ...service.defaultWorkflowSettings(workflow),
        browser_launch: {
          ...service.defaultWorkflowSettings(workflow).browser_launch,
          session_mode: "persistent_profile",
          profile_name: "",
          fingerprint_seed: "",
          webrtc_policy: "explicit_ip",
          webrtc_ip: "not-an-ip",
          preflight_enabled: true,
          preflight_probe_url: "https://owned.example/preflight",
          preflight_allowed_origins: ["https://owned.example"],
          headless: true,
        } as WorkflowSettings["browser_launch"] & Record<string, unknown>,
      },
      workflow,
    );

    expect(settings.browser_launch.profile_name).toBe(settings.browser_launch.profile_dir);
    expect(settings.browser_launch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(settings.browser_launch).not.toHaveProperty("preflight_enabled");
    expect(settings.browser_launch).not.toHaveProperty("preflight_probe_url");
    expect(settings.browser_launch).not.toHaveProperty("preflight_allowed_origins");
    expect(settings.run_policy.execute_js_enabled).toBe(true);
    expect(settings.graph_defaults).toMatchObject({
      live_run_enabled: true,
      live_run_follow_current: false,
    });
    const issues = service.validateSettings(settings);
    expect(issues).toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "webrtc_ip",
        level: "error",
      }),
    );
    expect(issues).not.toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "headless",
      }),
    );
    expect(issues).not.toContainEqual(
      expect.objectContaining({
        section: "browser_launch",
        field: "preflight_probe_url",
      }),
    );
  });

  test("derives deterministic collision-probed fingerprint seeds from identity ids", () => {
    const identityId = "bi_1234567890abcdef";
    const firstSeed = deriveFingerprintSeedFromIdentityId(identityId);

    expect(firstSeed).toMatch(/^\d{5}$/);
    expect(deriveFingerprintSeedFromIdentityId(identityId)).toBe(firstSeed);
    expect(deriveFingerprintSeedFromIdentityId(identityId, new Set([firstSeed])))
      .not.toBe(firstSeed);
  });

  test("defaults readable repo-local CloakBrowser fonts without restoring them after a user clears the field", () => {
    const defaultFontsDir = "/repo/.local/cloakbrowser-fonts/linux";
    const service = new WorkflowSettingsService({
      directoryReadable: () => true,
      isOptionalModuleAvailable: () => true,
      defaultFingerprintFontsDir: () => defaultFontsDir,
    });
    const workflow = {
      id: "workflow-font-default",
      name: "Font defaults",
      step_count: 0,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    };

    const defaults = service.defaultWorkflowSettings(workflow);
    const cleared = service.normalizeWorkflowSettings(
      {
        ...defaults,
        browser_launch: {
          ...defaults.browser_launch,
          fingerprint_fonts_dir: null,
        },
      },
      workflow,
    );

    expect(defaults.browser_launch.fingerprint_fonts_dir).toBe(defaultFontsDir);
    expect(defaults.browser_launch.geoip).toBe(true);
    expect(cleared.browser_launch.fingerprint_fonts_dir).toBeNull();
  });

  test("migrates blank legacy location settings to GeoIP", () => {
    const service = new WorkflowSettingsService({
      directoryReadable: () => true,
      isOptionalModuleAvailable: () => true,
    });
    const workflow = {
      id: "workflow-legacy-geoip",
      name: "Legacy location",
      step_count: 0,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    };
    const defaults = service.defaultWorkflowSettings(workflow);

    const normalized = service.normalizeWorkflowSettings(
      {
        ...defaults,
        browser_launch: {
          ...defaults.browser_launch,
          geoip: false,
          timezone: null,
          locale: null,
        },
      },
      workflow,
    );

    expect(normalized.browser_launch.geoip).toBe(true);
  });

  test("stores a coherent persona object with normalized browser identity settings", () => {
    const service = new WorkflowSettingsService({
      directoryReadable: () => true,
      isOptionalModuleAvailable: () => true,
    });
    const workflow = {
      id: "workflow-persona",
      name: "Persona checkout",
      step_count: 0,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    };

    const settings = service.normalizeWorkflowSettings({
      ...service.defaultWorkflowSettings(workflow),
      browser_launch: {
        ...service.defaultWorkflowSettings(workflow).browser_launch,
        persona_id: "desktop_us_east_careful",
        persona: {
          id: "unknown",
          label: "stale",
          rationale: "",
          os_bucket: "linux_desktop",
          browser_channel_bucket: "chromium_stable",
          viewport: { width: 1, height: 1 },
          window: { width: 1, height: 1 },
          timezone: "UTC",
          locale: "en-US",
          proxy_geo_policy: "direct",
          webrtc_mode: "default",
          font_bundle: {
            label: "Host default",
            path: null,
            expected_families: [],
          },
          account_label: null,
          test_account_binding: null,
          behavioral_timing_profile: "default",
        },
      },
    }, workflow);
    const catalogPersona = personaCatalog.find((persona) => persona.id === "desktop_us_east_careful");

    expect(settings.browser_launch.persona_id).toBe("desktop_us_east_careful");
    expect(settings.browser_launch.persona).toEqual(catalogPersona);
    expect(settings.browser_launch.timezone).toBeNull();
    expect(settings.browser_launch.locale).toBeNull();
    expect(settings.browser_launch.webrtc_policy).toBe(catalogPersona?.webrtc_mode);
    expect(settings.browser_launch.human_preset).toBe(catalogPersona?.behavioral_timing_profile);
  });

  test("drops legacy proxy metadata fields from normalized browser launch settings", () => {
    const service = new WorkflowSettingsService({
      directoryReadable: () => true,
      isOptionalModuleAvailable: () => true,
    });
    const workflow = {
      id: "workflow-proxy-metadata",
      name: "Proxy metadata cleanup",
      step_count: 0,
      created_at: "2026-05-24T00:00:00.000Z",
      updated_at: "2026-05-24T00:00:00.000Z",
    };

    const settings = service.normalizeWorkflowSettings({
      ...service.defaultWorkflowSettings(workflow),
      browser_launch: {
        ...service.defaultWorkflowSettings(workflow).browser_launch,
        proxy_label: "Corp proxy",
        proxy_region: "apac-vn",
        proxy_provider: "owned-lab",
        test_account_binding: "acct-checkout-1",
        proxy_bypass: ".internal.test",
      } as Partial<WorkflowSettings["browser_launch"]> & Record<string, unknown>,
    }, workflow);

    expect(settings.browser_launch).not.toHaveProperty("proxy_label");
    expect(settings.browser_launch).not.toHaveProperty("proxy_region");
    expect(settings.browser_launch).not.toHaveProperty("proxy_provider");
    expect(settings.browser_launch).not.toHaveProperty("test_account_binding");
    expect(settings.browser_launch.proxy_bypass).toBe(".internal.test");
  });
});
