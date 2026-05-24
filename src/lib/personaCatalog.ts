import type { WorkflowPersona } from "../types/workflow.js";

export const personaCatalog = [
  {
    id: "desktop_us_east_careful",
    label: "US East desktop careful",
    rationale:
      "Owned US East account using a headed desktop window, regional locale, proxy-matched WebRTC, and deliberate input timing.",
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
      path: null,
      expected_families: ["Arial", "Calibri", "Segoe UI"],
    },
    account_label: "Owned US East desktop account",
    test_account_binding: null,
    behavioral_timing_profile: "careful",
  },
  {
    id: "desktop_us_west_standard",
    label: "US West desktop standard",
    rationale:
      "Owned US West account using a common macOS desktop viewport, regional locale, and proxy-aligned WebRTC behavior.",
    os_bucket: "macos_desktop",
    browser_channel_bucket: "chromium_stable",
    viewport: { width: 1440, height: 900 },
    window: { width: 1512, height: 982 },
    timezone: "America/Los_Angeles",
    locale: "en-US",
    proxy_geo_policy: "match_proxy_region",
    proxy_region: "us-west",
    webrtc_mode: "default",
    font_bundle: {
      label: "macOS core fonts",
      path: null,
      expected_families: ["Arial", "Helvetica", "SF Pro"],
    },
    account_label: "Owned US West desktop account",
    test_account_binding: null,
    behavioral_timing_profile: "default",
  },
  {
    id: "desktop_eu_west_standard",
    label: "EU West desktop standard",
    rationale:
      "Owned EU West account using a common Windows desktop viewport with timezone, locale, and network region aligned.",
    os_bucket: "windows_desktop",
    browser_channel_bucket: "chromium_extended_stable",
    viewport: { width: 1536, height: 864 },
    window: { width: 1600, height: 900 },
    timezone: "Europe/Dublin",
    locale: "en-IE",
    proxy_geo_policy: "match_proxy_region",
    proxy_region: "eu-west",
    webrtc_mode: "default",
    font_bundle: {
      label: "Windows EU desktop fonts",
      path: null,
      expected_families: ["Arial", "Calibri", "Segoe UI"],
    },
    account_label: "Owned EU West desktop account",
    test_account_binding: null,
    behavioral_timing_profile: "default",
  },
  {
    id: "desktop_apac_vn_standard",
    label: "APAC Vietnam desktop standard",
    rationale:
      "Owned APAC account using Vietnam timezone, Vietnamese locale, and a conservative desktop Linux window bucket for lab validation.",
    os_bucket: "linux_desktop",
    browser_channel_bucket: "chromium_stable",
    viewport: { width: 1600, height: 900 },
    window: { width: 1680, height: 1050 },
    timezone: "Asia/Ho_Chi_Minh",
    locale: "vi-VN",
    proxy_geo_policy: "match_proxy_region",
    proxy_region: "apac-vn",
    webrtc_mode: "default",
    font_bundle: {
      label: "Linux desktop core fonts",
      path: null,
      expected_families: ["Arial", "Noto Sans", "DejaVu Sans"],
    },
    account_label: "Owned APAC desktop account",
    test_account_binding: null,
    behavioral_timing_profile: "default",
  },
] as const satisfies readonly WorkflowPersona[];

export const defaultPersonaId = personaCatalog[0].id;

export function personaForId(personaId: string | null | undefined): WorkflowPersona | null {
  const normalized = personaId?.trim();
  if (!normalized) return null;
  return clonePersona(personaCatalog.find((persona) => persona.id === normalized) ?? null);
}

export function personaForSeed(seed: string | null | undefined): WorkflowPersona {
  const normalizedSeed = seed?.trim() || defaultPersonaId;
  const index = stableCatalogIndex(normalizedSeed);
  return clonePersona(personaCatalog[index]) ?? clonePersona(personaCatalog[0])!;
}

export function isKnownPersonaId(personaId: string | null | undefined) {
  return Boolean(personaForId(personaId));
}

function stableCatalogIndex(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return hash % personaCatalog.length;
}

function clonePersona(persona: WorkflowPersona | null): WorkflowPersona | null {
  return persona ? structuredClone(persona) : null;
}
