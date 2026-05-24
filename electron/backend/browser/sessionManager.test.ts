// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import type { WorkflowSettings } from "../../../src/types/workflow";
import { defaultWorkflowSettings } from "../commands";
import { createAppPaths } from "../persistence/database";
import {
  BrowserSessionManager,
  browserIdentityEvidence,
  retainedProfileKey,
  type BrowserDriver,
  type BrowserDriverContext,
  type BrowserDriverPage,
} from "./sessionManager";

const tempRoots: string[] = [];

afterEach(async () => {
  for (const root of tempRoots.splice(0)) {
    await fs.rm(root, { recursive: true, force: true });
  }
});

describe("BrowserSessionManager", () => {
  test("launches persistent identities with CloakBrowser options and identity evidence", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const paths = await createTempAppPaths();
    const fontsDir = path.join(paths.rootDir, "fingerprint-fonts");
    await fs.mkdir(fontsDir, { recursive: true });
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    const settings = makeSettings({
      browser_launch: {
        session_mode: "persistent_profile",
        profile_name: "QA Profile",
        identity_id: "bi_identity",
        display_name: "QA Profile",
        profile_dir: "bi_identity",
        fingerprint_seed: "38291",
        headless: false,
        proxy_enabled: true,
        proxy_server: "http://agent:secret@proxy.local:8080",
        proxy_bypass: ".internal.test",
        proxy_label: "Corp proxy",
        proxy_region: "us-east",
        proxy_provider: "owned-lab",
        test_account_binding: "acct-checkout-1",
        timezone: "America/New_York",
        locale: "en-US",
        geoip: false,
        fingerprint_fonts_dir: fontsDir,
        webrtc_policy: "auto_proxy_exit_ip",
        humanize: false,
        human_preset: "careful",
      } as Partial<WorkflowSettings["browser_launch"]> & Record<string, unknown>,
    });

    const manager = new BrowserSessionManager({ appPaths: paths, driver });
    const launched = await manager.launchFreshSession({
      settings,
      retainedSessionWorkflowId: "workflow-1",
    });
    const evidence = await browserIdentityEvidence(settings, "run-identity-1");

    expect(launched).toEqual({ context, page: context.page, temporary: false });
    expect(driver.launches).toEqual([
      {
        kind: "persistent",
        options: expect.objectContaining({
          userDataDir: path.join(paths.browserProfilesDir, "bi_identity"),
          headless: false,
          humanize: false,
          humanPreset: "careful",
          timezone: "America/New_York",
          locale: "en-US",
          geoip: false,
          args: [
            "--fingerprint=38291",
            `--fingerprint-fonts-dir=${fontsDir}`,
            "--fingerprint-webrtc-ip=auto",
          ],
          proxy: {
            server: "http://proxy.local:8080/",
            bypass: ".internal.test",
            username: "agent",
            password: "secret",
          },
          contextOptions: expect.objectContaining({
            acceptDownloads: true,
            downloadsPath: paths.downloadsDir,
          }),
        }),
      },
    ]);
    expect(driver.launches[0]?.options).not.toHaveProperty("userAgent");
    expect(driver.launches[0]?.options).not.toHaveProperty("viewport");
    expect(driver.launches[0]?.options.args).not.toContain(
      `--window-size=${settings.browser_launch.persona.window.width},${settings.browser_launch.persona.window.height}`,
    );
    expect(retainedProfileKey(settings)).toBe("bi_identity");
    expect(evidence).toMatchObject({
      run_id: "run-identity-1",
      identity_id: "bi_identity",
      profile_dir: "bi_identity",
      session_mode: "persistent_profile",
      fingerprint_seed_hash: expect.stringMatching(/^[a-f0-9]{16}$/),
      fingerprint_fonts_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
      proxy_label: "Corp proxy",
      timezone_source: "explicit",
      locale_source: "explicit",
      advanced_overrides: ["fingerprint_fonts_dir"],
      humanize: false,
      human_preset: "careful",
    });
  });

  test("keeps stored persona dimensions in evidence without forcing launch dimensions", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const paths = await createTempAppPaths();
    const settings = makeSettings({
      browser_launch: {
        persona_id: "desktop_us_east_careful",
        persona: {
          id: "desktop_us_east_careful",
          label: "US East desktop careful",
          rationale: "Owned US East account using a headed desktop window and careful timing.",
          os_bucket: "windows_desktop",
          browser_channel_bucket: "chromium_stable",
          viewport: { width: 1365, height: 768 },
          window: { width: 1440, height: 900 },
          timezone: "America/New_York",
          locale: "en-US",
          proxy_geo_policy: "match_proxy_region",
          webrtc_mode: "auto_proxy_exit_ip",
          font_bundle: {
            label: "Windows 11 core fonts",
            path: null,
            expected_families: ["Arial", "Calibri"],
          },
          account_label: "checkout-us-east",
          test_account_binding: "acct-checkout-us-east",
          behavioral_timing_profile: "careful",
        },
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        timezone: "America/New_York",
        locale: "en-US",
        webrtc_policy: "auto_proxy_exit_ip",
        human_preset: "careful",
      } as Partial<WorkflowSettings["browser_launch"]> & Record<string, unknown>,
    });

    const manager = new BrowserSessionManager({ appPaths: paths, driver });
    await manager.launchFreshSession({
      settings,
      retainedSessionWorkflowId: "workflow-1",
    });
    const evidence = await browserIdentityEvidence(settings, "run-persona-1");

    expect(driver.launches[0]).toEqual({
      kind: "persistent",
      options: expect.objectContaining({
        timezone: "America/New_York",
        locale: "en-US",
        humanPreset: "careful",
        args: expect.arrayContaining([
          expect.stringMatching(/^--fingerprint=\d{5}$/),
          "--fingerprint-webrtc-ip=auto",
        ]),
      }),
    });
    expect(driver.launches[0]?.options).not.toHaveProperty("userAgent");
    expect(driver.launches[0]?.options).not.toHaveProperty("viewport");
    expect(driver.launches[0]?.options.args).not.toContain("--window-size=1440,900");
    expect(evidence).toMatchObject({
      persona: {
        id: "desktop_us_east_careful",
        label: "US East desktop careful",
        os_bucket: "windows_desktop",
        browser_channel_bucket: "chromium_stable",
        viewport: { width: 1365, height: 768 },
        window: { width: 1440, height: 900 },
        proxy_geo_policy: "match_proxy_region",
        font_bundle: {
          label: "Windows 11 core fonts",
          expected_families: ["Arial", "Calibri"],
        },
        account_label: "checkout-us-east",
        behavioral_timing_profile: "careful",
      },
    });
  });

  test("omits optional launch keys when no browser setting resolves them", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const paths = await createTempAppPaths();
    const settings = makeSettings({
      browser_launch: {
        session_mode: "temporary",
        profile_name: null,
        persona: null,
        fingerprint_fonts_dir: null,
        proxy_enabled: false,
        proxy_server: null,
        timezone: null,
        locale: null,
        geoip: false,
        webrtc_policy: "default",
      } as Partial<WorkflowSettings["browser_launch"]> & Record<string, unknown>,
    });

    const manager = new BrowserSessionManager({ appPaths: paths, driver });
    await manager.launchFreshSession({
      settings,
      retainedSessionWorkflowId: "workflow-1",
    });

    expect(driver.launches[0]).toEqual({
      kind: "temporary",
      options: expect.objectContaining({
        headless: false,
        humanize: true,
        humanPreset: "default",
        geoip: false,
        timezone: expectedLocalTimezone(),
        locale: expectedLocalLocale(),
        args: [expect.stringMatching(/^--fingerprint=\d{5}$/)],
      }),
    });
    expect(driver.launches[0]?.options).not.toHaveProperty("proxy");
    expect(driver.launches[0]?.options).not.toHaveProperty("userAgent");
    expect(driver.launches[0]?.options).not.toHaveProperty("viewport");
  });

  test("lets GeoIP own timezone and locale when no explicit location is configured", async () => {
    const context = new FakeContext();
    const driver = createFakeDriver(context);
    const settings = makeSettings({
      browser_launch: {
        session_mode: "temporary",
        profile_name: null,
        persona: null,
        timezone: null,
        locale: null,
        geoip: true,
      } as Partial<WorkflowSettings["browser_launch"]> & Record<string, unknown>,
    });

    const manager = new BrowserSessionManager({
      appPaths: await createTempAppPaths(),
      driver,
    });
    await manager.launchFreshSession({
      settings,
      retainedSessionWorkflowId: "workflow-1",
    });

    expect(driver.launches[0]?.options).toEqual(expect.objectContaining({
      geoip: true,
    }));
    expect(driver.launches[0]?.options).not.toHaveProperty("timezone");
    expect(driver.launches[0]?.options).not.toHaveProperty("locale");
  });

  test("tracks retained sessions per workflow profile and clears stale pages", async () => {
    const first = new FakeContext();
    const second = new FakeContext();
    const driver = createFakeDriver(first, second);
    const manager = new BrowserSessionManager({
      appPaths: await createTempAppPaths(),
      driver,
    });

    const firstSettings = makeSettings({
      browser_launch: { session_mode: "persistent_profile", profile_dir: "profile-a" },
    });
    const secondSettings = makeSettings({
      browser_launch: { session_mode: "persistent_profile", profile_dir: "profile-b" },
    });

    const firstLaunch = await manager.launchFreshSession({
      settings: firstSettings,
      retainedSessionWorkflowId: "workflow-1",
    });
    manager.retainSession(firstLaunch.context, firstLaunch.page, "workflow-1", "profile-a");
    const secondLaunch = await manager.launchFreshSession({
      settings: secondSettings,
      retainedSessionWorkflowId: "workflow-2",
    });
    manager.retainSession(secondLaunch.context, secondLaunch.page, "workflow-2", "profile-b");

    expect(first.closed).toBe(false);
    expect(second.closed).toBe(false);
    expect(manager.hasReusableRetainedSession("workflow-1", "profile-a")).toBe(true);
    first.page.closed = true;
    expect(manager.hasReusableRetainedSession("workflow-1", "profile-a")).toBe(false);
    expect(manager.getRetainedSessionState("workflow-1", "profile-a")).toMatchObject({
      available: false,
      reason: "No retained browser session",
    });
  });
});

function makeSettings(overrides: Partial<WorkflowSettings> = {}): WorkflowSettings {
  const defaults = defaultWorkflowSettings({
    id: "workflow-1",
    name: "Fixture",
    step_count: 0,
    created_at: "2026-05-09T00:00:00.000Z",
    updated_at: "2026-05-09T00:00:00.000Z",
  });
  return {
    ...defaults,
    ...overrides,
    browser_launch: {
      ...defaults.browser_launch,
      ...(overrides.browser_launch ?? {}),
    },
    run_policy: {
      ...defaults.run_policy,
      ...(overrides.run_policy ?? {}),
    },
  };
}

function expectedLocalTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
}

function expectedLocalLocale() {
  return Intl.DateTimeFormat().resolvedOptions().locale || "en-US";
}

async function createTempAppPaths() {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "browser-session-manager-"));
  tempRoots.push(rootDir);
  return createAppPaths(rootDir);
}

class FakeContext implements BrowserDriverContext {
  readonly page: FakePage;
  closed = false;
  private readonly closeHandlers: Array<() => void> = [];

  constructor(page = new FakePage()) {
    this.page = page;
  }

  pages() {
    return [this.page];
  }

  async newPage() {
    return this.page;
  }

  async close() {
    this.closed = true;
    for (const handler of this.closeHandlers) handler();
  }

  on(eventName: "close", handler: () => void) {
    if (eventName === "close") this.closeHandlers.push(handler);
  }
}

class FakePage implements BrowserDriverPage {
  closed = false;

  async goto() {}
  locator() {
    throw new Error("not implemented");
  }
  async evaluate() {
    return undefined;
  }
  isClosed() {
    return this.closed;
  }
}

function createFakeDriver(...contexts: FakeContext[]) {
  const launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }> = [];
  const driver: BrowserDriver & {
    launches: Array<{ kind: "temporary" | "persistent"; options: Record<string, unknown> }>;
  } = {
    launches,
    async launch(options) {
      launches.push({ kind: "temporary", options });
      return contexts[launches.length - 1] ?? contexts[0] ?? new FakeContext();
    },
    async launchPersistent(options) {
      launches.push({ kind: "persistent", options });
      return contexts[launches.length - 1] ?? contexts[0] ?? new FakeContext();
    },
  };
  return driver;
}
