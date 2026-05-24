import { createHash, randomUUID } from "node:crypto";
import type {
  GraphEdgeDelay,
  SettingsValidationIssue,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowPersona,
  WorkflowSettings,
  WorkflowSettingsBrowserLaunch,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import { personaForId, personaForSeed } from "../../../src/lib/personaCatalog.js";

type WorkflowSettingsServiceDependencies = {
  directoryReadable: (value: string) => boolean;
  isOptionalModuleAvailable: (name: string) => boolean;
};

export class WorkflowSettingsService {
  constructor(private readonly dependencies: WorkflowSettingsServiceDependencies) {}

  defaultWorkflowSettings = defaultWorkflowSettings;

  deriveFingerprintSeedFromIdentityId = deriveFingerprintSeedFromIdentityId;

  createHighEntropyBrowserIdentityId = createHighEntropyBrowserIdentityId;

  normalizeWorkflowSettings(settings: WorkflowSettings, workflow: WorkflowSummary): WorkflowSettings {
    const base = defaultWorkflowSettings(workflow);
    return {
      workflow_id: settings.workflow_id || workflow.id,
      version: 2,
      general: {
        ...base.general,
        ...objectRecord(settings.general),
        name: String(settings.general?.name ?? workflow.name),
        tags: Array.isArray(settings.general?.tags) ? settings.general.tags : [],
      },
      run_policy: {
        ...base.run_policy,
        ...objectRecord(settings.run_policy),
        browser_retention: settings.run_policy?.browser_retention === "close" ? "close" : "retain",
        execute_js_enabled: settings.run_policy?.execute_js_enabled !== false,
        batch_headless: Boolean(settings.run_policy?.batch_headless),
        batch_stop_on_first_failed_row: Boolean(settings.run_policy?.batch_stop_on_first_failed_row),
      },
      browser_launch: normalizeSettingsBrowserLaunch(
        {
          ...base.browser_launch,
          ...objectRecord(settings.browser_launch),
        },
        objectRecord(settings.browser_launch),
      ),
      graph_defaults: {
        default_edge_delay: normalizeGraphEdgeDelay(
          objectRecord(settings.graph_defaults).default_edge_delay,
        ),
      },
      environment: {
        initial_variables: Array.isArray(settings.environment?.initial_variables)
          ? settings.environment.initial_variables
          : [],
      },
      migration_notes: Array.isArray(settings.migration_notes) ? settings.migration_notes : [],
      created_at: settings.created_at ?? base.created_at,
      updated_at: settings.updated_at ?? base.updated_at,
    };
  }

  validateSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
    const issues: SettingsValidationIssue[] = [];
    if (!settings.general.name.trim()) {
      issues.push({
        section: "general",
        field: "name",
        level: "error",
        message: "Workflow name is required",
      });
    }
    if (settings.browser_launch.proxy_enabled && !settings.browser_launch.proxy_server?.trim()) {
      issues.push({
        section: "browser_launch",
        field: "proxy_server",
        level: "error",
        message: "Proxy server is required when proxy is enabled",
      });
    }
    if (settings.browser_launch.proxy_enabled && settings.browser_launch.proxy_server?.trim()) {
      const parsedProxy = parseProxyServer(settings.browser_launch.proxy_server);
      if (!parsedProxy.valid) {
        issues.push({
          section: "browser_launch",
          field: "proxy_server",
          level: "error",
          message: parsedProxy.message,
        });
      } else if (
        parsedProxy.hasCredentials &&
        (settings.browser_launch.proxy_username?.trim() || settings.browser_launch.proxy_password?.trim())
      ) {
        issues.push({
          section: "browser_launch",
          field: "proxy_username",
          level: "error",
          message: "Proxy credentials must be configured either in the proxy URL or the username/password fields, not both",
        });
      }
      if (
        parsedProxy.valid &&
        !settings.browser_launch.geoip &&
        (!settings.browser_launch.timezone?.trim() || !settings.browser_launch.locale?.trim())
      ) {
        issues.push({
          section: "browser_launch",
          field: "timezone",
          level: "warning",
          message: "Proxy identities should define explicit timezone and locale or enable GeoIP so browser signals match the proxy region",
        });
      }
    }
    if (
      settings.browser_launch.session_mode === "persistent_profile" &&
      !settings.browser_launch.fingerprint_seed?.trim()
    ) {
      issues.push({
        section: "browser_launch",
        field: "fingerprint_seed",
        level: "error",
        message: "Persistent browser identities require a fingerprint seed",
      });
    }
    if (settings.browser_launch.geoip && !this.dependencies.isOptionalModuleAvailable("mmdb-lib")) {
      issues.push({
        section: "browser_launch",
        field: "geoip",
        level: "error",
        message: "GeoIP requires mmdb-lib to be installed",
      });
    }
    if (settings.browser_launch.webrtc_policy === "disabled_if_supported") {
      issues.push({
        section: "browser_launch",
        field: "webrtc_policy",
        level: "error",
        message: "Disabled WebRTC policy is not supported by the installed CloakBrowser runtime",
      });
    }
    if (settings.browser_launch.webrtc_policy === "explicit_ip" && !settings.browser_launch.webrtc_ip?.trim()) {
      issues.push({
        section: "browser_launch",
        field: "webrtc_ip",
        level: "error",
        message: "Explicit WebRTC IP policy requires a WebRTC IP",
      });
    }
    if (
      settings.browser_launch.webrtc_policy === "explicit_ip" &&
      settings.browser_launch.webrtc_ip?.trim() &&
      !validIpAddress(settings.browser_launch.webrtc_ip)
    ) {
      issues.push({
        section: "browser_launch",
        field: "webrtc_ip",
        level: "error",
        message: "Explicit WebRTC IP must be a valid IPv4 or IPv6 address",
      });
    }
    if (
      settings.browser_launch.webrtc_policy === "auto_proxy_exit_ip" &&
      (!settings.browser_launch.proxy_enabled || !settings.browser_launch.proxy_server?.trim())
    ) {
      issues.push({
        section: "browser_launch",
        field: "webrtc_policy",
        level: "error",
        message: "Auto WebRTC proxy IP policy requires an enabled proxy",
      });
    }
    if (settings.browser_launch.fingerprint_fonts_dir?.trim()) {
      const fontsDir = settings.browser_launch.fingerprint_fonts_dir.trim();
      if (!this.dependencies.directoryReadable(fontsDir)) {
        issues.push({
          section: "browser_launch",
          field: "fingerprint_fonts_dir",
          level: "error",
          message: "Fingerprint fonts directory must be readable",
        });
      } else {
        issues.push({
          section: "browser_launch",
          field: "fingerprint_fonts_dir",
          level: "warning",
          message: "Using the same fingerprint fonts directory across identities can create a stable font hash; validate it with owned preflight",
        });
      }
    }
    if (settings.browser_launch.preflight_enabled) {
      const probeUrl = settings.browser_launch.preflight_probe_url?.trim();
      if (!probeUrl) {
        issues.push({
          section: "browser_launch",
          field: "preflight_probe_url",
          level: "error",
          message: "Fingerprint preflight probe URL is required",
        });
      } else if (
        !settings.browser_launch.preflight_allowed_origins.includes(originForUrl(probeUrl) ?? "")
      ) {
        issues.push({
          section: "browser_launch",
          field: "preflight_probe_url",
          level: "error",
          message: "Fingerprint preflight probe origin must be allowlisted",
        });
      }
      if (settings.browser_launch.headless) {
        issues.push({
          section: "browser_launch",
          field: "headless",
          level: "error",
          message: "Fingerprint preflight requires headed browser mode",
        });
      }
    }
    for (const field of [
      "max_workflow_duration_ms",
      "batch_concurrency_limit",
    ] as const) {
      const value = settings.run_policy[field];
      if (value != null && value <= 0) {
        issues.push({
          section: "run_policy",
          field,
          level: "error",
          message: "Run policy numeric settings must be greater than zero when set",
        });
      }
    }
    const edgeDelayIssue = validateGraphEdgeDelay(settings.graph_defaults?.default_edge_delay);
    if (edgeDelayIssue) {
      issues.push({
        section: "graph_defaults",
        field: "default_edge_delay",
        level: "error",
        message: edgeDelayIssue,
      });
    }
    return issues;
  }

  configToSettingsBrowserLaunch(
    config: WorkflowBrowserConfig,
    workflow?: Pick<WorkflowSummary, "id" | "name">,
    options: { randomizeIdentity?: boolean } = {},
  ): WorkflowSettingsBrowserLaunch {
    return configToSettingsBrowserLaunch(config, workflow, options);
  }

  settingsBrowserToConfig(
    workflowId: string,
    browser: WorkflowSettingsBrowserLaunch,
  ): WorkflowBrowserConfig {
    return settingsBrowserToConfig(workflowId, browser);
  }

  browserIdentityPreferences(browser: WorkflowSettingsBrowserLaunch) {
    return browserIdentityPreferences(browser);
  }

  duplicateWorkflowSettings(sourceSettings: WorkflowSettings, created: Workflow): WorkflowSettings {
    const copied = structuredClone(sourceSettings);
    const freshDefaults = defaultWorkflowSettings(created, { randomizeIdentity: true });
    const sourceBrowser = copied.browser_launch;
    const freshBrowser = freshDefaults.browser_launch;
    const persistent = sourceBrowser.session_mode === "persistent_profile";

    return {
      ...copied,
      workflow_id: created.id,
      general: {
        ...copied.general,
        name: created.name,
        created_at: created.created_at,
        updated_at: created.updated_at,
      },
      browser_launch: {
        ...sourceBrowser,
        identity_id: freshBrowser.identity_id,
        display_name: freshBrowser.display_name,
        profile_dir: freshBrowser.profile_dir,
        profile_name: persistent ? freshBrowser.profile_dir : null,
        fingerprint_seed: freshBrowser.fingerprint_seed,
        persona_id: sourceBrowser.persona_id,
        persona: sourceBrowser.persona,
        run_from_selected_enabled: false,
      },
      created_at: created.created_at,
      updated_at: created.updated_at,
    };
  }
}

export function defaultWorkflowSettings(
  workflow: Pick<WorkflowSummary, "id" | "name" | "created_at" | "updated_at"> &
    Partial<Pick<WorkflowSummary, "step_count">>,
  options: { randomizeIdentity?: boolean } = {},
): WorkflowSettings {
  const browserLaunch = normalizeSettingsBrowserLaunch({
    ...configToSettingsBrowserLaunch(defaultBrowserConfig(workflow.id), workflow, options),
    session_mode: "persistent_profile",
  });
  return {
    workflow_id: workflow.id,
    version: 2,
    general: {
      name: workflow.name,
      description: "",
      tags: [],
      notes: "",
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      execute_js_enabled: true,
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: browserLaunch,
    graph_defaults: {
      default_edge_delay: null,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };
}

export function createHighEntropyBrowserIdentityId() {
  return `bi_${randomUUID().replace(/-/g, "")}`;
}

export function deriveFingerprintSeedFromIdentityId(
  identityId: string,
  reservedSeeds: Set<string> = new Set(),
) {
  const digest = createHash("sha256").update(identityId).digest();
  const startingValue = digest.readUInt32BE(0) % 90000;
  for (let offset = 0; offset < 90000; offset += 1) {
    const seed = String(10000 + ((startingValue + offset) % 90000)).padStart(5, "0");
    if (!reservedSeeds.has(seed)) return seed;
  }
  throw new Error("No available fingerprint seed");
}

function validateGraphEdgeDelay(delay: GraphEdgeDelay | null | undefined) {
  if (!delay) return null;
  if (delay.type === "fixed") {
    return Number.isFinite(delay.duration_ms) && delay.duration_ms > 0
      ? null
      : "New link wait duration must be greater than zero";
  }
  if (delay.type === "random") {
    return Number.isFinite(delay.min_ms) &&
      Number.isFinite(delay.max_ms) &&
      delay.min_ms > 0 &&
      delay.max_ms > 0 &&
      delay.max_ms >= delay.min_ms
      ? null
      : "New link wait range is invalid";
  }
  return "New link wait type is invalid";
}

function originForUrl(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function parseProxyServer(value: string):
  | { valid: true; hasCredentials: boolean }
  | { valid: false; message: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { valid: false, message: "Proxy server must be a valid URL" };
  }
  if (!["http:", "https:", "socks5:"].includes(url.protocol)) {
    return { valid: false, message: "Proxy server must use http, https, or socks5" };
  }
  if (!url.hostname) {
    return { valid: false, message: "Proxy server must include a hostname" };
  }
  return {
    valid: true,
    hasCredentials: Boolean(url.username || url.password),
  };
}

function validIpAddress(value: string) {
  const candidate = value.trim();
  if (!candidate) return false;
  if (/^(\d{1,3}\.){3}\d{1,3}$/.test(candidate)) {
    return candidate
      .split(".")
      .every((part) => Number(part) >= 0 && Number(part) <= 255);
  }
  return /^[0-9a-f:]+$/i.test(candidate) && candidate.includes(":");
}

function defaultBrowserConfig(workflowId: string): WorkflowBrowserConfig {
  return {
    workflow_id: workflowId,
    profile_name: null,
    proxy_enabled: false,
    proxy_server: null,
    proxy_username: null,
    proxy_password: null,
    headless: false,
  };
}

function configToSettingsBrowserLaunch(
  config: WorkflowBrowserConfig,
  workflow?: Pick<WorkflowSummary, "id" | "name">,
  options: { randomizeIdentity?: boolean } = {},
): WorkflowSettingsBrowserLaunch {
  const identity = createDefaultBrowserIdentity(workflow, options);
  return normalizeSettingsBrowserLaunch({
    session_mode: config.profile_name ? "persistent_profile" : "temporary",
    profile_name: nullableText(config.profile_name),
    ...identity,
    proxy_enabled: config.proxy_enabled,
    proxy_server: nullableText(config.proxy_server),
    proxy_username: nullableText(config.proxy_username),
    proxy_password: nullableText(config.proxy_password),
    headless: config.headless ?? false,
    run_from_selected_enabled: false,
  });
}

function settingsBrowserToConfig(
  workflowId: string,
  browser: WorkflowSettingsBrowserLaunch,
): WorkflowBrowserConfig {
  return {
    workflow_id: workflowId,
    profile_name: browser.profile_name ?? null,
    proxy_enabled: browser.proxy_enabled,
    proxy_server: browser.proxy_server ?? null,
    proxy_username: browser.proxy_username ?? null,
    proxy_password: browser.proxy_password ?? null,
    headless: browser.headless,
  };
}

function normalizeSettingsBrowserLaunch(
  browser: WorkflowSettingsBrowserLaunch,
  explicitBrowserFields: Record<string, unknown> = {},
): WorkflowSettingsBrowserLaunch {
  const profileName = nullableText(browser.profile_name);
  const identityId = nullableText(browser.identity_id) ?? createStableBrowserIdentityId(profileName ?? "workflow");
  const profileDir = nullableText(browser.profile_dir) ?? identityId;
  const fingerprintSeed = nullableText(browser.fingerprint_seed) ?? stableFingerprintSeed(identityId);
  const persona = normalizeBrowserPersona(browser, identityId, explicitBrowserFields);
  const personaDefaultsSelected = selectedPersonaDefaultsWereRequested(
    browser,
    explicitBrowserFields,
    persona,
  );
  const {
    browser_brand: _legacyBrowserBrand,
    viewport_width: _legacyViewportWidth,
    viewport_height: _legacyViewportHeight,
    device_scale_factor: _legacyDeviceScaleFactor,
    mobile: _legacyMobile,
    touch: _legacyTouch,
    user_agent: _legacyUserAgent,
    fingerprint_platform: _legacyFingerprintPlatform,
    hardware_concurrency: _legacyHardwareConcurrency,
    device_memory_gb: _legacyDeviceMemoryGb,
    storage_quota_mb: _legacyStorageQuotaMb,
    proxy_label: _legacyProxyLabel,
    proxy_region: _legacyProxyRegion,
    proxy_provider: _legacyProxyProvider,
    test_account_binding: _legacyTestAccountBinding,
    ...browserWithoutLegacyOverrides
  } = browser as WorkflowSettingsBrowserLaunch & Record<string, unknown>;
  void _legacyBrowserBrand;
  void _legacyViewportWidth;
  void _legacyViewportHeight;
  void _legacyDeviceScaleFactor;
  void _legacyMobile;
  void _legacyTouch;
  void _legacyUserAgent;
  void _legacyFingerprintPlatform;
  void _legacyHardwareConcurrency;
  void _legacyDeviceMemoryGb;
  void _legacyStorageQuotaMb;
  void _legacyProxyLabel;
  void _legacyProxyRegion;
  void _legacyProxyProvider;
  void _legacyTestAccountBinding;
  return {
    ...browserWithoutLegacyOverrides,
    identity_id: identityId,
    display_name: nullableText(browser.display_name) ?? `${profileName ?? "Workflow"} identity`,
    persona_id: persona.id,
    persona,
    profile_dir: profileDir,
    fingerprint_seed: fingerprintSeed,
    fingerprint_fonts_dir:
      personaDefaultsSelected
        ? nullableText(persona.font_bundle.path)
        : nullableText(browser.fingerprint_fonts_dir) ?? nullableText(persona.font_bundle.path),
    timezone: nullableText(browser.timezone),
    locale: nullableText(browser.locale),
    geoip: Boolean(browser.geoip),
    proxy_bypass: nullableText(browser.proxy_bypass),
    webrtc_policy: persona.webrtc_mode,
    webrtc_ip: nullableText(browser.webrtc_ip),
    preflight_enabled: Boolean(browser.preflight_enabled),
    preflight_probe_url: nullableText(browser.preflight_probe_url),
    preflight_allowed_origins: Array.isArray(browser.preflight_allowed_origins)
      ? browser.preflight_allowed_origins.filter((origin) => typeof origin === "string" && origin.trim())
      : [],
    humanize: browser.humanize !== false,
    human_preset: persona.behavioral_timing_profile,
    session_mode: browser.session_mode === "persistent_profile"
      ? "persistent_profile"
      : "temporary",
    profile_name: browser.session_mode === "persistent_profile" ? (profileName ?? profileDir) : null,
    run_from_selected_enabled:
      browser.session_mode === "persistent_profile" && (profileName ?? profileDir)
        ? Boolean(browser.run_from_selected_enabled)
        : false,
    proxy_server: nullableText(browser.proxy_server),
    proxy_username: nullableText(browser.proxy_username),
    proxy_password: nullableText(browser.proxy_password),
  };
}

function selectedPersonaDefaultsWereRequested(
  browser: WorkflowSettingsBrowserLaunch,
  explicitBrowserFields: Record<string, unknown>,
  persona: WorkflowPersona,
) {
  const explicitPersonaId = nullableText(explicitBrowserFields.persona_id as string | null | undefined);
  if (!explicitPersonaId) return false;
  const rawPersonaId = nullableText(objectRecord(browser.persona).id as string | null | undefined);
  return rawPersonaId !== persona.id;
}

function normalizeBrowserPersona(
  browser: WorkflowSettingsBrowserLaunch,
  identityId: string,
  explicitBrowserFields: Record<string, unknown>,
): WorkflowPersona {
  const rawPersona = objectRecord(browser.persona);
  const explicitPersonaId = nullableText(explicitBrowserFields.persona_id as string | null | undefined);
  const rawPersonaId = nullableText(rawPersona.id as string | null | undefined);
  const selectedPersonaId = explicitPersonaId ?? nullableText(browser.persona_id) ?? rawPersonaId;
  const basePersona = personaForId(selectedPersonaId) ?? personaForSeed(identityId);
  const personaSelectionChanged = Boolean(
    explicitPersonaId && rawPersonaId && explicitPersonaId !== rawPersonaId,
  );

  if (personaSelectionChanged) {
    return basePersona;
  }

  return {
    ...basePersona,
    timezone: nullableText(browser.timezone) ?? basePersona.timezone,
    locale: nullableText(browser.locale) ?? basePersona.locale,
    proxy_region: nullableText(basePersona.proxy_region),
    webrtc_mode: validWebRtcPolicy(browser.webrtc_policy)
      ? browser.webrtc_policy
      : basePersona.webrtc_mode,
    font_bundle: {
      ...basePersona.font_bundle,
      path: nullableText(browser.fingerprint_fonts_dir) ?? nullableText(basePersona.font_bundle.path),
    },
    account_label:
      nullableText(rawPersona.account_label as string | null | undefined) ??
      nullableText(basePersona.account_label),
    test_account_binding:
      nullableText(rawPersona.test_account_binding as string | null | undefined) ??
      nullableText(basePersona.test_account_binding),
    behavioral_timing_profile: validHumanPreset(browser.human_preset)
      ? browser.human_preset
      : basePersona.behavioral_timing_profile,
  };
}

function normalizeGraphEdgeDelay(value: unknown): GraphEdgeDelay | null {
  const delay = objectRecord(value);
  if (delay.type === "fixed") {
    const duration = positiveOptionalNumber(delay.duration_ms);
    return duration == null ? null : { type: "fixed", duration_ms: duration };
  }
  if (delay.type === "random") {
    const min = positiveOptionalNumber(delay.min_ms);
    const max = positiveOptionalNumber(delay.max_ms);
    return min == null || max == null || max < min
      ? null
      : { type: "random", min_ms: min, max_ms: max };
  }
  return null;
}

function createDefaultBrowserIdentity(
  workflow?: Pick<WorkflowSummary, "id" | "name">,
  options: { randomizeIdentity?: boolean } = {},
): Pick<
  WorkflowSettingsBrowserLaunch,
  | "identity_id"
  | "display_name"
  | "persona_id"
  | "persona"
  | "profile_dir"
  | "fingerprint_seed"
  | "fingerprint_fonts_dir"
  | "timezone"
  | "locale"
  | "geoip"
  | "proxy_bypass"
  | "webrtc_policy"
  | "webrtc_ip"
  | "preflight_enabled"
  | "preflight_probe_url"
  | "preflight_allowed_origins"
  | "humanize"
  | "human_preset"
> {
  const identityId = options.randomizeIdentity
    ? createHighEntropyBrowserIdentityId()
    : createStableBrowserIdentityId(workflow?.id ?? "workflow");
  const persona = personaForSeed(identityId);
  return {
    identity_id: identityId,
    display_name: `${workflow?.name ?? "Workflow"} identity`,
    persona_id: persona.id,
    persona,
    profile_dir: identityId,
    fingerprint_seed: options.randomizeIdentity
      ? deriveFingerprintSeedFromIdentityId(identityId)
      : stableFingerprintSeed(identityId),
    fingerprint_fonts_dir: nullableText(persona.font_bundle.path),
    timezone: null,
    locale: null,
    geoip: false,
    proxy_bypass: null,
    webrtc_policy: persona.webrtc_mode,
    webrtc_ip: null,
    preflight_enabled: false,
    preflight_probe_url: null,
    preflight_allowed_origins: [],
    humanize: true,
    human_preset: persona.behavioral_timing_profile,
  };
}

function createStableBrowserIdentityId(seed: string) {
  return `bi_${sanitizeIdentityText(seed).slice(0, 40) || "default"}`;
}

function sanitizeIdentityText(value: string) {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function stableFingerprintSeed(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return String(10000 + hash).padStart(5, "0");
}

function browserIdentityPreferences(
  browser: WorkflowSettingsBrowserLaunch,
): Pick<
  WorkflowSettingsBrowserLaunch,
  | "identity_id"
  | "display_name"
  | "persona_id"
  | "persona"
  | "profile_dir"
  | "fingerprint_seed"
  | "fingerprint_fonts_dir"
  | "timezone"
  | "locale"
  | "geoip"
  | "proxy_bypass"
  | "webrtc_policy"
  | "webrtc_ip"
  | "preflight_enabled"
  | "preflight_probe_url"
  | "preflight_allowed_origins"
  | "humanize"
  | "human_preset"
> {
  return {
    identity_id: browser.identity_id,
    display_name: browser.display_name,
    persona_id: browser.persona_id,
    persona: browser.persona,
    profile_dir: browser.profile_dir,
    fingerprint_seed: browser.fingerprint_seed,
    fingerprint_fonts_dir: browser.fingerprint_fonts_dir,
    timezone: browser.timezone,
    locale: browser.locale,
    geoip: browser.geoip,
    proxy_bypass: browser.proxy_bypass,
    webrtc_policy: browser.webrtc_policy,
    webrtc_ip: browser.webrtc_ip,
    preflight_enabled: browser.preflight_enabled,
    preflight_probe_url: browser.preflight_probe_url,
    preflight_allowed_origins: browser.preflight_allowed_origins,
    humanize: browser.humanize,
    human_preset: browser.human_preset,
  };
}

function positiveOptionalNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : null;
}

function validWebRtcPolicy(value: unknown): value is WorkflowSettingsBrowserLaunch["webrtc_policy"] {
  return (
    value === "default" ||
    value === "auto_proxy_exit_ip" ||
    value === "explicit_ip"
  );
}

function validHumanPreset(value: unknown): value is WorkflowSettingsBrowserLaunch["human_preset"] {
  return value === "default" || value === "careful";
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}
