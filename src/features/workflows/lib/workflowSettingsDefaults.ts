import type { WorkflowSettings } from "../../../types/workflow";
import { personaForSeed } from "../../../lib/personaCatalog";

export function createDefaultBrowserProfileName(seed = randomProfileSeed()) {
  const safeSeed = seed
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `profile-${safeSeed || randomProfileSeed()}`;
}

function randomProfileSeed() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().slice(0, 8);
  }
  return `local-${Date.now().toString(36)}`;
}

export function defaultWorkflowSettings(options: {
  workflowId?: string;
  workflowName?: string;
  id?: string;
  name?: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}): WorkflowSettings {
  const workflowId = options.workflowId ?? options.id ?? "";
  const workflowName = options.workflowName ?? options.name ?? "";
  const createdAt = options.createdAt ?? null;
  const updatedAt = options.updatedAt ?? null;
  const identityId = createDefaultBrowserIdentityId(workflowId);
  const persona = personaForSeed(identityId);
  return {
    workflow_id: workflowId,
    version: 2,
    general: {
      name: workflowName,
      description: "",
      tags: [],
      notes: "",
      created_at: createdAt,
      updated_at: updatedAt,
    },
    run_policy: {
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      execute_js_enabled: true,
      run_from_selected_enabled: false,
      run_from_selected_mode: "from_selected",
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: {
      session_mode: "persistent_profile",
      identity_id: identityId,
      display_name: `${workflowName} identity`,
      persona_id: persona.id,
      persona,
      profile_dir: identityId,
      fingerprint_seed: stableFingerprintSeed(identityId),
      profile_name: identityId,
      fingerprint_fonts_dir: persona.font_bundle.path ?? null,
      timezone: null,
      locale: null,
      geoip: true,
      proxy_bypass: null,
      webrtc_policy: persona.webrtc_mode,
      webrtc_ip: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      headless: false,
      humanize: true,
      human_preset: persona.behavioral_timing_profile,
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

function createDefaultBrowserIdentityId(seed: string) {
  const safeSeed = seed
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `bi_${safeSeed || "default"}`;
}

function stableFingerprintSeed(seed: string) {
  let hash = 0;
  for (const char of seed) {
    hash = (hash * 31 + char.charCodeAt(0)) % 90000;
  }
  return String(10000 + hash).padStart(5, "0");
}

export function tagsFromInput(value: string) {
  const seen = new Set<string>();
  return value
    .split(",")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => {
      if (!tag || seen.has(tag)) return false;
      seen.add(tag);
      return true;
    });
}

export function tagsToInput(tags: string[]) {
  return tags.join(", ");
}
