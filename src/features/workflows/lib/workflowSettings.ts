import type {
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../../../types/workflow";

export type WorkflowSettingsSection = {
  id: WorkflowSettingsSectionId;
  label: string;
};

export type WorkflowSettingsHelpContent = {
  title: string;
  summary: string;
  bestFor: string[];
  notFor?: string[];
  precedence?: string[];
  fieldGuide: Array<{
    name: string;
    description: string;
    whenToUse?: string;
    overrideBehavior?: string;
  }>;
  workflowExamples: Array<{
    title: string;
    steps: string[];
    notes?: string[];
  }>;
  relatedGraphActions?: Array<{
    action: string;
    relationship: "default" | "runtime_override" | "compatibility";
    explanation: string;
  }>;
  safetyNotes?: string[];
  commonMistakes: Array<{
    mistake: string;
    fix: string;
  }>;
};

export const workflowSettingsSections: WorkflowSettingsSection[] = [
  { id: "general", label: "General" },
  { id: "execution", label: "Execution" },
  { id: "browser", label: "Browser" },
  { id: "environment", label: "Environment" },
  { id: "inputs", label: "Inputs & Variables" },
  { id: "triggers", label: "Triggers" },
  { id: "advanced", label: "Advanced" },
];

export function defaultWorkflowSettings({
  workflowId,
  workflowName,
  createdAt = null,
  updatedAt = null,
}: {
  workflowId: string;
  workflowName: string;
  createdAt?: string | null;
  updatedAt?: string | null;
}): WorkflowSettings {
  return {
    workflow_id: workflowId,
    version: 1,
    general: {
      name: workflowName,
      description: "",
      tags: [],
      notes: "",
      created_at: createdAt,
      updated_at: updatedAt,
    },
    execution: {
      default_action_timeout_ms: null,
      default_retry_attempts: null,
      default_retry_interval_ms: null,
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      failure_policy: "stop_on_first_failure",
      batch_concurrency_limit: null,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
      output_retention_days: null,
    },
    browser: {
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      user_agent: null,
      viewport_width: null,
      viewport_height: null,
      mobile: false,
      touch: false,
      challenge_policy: "none",
      headless: false,
    },
    environment: {
      geolocation: null,
      permissions: [],
      extra_http_headers: [],
      locale: null,
      timezone: null,
      download_directory: null,
      cookies: [],
      local_storage: [],
      session_storage: [],
      session_restore_ref: null,
    },
    inputs: {
      input_schema: [],
      initial_variables: [],
      batch_mapping: [],
    },
    triggers: {
      enabled: false,
      mode: "manual",
      interval_seconds: null,
      once_at: null,
      input_source: null,
      batch_source_ref: null,
      missed_run_policy: "skip",
      concurrency_policy: "skip_if_running",
      last_run_at: null,
      next_run_at: null,
    },
    advanced: {
      compatibility_warnings: [],
      debug_logging_level: "off",
      experimental_flags: [],
    },
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

export function workflowBrowserConfigFromSettings(settings: WorkflowSettings) {
  return {
    workflow_id: settings.workflow_id,
    profile_name: settings.browser.profile_name,
    proxy_enabled: settings.browser.proxy_enabled,
    proxy_server: settings.browser.proxy_server,
    proxy_username: settings.browser.proxy_username,
    proxy_password: settings.browser.proxy_password,
    user_agent: settings.browser.user_agent,
    viewport_width: settings.browser.viewport_width,
    viewport_height: settings.browser.viewport_height,
    mobile: settings.browser.mobile,
    touch: settings.browser.touch,
    challenge_policy: settings.browser.challenge_policy,
  };
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

export const workflowSettingsHelp: Record<
  WorkflowSettingsSectionId,
  WorkflowSettingsHelpContent
> = {
  general: {
    title: "General Settings Help",
    summary:
      "General settings identify the workflow in lists, headers, search, exports, duplicates, and future shared workspaces.",
    bestFor: ["Naming the workflow", "Adding search tags", "Keeping operator notes"],
    notFor: ["Changing browser launch behavior", "Changing graph execution order"],
    precedence: ["Metadata travels with the workflow and does not affect runner output."],
    fieldGuide: [
      {
        name: "Workflow name",
        description: "Required display name used by the list, header, export, and duplicate flows.",
      },
      {
        name: "Description, tags, and notes",
        description:
          "Optional metadata that helps users find and understand the workflow without editing graph logic.",
      },
    ],
    workflowExamples: [
      {
        title: "QA login workflow",
        steps: ["Name it after the business flow", "Add tags such as qa and login"],
      },
    ],
    commonMistakes: [
      {
        mistake: "Using notes to describe required runtime inputs.",
        fix: "Define those values under Inputs & Variables so runs can validate them.",
      },
    ],
  },
  execution: {
    title: "Execution Settings Help",
    summary:
      "Execution settings define default run policy when actions, batch requests, or terminal nodes do not provide a more specific value.",
    bestFor: ["Default action timeouts", "Batch run defaults", "Browser retention policy"],
    notFor: ["Per-step selector waits", "App editor preferences"],
    precedence: [
      "Workflow Settings apply before per-run overrides.",
      "Action-level timeout and retry fields override these defaults for that action.",
    ],
    fieldGuide: [
      {
        name: "Timeouts and retries",
        description:
          "Use these as baseline limits for workflows where most actions share the same tolerance.",
      },
      {
        name: "Browser retention",
        description:
          "Retain keeps the browser available after terminal outcomes; close ends the session by default.",
      },
    ],
    workflowExamples: [
      {
        title: "Slow staging site",
        steps: ["Set a higher default action timeout", "Use action overrides for one known slow step"],
      },
    ],
    commonMistakes: [
      {
        mistake: "Using workflow max duration instead of action timeouts.",
        fix: "Use max duration for the whole run, and action timeouts for individual waits.",
      },
    ],
  },
  browser: {
    title: "Browser Settings Help",
    summary:
      "Browser settings are launch-level defaults for Chromium, including profile, proxy, user agent, viewport, touch, and challenge checkpoint handling.",
    bestFor: ["Repeatable browser profiles", "Authorized proxy routing", "Device defaults"],
    notFor: ["Bypassing challenges", "Changing proxy or profile halfway through a run"],
    precedence: [
      "Browser settings are resolved before Chromium launches.",
      "Graph viewport and user-agent actions may override context later when supported.",
    ],
    fieldGuide: [
      {
        name: "Profile and proxy",
        description:
          "Launch-level settings that require a new run to change reliably.",
        overrideBehavior: "Legacy Use Profile and Use Proxy nodes are compatibility hints only.",
      },
      {
        name: "Challenge policy",
        description:
          "Controls authorized human checkpoint handling. It does not bypass site protections.",
      },
    ],
    workflowExamples: [
      {
        title: "Mobile viewport run",
        steps: ["Set viewport dimensions", "Enable mobile", "Enable touch when testing touch-only UI"],
      },
    ],
    relatedGraphActions: [
      {
        action: "Set Viewport",
        relationship: "runtime_override",
        explanation: "Changes viewport later in the workflow after the browser has launched.",
      },
      {
        action: "Use Proxy",
        relationship: "compatibility",
        explanation: "Kept for saved graphs; prefer Browser settings for new work.",
      },
    ],
    safetyNotes: [
      "Proxy and challenge controls are for authorized testing and repeatable environments.",
    ],
    commonMistakes: [
      {
        mistake: "Expecting proxy changes to apply after the run starts.",
        fix: "Save Browser settings and start a new run.",
      },
    ],
  },
  environment: {
    title: "Environment Settings Help",
    summary:
      "Environment settings apply browser-context defaults after launch and before the first graph step.",
    bestFor: ["Geolocation defaults", "Permissions", "Headers", "Storage and cookies"],
    notFor: ["Launch profile or proxy", "App-level editor preferences"],
    precedence: [
      "Environment defaults apply before graph execution.",
      "Graph environment actions may override them later by execution order.",
    ],
    fieldGuide: [
      {
        name: "Locale, timezone, geolocation",
        description: "Use for workflows whose target pages change behavior by location or locale.",
      },
      {
        name: "Storage and cookies",
        description: "Seed known browser context values before the graph starts.",
      },
    ],
    workflowExamples: [
      {
        title: "Regional smoke run",
        steps: ["Set locale", "Set timezone", "Grant required permissions"],
      },
    ],
    relatedGraphActions: [
      {
        action: "Set Geolocation",
        relationship: "runtime_override",
        explanation: "Can change location defaults later in a run.",
      },
    ],
    commonMistakes: [
      {
        mistake: "Adding setup nodes for values that never change.",
        fix: "Move stable defaults into Environment settings.",
      },
    ],
  },
  inputs: {
    title: "Inputs & Variables Settings Help",
    summary:
      "Inputs & Variables define the initial data contract for manual, batch, triggered, and future API-driven runs.",
    bestFor: ["Required run inputs", "Initial variables", "Batch column mapping"],
    notFor: ["Mutating values during graph execution"],
    precedence: [
      "Saved defaults load first.",
      "Manual, batch, or trigger values override defaults for that run.",
      "Graph Set Variables writes override by execution order.",
    ],
    fieldGuide: [
      {
        name: "Input schema",
        description: "Declares expected names, types, defaults, required flags, and descriptions.",
      },
      {
        name: "Initial variables",
        description: "Seed the variable store before the first executable graph step.",
      },
    ],
    workflowExamples: [
      {
        title: "Batch login rows",
        steps: ["Define email and password inputs", "Map CSV columns to those inputs"],
      },
    ],
    commonMistakes: [
      {
        mistake: "Writing required inputs only in notes.",
        fix: "Add input schema rows so validation can block incomplete runs.",
      },
    ],
  },
  triggers: {
    title: "Triggers Settings Help",
    summary:
      "Triggers persist orchestration intent for manual-only, one-time, interval, and future calendar or event runs.",
    bestFor: ["Saved schedules", "Missed-run policy", "Trigger input sources"],
    notFor: ["Running unsaved graph drafts", "Replacing manual runs"],
    precedence: [
      "Triggered runs use the saved graph and saved Workflow Settings at dispatch time.",
    ],
    fieldGuide: [
      {
        name: "Mode",
        description: "Manual keeps automatic dispatch disabled; once and interval add schedule validation.",
      },
      {
        name: "Concurrency policy",
        description: "Controls what a trigger should do when the workflow is already running.",
      },
    ],
    workflowExamples: [
      {
        title: "Hourly availability check",
        steps: ["Enable triggers", "Choose interval", "Set interval seconds"],
      },
    ],
    commonMistakes: [
      {
        mistake: "Expecting triggers to run unsaved graph edits.",
        fix: "Save the graph before relying on trigger dispatch.",
      },
    ],
  },
  advanced: {
    title: "Advanced Settings Help",
    summary:
      "Advanced settings collect compatibility warnings, diagnostics, rare debug controls, and future migration helpers.",
    bestFor: ["Compatibility warnings", "Debug logging", "Settings JSON troubleshooting"],
    notFor: ["Normal workflow behavior", "Everyday browser or input configuration"],
    precedence: ["Advanced warnings explain conflicts but do not replace section ownership."],
    fieldGuide: [
      {
        name: "Compatibility warnings",
        description:
          "Highlights legacy setup nodes that overlap with modern Workflow Settings sections.",
      },
      {
        name: "Debug logging",
        description:
          "Controls future diagnostics and must redact secret values in logs and exports.",
      },
    ],
    workflowExamples: [
      {
        title: "Legacy setup cleanup",
        steps: ["Review warnings", "Move stable launch values into Browser settings"],
      },
    ],
    commonMistakes: [
      {
        mistake: "Treating Advanced as the default settings page.",
        fix: "Use the owning section for normal configuration.",
      },
    ],
  },
};
