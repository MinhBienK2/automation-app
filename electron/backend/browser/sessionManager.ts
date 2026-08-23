import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  RunState,
  WorkflowPersona,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../db/database.js";
import { sanitizePathSegment } from "../shared/paths.js";
import { isPlainRecord } from "../shared/records.js";
import { localBrowserLocale, localBrowserTimezone } from "./localEnvironment.js";
import { fingerprintFontsHash } from "./fonts.js";

type CloakBrowserModule = {
  launchContext: (options?: BrowserLaunchOptions) => Promise<BrowserDriverContext>;
  launchPersistentContext: (
    options: BrowserLaunchOptions & { userDataDir: string },
  ) => Promise<BrowserDriverContext>;
  binaryInfo?: () => {
    version?: string;
    platform?: string;
    installed?: boolean;
  };
};

type PlaywrightFirefox = {
  launch(options: BrowserLaunchOptions): Promise<{
    newContext(options?: BrowserLaunchOptions): Promise<BrowserDriverContext>;
    close(): Promise<void>;
  }>;
  launchPersistentContext(
    userDataDir: string,
    options?: BrowserLaunchOptions,
  ): Promise<BrowserDriverContext>;
};

export type BrowserLaunchOptions = Record<string, unknown>;

export type BrowserDriver = {
  launch(options: BrowserLaunchOptions): Promise<BrowserDriverContext>;
  launchPersistent(
    options: BrowserLaunchOptions & { userDataDir: string },
  ): Promise<BrowserDriverContext>;
};

export type BrowserDriverContext = {
  pages(): BrowserDriverPage[];
  newPage(): Promise<BrowserDriverPage>;
  close(): Promise<void>;
  waitForEvent?(eventName: string, options?: Record<string, unknown>): Promise<any>;
  on?(eventName: string, handler: (...args: never[]) => void): void;
  addCookies?(cookies: Array<Record<string, unknown>>): Promise<void>;
  clearCookies?(options?: Record<string, unknown>): Promise<void>;
  grantPermissions?(permissions: string[], options?: { origin?: string }): Promise<void>;
  setGeolocation?(geolocation: {
    latitude: number;
    longitude: number;
    accuracy?: number | null;
  }): Promise<void>;
  setExtraHTTPHeaders?(headers: Record<string, string>): Promise<void>;
  route?(
    url: string | RegExp | ((url: URL) => boolean),
    handler: (route: BrowserRoute) => Promise<void> | void,
  ): Promise<void>;
};

export type BrowserDriverPage = {
  goto(url: string, options?: Record<string, unknown>): Promise<unknown>;
  locator(selector: string): BrowserDriverLocator;
  waitForLoadState?(state?: string, options?: Record<string, unknown>): Promise<unknown>;
  waitForURL?(url: string | RegExp | ((url: URL) => boolean), options?: Record<string, unknown>): Promise<unknown>;
  waitForRequest?(predicate: string | RegExp | ((request: BrowserRequest) => boolean), options?: Record<string, unknown>): Promise<BrowserRequest>;
  waitForResponse?(predicate: string | RegExp | ((response: BrowserResponse) => boolean), options?: Record<string, unknown>): Promise<BrowserResponse>;
  waitForEvent?(eventName: "download", options?: Record<string, unknown>): Promise<BrowserDownload>;
  once?(eventName: "dialog", handler: (dialog: BrowserDialog) => void | Promise<void>): void;
  getByTestId?(testId: string): BrowserDriverLocator;
  getByRole?(role: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByLabel?(label: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByPlaceholder?(placeholder: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByText?(text: string, options?: Record<string, unknown>): BrowserDriverLocator;
  frameLocator?(selector: string): BrowserDriverFrameLocator;
  goBack?(): Promise<unknown>;
  goForward?(): Promise<unknown>;
  reload?(): Promise<unknown>;
  bringToFront?(): Promise<void>;
  close?(): Promise<void>;
  isClosed?(): boolean;
  screenshot?(options?: Record<string, unknown>): Promise<Buffer>;
  evaluate<R = unknown, A = unknown>(
    pageFunction: string | ((arg?: A) => R | Promise<R>),
    arg?: A,
  ): Promise<R>;
  exposeFunction?(
    name: string,
    callback: (payload: Record<string, unknown>) => void | Promise<void>,
  ): Promise<void>;
  on?(eventName: string, handler: (...args: never[]) => void | Promise<void>): void;
  evaluateHandle?(pageFunction: string | ((arg?: unknown) => unknown), arg?: unknown): Promise<unknown>;
  addInitScript?(script: string): Promise<unknown>;
  setViewportSize?(viewport: { width: number; height: number }): Promise<void>;
  keyboard?: {
    press(key: string, options?: Record<string, unknown>): Promise<void>;
    down?(key: string, options?: Record<string, unknown>): Promise<void>;
    up?(key: string, options?: Record<string, unknown>): Promise<void>;
    type(text: string, options?: Record<string, unknown>): Promise<void>;
    insertText?(text: string): Promise<void>;
  };
  mouse?: {
    move?(x: number, y: number): Promise<void>;
    down?(options?: Record<string, unknown>): Promise<void>;
    up?(options?: Record<string, unknown>): Promise<void>;
    wheel(deltaX: number, deltaY: number): Promise<void>;
  };
};

export type BrowserDriverFrameLocator = {
  locator(selector: string): BrowserDriverLocator;
  getByTestId?(testId: string): BrowserDriverLocator;
  getByRole?(role: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByLabel?(label: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByPlaceholder?(placeholder: string, options?: Record<string, unknown>): BrowserDriverLocator;
  getByText?(text: string, options?: Record<string, unknown>): BrowserDriverLocator;
  frameLocator?(selector: string): BrowserDriverFrameLocator;
};

export type BrowserDriverLocator = {
  fill(value: string, options?: Record<string, unknown>): Promise<void>;
  type?(value: string, options?: Record<string, unknown>): Promise<void>;
  click(options?: Record<string, unknown>): Promise<void>;
  evaluate?<Result, Arg = unknown>(
    pageFunction: (element: Element, arg: Arg) => Result | Promise<Result>,
    arg?: Arg,
  ): Promise<Result>;
  hover?(options?: Record<string, unknown>): Promise<void>;
  dblclick?(options?: Record<string, unknown>): Promise<void>;
  check?(options?: Record<string, unknown>): Promise<void>;
  uncheck?(options?: Record<string, unknown>): Promise<void>;
  selectOption?(value: string | string[] | Record<string, string>): Promise<unknown>;
  setInputFiles?(files: string[]): Promise<void>;
  press?(key: string, options?: Record<string, unknown>): Promise<void>;
  textContent?(options?: Record<string, unknown>): Promise<string | null>;
  getAttribute?(attribute: string, options?: Record<string, unknown>): Promise<string | null>;
  inputValue?(options?: Record<string, unknown>): Promise<string>;
  boundingBox?(): Promise<{ x?: number; y?: number; width: number; height: number } | null>;
  count?(): Promise<number>;
  nth?(index: number): BrowserDriverLocator;
  isVisible?(options?: Record<string, unknown>): Promise<boolean>;
  isEnabled?(options?: Record<string, unknown>): Promise<boolean>;
  waitFor?(options?: Record<string, unknown>): Promise<void>;
  dragTo?(target: BrowserDriverLocator, options?: Record<string, unknown>): Promise<void>;
  scrollIntoViewIfNeeded?(options?: Record<string, unknown>): Promise<void>;
};

type BrowserDialog = {
  accept(promptText?: string): Promise<void>;
  dismiss(): Promise<void>;
  type?(): string;
  message?(): string;
  defaultValue?(): string;
};

type BrowserDownload = {
  suggestedFilename?(): string;
  saveAs?(filePath: string): Promise<void>;
  path?(): Promise<string | null>;
};

type BrowserRoute = {
  abort(): Promise<void>;
  fulfill(response: Record<string, unknown>): Promise<void>;
  continue(): Promise<void>;
};

type BrowserRequest = {
  url(): string;
};

type BrowserResponse = {
  url(): string;
  status(): number;
};

export type RetainedSession = {
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  workflowId: string | null;
  profileName: string | null;
};

type BrowserSessionManagerOptions = {
  appPaths: AppPaths;
  driver?: BrowserDriver;
  retainedSessions?: Map<string, RetainedSession>;
  usesDefaultDriver?: boolean;
};

export class BrowserSessionManager {
  private readonly appPaths: AppPaths;
  private readonly driver: BrowserDriver;
  private readonly usesDefaultDriver: boolean;
  private retainedSessions: Map<string, RetainedSession>;

  constructor(options: BrowserSessionManagerOptions) {
    this.appPaths = options.appPaths;
    this.driver = options.driver ?? createDefaultBrowserDriver();
    this.usesDefaultDriver = options.usesDefaultDriver ?? !options.driver;
    this.retainedSessions = options.retainedSessions ?? new Map<string, RetainedSession>();
  }

  createIsolatedManager() {
    return new BrowserSessionManager({
      appPaths: this.appPaths,
      driver: this.driver,
      retainedSessions: this.retainedSessions,
      usesDefaultDriver: this.usesDefaultDriver,
    });
  }

  async launchFreshSession(request: {
    settings: WorkflowSettings;
    retainedSessionWorkflowId?: string | null;
  }) {
    const profileName = retainedProfileKey(request.settings);
    if (request.retainedSessionWorkflowId !== undefined) {
      if (profileName) {
        await this.closeRetainedSessionsForProfile(profileName);
      } else {
        await this.closeRetainedSession(request.retainedSessionWorkflowId ?? null, null);
      }
    } else {
      await this.closeRetainedContext();
    }
    return this.launch(request.settings);
  }

  async reuseRetainedSession(request: {
    settings: WorkflowSettings;
    retainedSessionWorkflowId?: string | null;
  }) {
    const profileName = retainedProfileKey(request.settings);
    const workflowId = request.retainedSessionWorkflowId ?? null;
    if (!workflowId || !this.hasReusableRetainedSession(workflowId, profileName)) {
      throw new Error("No reusable browser session is available. Run the workflow again to create one.");
    }
    const session = this.retainedSessions.get(retainedSessionKey(workflowId, profileName));
    if (!session) {
      throw new Error("No reusable browser session is available. Run the workflow again to create one.");
    }
    return { context: session.context, page: session.page, temporary: false };
  }

  retainSession(
    context: BrowserDriverContext,
    page: BrowserDriverPage,
    workflowId: string | null,
    profileName: string | null,
  ) {
    const key = retainedSessionKey(workflowId, profileName);
    this.retainedSessions.set(key, { context, page, workflowId, profileName });
    context.on?.("close", () => {
      if (this.retainedSessions.get(key)?.context === context) {
        this.retainedSessions.delete(key);
      }
    });
  }

  async closeRetainedContext() {
    for (const session of this.retainedSessions.values()) {
      await session.context.close();
    }
    this.retainedSessions.clear();
  }

  async closeRetainedSession(workflowId: string | null, profileName: string | null) {
    const key = retainedSessionKey(workflowId, profileName);
    const session = this.retainedSessions.get(key);
    if (!session) return;
    await session.context.close();
    this.retainedSessions.delete(key);
  }

  private async closeRetainedSessionsForProfile(profileName: string) {
    for (const [key, session] of [...this.retainedSessions]) {
      if (session.profileName !== profileName) continue;
      await session.context.close();
      this.retainedSessions.delete(key);
    }
  }

  forgetContext(context: BrowserDriverContext) {
    for (const [key, session] of this.retainedSessions) {
      if (session.context === context) {
        this.retainedSessions.delete(key);
      }
    }
  }

  hasReusableRetainedSession(workflowId: string, profileName?: string | null) {
    const key = retainedSessionKey(workflowId, profileName ?? null);
    const session = this.retainedSessions.get(key);
    if (!session || this.isRetainedSessionStale(session)) {
      this.retainedSessions.delete(key);
      return false;
    }
    return true;
  }

  getRetainedSessionState(workflowId?: string | null, profileName?: string | null) {
    return this.retainedSessionState(workflowId, profileName);
  }

  getRetainedSessionStates() {
    const states: NonNullable<RunState["retained_session"]>[] = [];
    for (const session of this.retainedSessions.values()) {
      const state = this.retainedSessionState(session.workflowId, session.profileName);
      if (state) {
        states.push(state);
      }
    }
    return states;
  }

  private async launch(settings: WorkflowSettings) {
    if (this.usesDefaultDriver) assertHeadedDisplayAvailable(settings);
    const options = buildLaunchOptions(settings, this.appPaths);
    const profileDir = retainedProfileKey(settings);
    const context = profileDir
      ? await this.driver.launchPersistent({
          ...options,
          userDataDir: path.join(this.appPaths.browserProfilesDir, sanitizePathSegment(profileDir)),
        })
      : await this.driver.launch(options);
    const page = context.pages()[0] ?? (await context.newPage());
    return { context, page, temporary: !profileDir };
  }

  private retainedSessionState(workflowId?: string | null, profileName?: string | null): RunState["retained_session"] {
    if (workflowId !== undefined || profileName !== undefined) {
      const key = retainedSessionKey(workflowId ?? null, profileName ?? null);
      const session = this.retainedSessions.get(key);
      if (!session) {
        return {
          available: false,
          workflow_id: workflowId ?? null,
          profile_name: profileName ?? null,
          reason: "No retained browser session",
        };
      }
      if (this.isRetainedSessionStale(session)) {
        this.retainedSessions.delete(key);
        return {
          available: false,
          workflow_id: workflowId ?? null,
          profile_name: profileName ?? null,
          reason: "Browser session was closed",
        };
      }
      return {
        available: true,
        workflow_id: session.workflowId,
        profile_name: session.profileName,
        reason: null,
      };
    }

    const sessions = [...this.retainedSessions.values()];
    if (sessions.length === 0) {
      return {
        available: false,
        workflow_id: null,
        profile_name: null,
        reason: "No retained browser session",
      };
    }
    if (sessions.length > 1) {
      return {
        available: false,
        workflow_id: null,
        profile_name: null,
        reason: "Multiple retained browser sessions",
      };
    }
    const session = sessions[0];
    if (this.isRetainedSessionStale(session)) {
      this.retainedSessions.delete(retainedSessionKey(session.workflowId, session.profileName));
      return {
        available: false,
        workflow_id: null,
        profile_name: null,
        reason: "Browser session was closed",
      };
    }
    return {
      available: true,
      workflow_id: session.workflowId,
      profile_name: session.profileName,
      reason: null,
    };
  }

  private isRetainedSessionStale(session: RetainedSession) {
    const contextClosed = (session.context as { closed?: boolean }).closed === true;
    const pageClosed = session.page.isClosed?.() === true;
    return contextClosed || pageClosed;
  }
}

export function createCloakBrowserDriver(moduleOverride?: CloakBrowserModule): BrowserDriver {
  const loadModule = async () => {
    return moduleOverride ?? loadCloakBrowserModule();
  };

  return {
    async launch(options) {
      const cloakbrowser = await loadModule();
      return cloakbrowser.launchContext(options);
    },
    async launchPersistent(options) {
      const cloakbrowser = await loadModule();
      return cloakbrowser.launchPersistentContext(options);
    },
  };
}

export function createDefaultBrowserDriver(): BrowserDriver {
  return selectedBrowserEngine() === "camoufox"
    ? createCamoufoxDriver()
    : createCloakBrowserDriver();
}

export function createCamoufoxDriver(options: {
  firefox?: PlaywrightFirefox;
  executablePath?: string;
} = {}): BrowserDriver {
  const loadFirefox = async () => {
    if (options.firefox) return options.firefox;
    const moduleValue = await import("playwright-core");
    return moduleValue.firefox as unknown as PlaywrightFirefox;
  };
  const executablePath = options.executablePath ?? camoufoxExecutablePath();

  return {
    async launch(options) {
      const firefox = await loadFirefox();
      const browser = await firefox.launch(camoufoxBrowserOptions(options, executablePath));
      const context = await browser.newContext(camoufoxContextOptions(options));
      return closeBrowserWithContext(context, browser);
    },
    async launchPersistent(options) {
      const firefox = await loadFirefox();
      return firefox.launchPersistentContext(
        String(options.userDataDir),
        {
          ...camoufoxBrowserOptions(options, executablePath),
          ...camoufoxContextOptions(options),
        },
      );
    },
  };
}

export function buildLaunchOptions(
  settings: WorkflowSettings,
  appPaths: AppPaths,
): BrowserLaunchOptions {
  const browser = settings.browser_launch;
  const persona = browser.persona;
  const proxy = buildProxyLaunchOptions(browser);
  const webrtcPolicy = browser.webrtc_policy === "default" && persona
    ? persona.webrtc_mode
    : browser.webrtc_policy;
  const fontBundlePath = browser.fingerprint_fonts_dir?.trim() || persona?.font_bundle.path?.trim();
  const fingerprintSeed = resolveFingerprintSeed(browser);
  const args = [
    fingerprintSeed ? `--fingerprint=${fingerprintSeed}` : null,
    "--fingerprint-noise=false",
    "--fingerprint-storage-quota=500",
    `--fingerprint-platform=${resolveFingerprintPlatform()}`,
    fontBundlePath
      ? `--fingerprint-fonts-dir=${fontBundlePath}`
      : null,
    webrtcPolicy === "auto_proxy_exit_ip"
      ? "--fingerprint-webrtc-ip=auto"
      : webrtcPolicy === "explicit_ip" && browser.webrtc_ip?.trim()
        ? `--fingerprint-webrtc-ip=${browser.webrtc_ip.trim()}`
        : null,
  ].filter((arg): arg is string => Boolean(arg));
  const humanPreset = browser.human_preset === "default" && persona
    ? persona.behavioral_timing_profile
    : browser.human_preset;
  return omitUndefinedLaunchOptions({
    headless: browser.headless,
    humanize: browser.humanize !== false,
    humanPreset: humanPreset === "careful" ? "careful" : "default",
    timezone: resolveLaunchTimezone(browser),
    locale: resolveLaunchLocale(browser),
    geoip: Boolean(browser.geoip),
    args,
    proxy,
    contextOptions: {
      acceptDownloads: true,
      downloadsPath: appPaths.downloadsDir,
    },
  });
}

function omitUndefinedLaunchOptions(options: BrowserLaunchOptions): BrowserLaunchOptions {
  return Object.fromEntries(
    Object.entries(options).filter(([, value]) => value !== undefined),
  );
}

/**
 * Resolve a stable fingerprint seed for the launch.
 *
 * A persistent profile keeps a logged-in identity across runs, so the browser
 * device fingerprint must stay stable. If no seed is configured (workflow
 * imported/edited, recording/retained-session path, or the field was cleared),
 * cloakbrowser injects a RANDOM seed on every launch. TikTok's risk engine then
 * sees the account "device hopping" between sessions — which suppresses
 * engagement actions (like/follow) while still allowing passive browsing.
 *
 * When no seed is set we derive a deterministic one from the profile so the
 * device identity is consistent across sessions. Temporary sessions keep a
 * randomizing seed (cloakbrowser's default) since nothing is persisted anyway.
 */
function resolveFingerprintSeed(browser: WorkflowSettings["browser_launch"]): string {
  const configured = browser.fingerprint_seed?.trim();
  if (configured) return configured;
  if (browser.session_mode !== "persistent_profile") return "";
  const basis = browser.profile_dir?.trim() || browser.identity_id?.trim() || "";
  return basis ? deterministicFingerprintSeed(basis) : "";
}

function deterministicFingerprintSeed(value: string): string {
  let hash = 0;
  for (const char of value) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return String(10000 + hash).padStart(5, "0");
}

/**
 * Pick the spoofed platform to match the host. CloakBrowser ships platform-
 * specific patches; forcing Windows on a macOS host overrides the native `macos`
 * patch and produces a navigator(Windows)/WebGL(macOS) mismatch that anti-bot
 * systems correlate. Linux/Windows builds spoof as Windows (cloakbrowser's own
 * default), macOS uses its native patch.
 */
function resolveFingerprintPlatform(): string {
  return process.platform === "darwin" ? "macos" : "windows";
}

export function retainedProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return (
    settings.browser_launch.profile_dir?.trim() ||
    settings.browser_launch.profile_name?.trim() ||
    null
  );
}

export async function browserIdentityEvidence(settings: WorkflowSettings, runId: string) {
  const browser = settings.browser_launch;
  const persona = browser.persona;
  const timezone = resolveLaunchTimezone(browser) ?? null;
  const locale = resolveLaunchLocale(browser) ?? null;
  const fontBundlePath = browser.fingerprint_fonts_dir ?? persona?.font_bundle.path ?? null;
  return {
    run_id: runId,
    identity_id: browser.identity_id,
    display_name: browser.display_name,
    profile_dir:
      browser.session_mode === "persistent_profile"
        ? browser.profile_dir
        : "temporary",
    session_mode: browser.session_mode,
    fingerprint_seed_hash: createHash("sha256")
      .update(browser.fingerprint_seed)
      .digest("hex")
      .slice(0, 16),
    fingerprint_fonts_hash: await fingerprintFontsHash(fontBundlePath),
    persona: browserPersonaEvidence(persona),
    timezone,
    timezone_source: browser.timezone ? "explicit" : browser.geoip ? "geoip" : "local",
    locale,
    locale_source: browser.locale ? "explicit" : browser.geoip ? "geoip" : "local",
    geoip: browser.geoip,
    webrtc_policy: browser.webrtc_policy,
    webrtc_ip: browser.webrtc_policy === "explicit_ip" ? browser.webrtc_ip ?? null : null,
    advanced_overrides: activeAdvancedFingerprintOverrides(browser),
    humanize: browser.humanize !== false,
    human_preset: browser.human_preset === "careful" ? "careful" : "default",
    browser_engine: selectedBrowserEngine(),
    cloakbrowser: await cloakBrowserRuntimeEvidence(),
    camoufox: await camoufoxRuntimeEvidence(),
  };
}

function resolveLaunchTimezone(browser: WorkflowSettings["browser_launch"]) {
  const explicit = browser.timezone?.trim();
  if (explicit) return explicit;
  if (browser.geoip) return undefined;
  return localBrowserTimezone();
}

function resolveLaunchLocale(browser: WorkflowSettings["browser_launch"]) {
  const explicit = browser.locale?.trim();
  if (explicit) return explicit;
  if (browser.geoip) return undefined;
  return localBrowserLocale();
}

function browserPersonaEvidence(persona: WorkflowPersona | null | undefined) {
  if (!persona) return null;
  return {
    id: persona.id,
    label: persona.label,
    rationale: persona.rationale,
    os_bucket: persona.os_bucket,
    browser_channel_bucket: persona.browser_channel_bucket,
    viewport: persona.viewport,
    window: persona.window,
    timezone: persona.timezone,
    locale: persona.locale,
    proxy_geo_policy: persona.proxy_geo_policy,
    proxy_region: persona.proxy_region ?? null,
    webrtc_mode: persona.webrtc_mode,
    font_bundle: {
      label: persona.font_bundle.label,
      expected_families: persona.font_bundle.expected_families,
      path_configured: Boolean(persona.font_bundle.path),
    },
    behavioral_timing_profile: persona.behavioral_timing_profile,
  };
}

function buildProxyLaunchOptions(browser: WorkflowSettings["browser_launch"]) {
  if (!browser.proxy_enabled || !browser.proxy_server) return undefined;
  const proxy = {
    server: browser.proxy_server,
    bypass: browser.proxy_bypass ?? undefined,
    username: browser.proxy_username ?? undefined,
    password: browser.proxy_password ?? undefined,
  };
  try {
    const url = new URL(browser.proxy_server);
    const username = url.username ? decodeURIComponent(url.username) : undefined;
    const password = url.password ? decodeURIComponent(url.password) : undefined;
    if (username || password) {
      url.username = "";
      url.password = "";
      proxy.server = url.toString();
      proxy.username = proxy.username ?? username;
      proxy.password = proxy.password ?? password;
    }
  } catch {
    return proxy;
  }
  return proxy;
}

function retainedSessionKey(workflowId: string | null, profileName: string | null) {
  return `${workflowId ?? ""}\u0000${profileName ?? ""}`;
}

function assertHeadedDisplayAvailable(settings: WorkflowSettings) {
  if (settings.browser_launch.headless) return;
  if (process.platform !== "linux") return;
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) return;
  throw new Error(
    "Headed CloakBrowser runs require DISPLAY or WAYLAND_DISPLAY on Linux. Enable headless mode or run under Xvfb/Wayland before launching a headed identity.",
  );
}

async function loadCloakBrowserModule(): Promise<CloakBrowserModule> {
  return (await import("cloakbrowser")) as unknown as CloakBrowserModule;
}

function selectedBrowserEngine() {
  return process.env.AUTOMATION_BROWSER_ENGINE?.toLowerCase() === "camoufox"
    ? "camoufox"
    : "cloakbrowser";
}

function camoufoxExecutablePath() {
  return (
    process.env.CAMOUFOX_EXECUTABLE_PATH?.trim() ||
    path.join(os.homedir(), ".cache", "camoufox", "camoufox")
  );
}

function camoufoxBrowserOptions(options: BrowserLaunchOptions, executablePath: string) {
  return omitUndefinedLaunchOptions({
    executablePath,
    headless: typeof options.headless === "boolean" ? options.headless : undefined,
    proxy: options.proxy,
  });
}

function camoufoxContextOptions(options: BrowserLaunchOptions) {
  const contextOptions = isPlainRecord(options.contextOptions)
    ? options.contextOptions
    : {};
  return omitUndefinedLaunchOptions({
    ...contextOptions,
    timezoneId: typeof options.timezone === "string" ? options.timezone : undefined,
    locale: typeof options.locale === "string" ? options.locale : undefined,
  });
}

function closeBrowserWithContext(
  context: BrowserDriverContext,
  browser: { close(): Promise<void> },
) {
  let closed = false;
  return new Proxy(context, {
    get(target, property, receiver) {
      if (property === "close") {
        return async () => {
          if (closed) return;
          closed = true;
          try {
            await target.close();
          } finally {
            await browser.close();
          }
        };
      }
      const value = Reflect.get(target, property, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as BrowserDriverContext;
}

function activeAdvancedFingerprintOverrides(browser: WorkflowSettings["browser_launch"]) {
  return [
    browser.fingerprint_fonts_dir ? "fingerprint_fonts_dir" : null,
  ].filter((field): field is string => Boolean(field));
}

async function cloakBrowserRuntimeEvidence() {
  const [wrapperVersion, binary] = await Promise.all([
    cloakBrowserWrapperVersion(),
    cloakBrowserBinaryEvidence(),
  ]);
  return {
    wrapper_version: wrapperVersion,
    binary_version: binary.version,
    binary_platform: binary.platform,
    binary_installed: binary.installed,
  };
}

async function cloakBrowserBinaryEvidence() {
  try {
    const moduleValue = await loadCloakBrowserModule();
    const info = moduleValue.binaryInfo?.();
    return {
      version: info?.version ?? null,
      platform: info?.platform ?? null,
      installed: Boolean(info?.installed),
    };
  } catch {
    return {
      version: null,
      platform: process.platform,
      installed: false,
    };
  }
}

async function cloakBrowserWrapperVersion() {
  let currentDir = process.cwd();
  while (true) {
    try {
      const packageJson = await fs.readFile(
        path.join(currentDir, "node_modules", "cloakbrowser", "package.json"),
        "utf8",
      );
      const parsed = JSON.parse(packageJson) as { version?: unknown };
      return typeof parsed.version === "string" ? parsed.version : null;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) return null;
      currentDir = parentDir;
    }
  }
}

async function camoufoxRuntimeEvidence() {
  const executablePath = camoufoxExecutablePath();
  let installed = false;
  try {
    await fs.access(executablePath);
    installed = true;
  } catch {
    installed = false;
  }
  return {
    executable_path_configured: Boolean(process.env.CAMOUFOX_EXECUTABLE_PATH?.trim()),
    executable_path: executablePath,
    installed,
    version: await camoufoxVersionEvidence(),
  };
}

async function camoufoxVersionEvidence() {
  try {
    const versionJson = await fs.readFile(
      path.join(path.dirname(camoufoxExecutablePath()), "version.json"),
      "utf8",
    );
    const parsed = JSON.parse(versionJson) as { version?: unknown; release?: unknown };
    return {
      version: typeof parsed.version === "string" ? parsed.version : null,
      release: typeof parsed.release === "string" ? parsed.release : null,
    };
  } catch {
    return {
      version: null,
      release: null,
    };
  }
}
