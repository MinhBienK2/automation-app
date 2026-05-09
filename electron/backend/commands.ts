import type { DatabaseSync } from "node:sqlite";
import type {
  ActionConfig,
  BatchRunRequest,
  CompiledWorkflowGraph,
  ElementSnapshot,
  GraphValidationIssue,
  OrchestrationSchedule,
  RecordedEvent,
  RunState,
  RunValidationIssue,
  SelectorCandidate,
  SettingsValidationIssue,
  Workflow,
  WorkflowBrowserConfig,
  WorkflowDetail,
  WorkflowExport,
  WorkflowGraph,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackageImportOptions,
  WorkflowPackagePreview,
  WorkflowPackageSettings,
  WorkflowSettings,
  WorkflowSettingsBrowser,
  WorkflowSettingsEnvironment,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../../src/types/workflow.js";
import type { AppPaths } from "./database.js";
import { WorkflowRepository } from "./workflowRepository.js";

export type CommandError = {
  message: string;
  field?: string | null;
};

export type WorkflowCommandHandlers = ReturnType<typeof createWorkflowCommandHandlers>;

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
  saveWorkflowPackageFile?: (packageValue: WorkflowPackage) => Promise<string | null>;
};

const workflowSettingsSections: WorkflowSettingsSectionId[] = [
  "general",
  "execution",
  "browser",
  "environment",
  "inputs",
  "triggers",
  "advanced",
];

const idleRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  outputs: {},
  error: null,
};

export function createWorkflowCommandHandlers(context: CommandContext) {
  const repository = new WorkflowRepository(context.database);

  function requireWorkflow(workflowId: string): WorkflowSummary {
    const workflow = repository.getWorkflowSummary(workflowId);
    if (!workflow) {
      throw commandError("Workflow not found", "workflowId");
    }
    return workflow;
  }

  function getSettings(workflowId: string): WorkflowSettings {
    const persisted = repository.getWorkflowSettings(workflowId);
    if (persisted) return persisted;
    return defaultWorkflowSettings(requireWorkflow(workflowId));
  }

  function saveSettings(workflowId: string, settings: WorkflowSettings) {
    const issues = validateSettings(settings);
    const firstError = issues.find((issue) => issue.level === "error");
    if (firstError) {
      throw commandError(
        firstError.message,
        firstError.field
          ? `${firstError.section}.${firstError.field}`
          : firstError.section,
      );
    }

    const workflow = requireWorkflow(workflowId);
    const timestamp = new Date().toISOString();
    const normalized: WorkflowSettings = {
      ...settings,
      workflow_id: workflowId,
      version: 1,
      general: {
        ...settings.general,
        name: settings.general.name.trim(),
        updated_at: timestamp,
        created_at: settings.general.created_at ?? workflow.created_at,
      },
      browser: normalizeSettingsBrowser(settings.browser),
      updated_at: timestamp,
      created_at: settings.created_at ?? workflow.created_at,
    };
    repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  function createWorkflow(name: string): Workflow {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    return repository.createWorkflow(normalized, createDraftGraph());
  }

  return {
    listWorkflows() {
      return repository.listWorkflows();
    },

    getWorkflow(id: string): WorkflowDetail | null {
      return repository.getWorkflow(id);
    },

    getWorkflowBrowserConfig(workflowId: string): WorkflowBrowserConfig {
      return settingsBrowserToConfig(workflowId, getSettings(workflowId).browser);
    },

    saveWorkflowBrowserConfig(
      workflowId: string,
      config: WorkflowBrowserConfig,
    ) {
      const settings = getSettings(workflowId);
      saveSettings(workflowId, {
        ...settings,
        browser: configToSettingsBrowser(config),
      });
    },

    getWorkflowSettings(workflowId: string): WorkflowSettings {
      return getSettings(workflowId);
    },

    saveWorkflowSettings: saveSettings,

    saveWorkflowSettingsSection<Section extends WorkflowSettingsSectionId>(
      workflowId: string,
      section: Section,
      sectionValue: WorkflowSettings[Section],
    ): WorkflowSettings {
      return saveSettings(workflowId, {
        ...getSettings(workflowId),
        [section]: sectionValue,
      });
    },

    validateWorkflowSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
      return validateSettings(settings);
    },

    validateWorkflowRun(workflowId: string): RunValidationIssue[] {
      const graph = this.getWorkflowGraph(workflowId);
      return [
        ...this.validateWorkflowGraph(graph).map((issue) => ({
          source: "graph" as const,
          field: null,
          node_id: issue.node_id ?? null,
          edge_id: issue.edge_id ?? null,
          message: issue.message,
          level: issue.level,
        })),
        ...validateSettings(getSettings(workflowId)).map((issue) => ({
          source: "settings" as const,
          field: issue.field ?? null,
          node_id: null,
          edge_id: null,
          message: issue.message,
          level: issue.level,
        })),
      ];
    },

    createWorkflow,

    renameWorkflow(id: string, name: string) {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      requireWorkflow(id);
      repository.renameWorkflow(id, normalized);
    },

    deleteWorkflow(id: string) {
      repository.deleteWorkflow(id);
    },

    duplicateWorkflow(workflowId: string, name: string): WorkflowDetail {
      requireWorkflow(workflowId);
      const created = createWorkflow(name);
      const graph = repository.getWorkflowGraph(workflowId);
      if (graph) repository.saveWorkflowGraph(created.id, graph);
      const settings = repository.getWorkflowSettings(workflowId);
      if (settings) {
        saveSettings(created.id, {
          ...structuredClone(settings),
          workflow_id: created.id,
          general: {
            ...settings.general,
            name: created.name,
          },
        });
      }
      return { workflow: created, steps: [] };
    },

    getWorkflowGraph(workflowId: string): WorkflowGraph {
      const graph = repository.getWorkflowGraph(workflowId);
      if (!graph) {
        requireWorkflow(workflowId);
        return createDraftGraph();
      }
      return graph;
    },

    saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
      requireWorkflow(workflowId);
      repository.saveWorkflowGraph(workflowId, graph);
    },

    validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
      if (graph.nodes.length === 0) {
        return [
          {
            level: "error",
            message: "Workflow graph needs a Start node.",
          },
        ];
      }
      if (!graph.nodes.some((node) => node.node_type === "start")) {
        return [
          {
            level: "error",
            message: "Workflow graph needs a Start node.",
          },
        ];
      }
      return [];
    },

    compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
      return {
        steps: graph.nodes.flatMap((node) =>
          node.node_type === "action" && node.config
            ? [{ node_id: node.id, label: node.label, config: node.config as ActionConfig }]
            : [],
        ),
      };
    },

    runWorkflow(workflowId: string): RunState {
      requireWorkflow(workflowId);
      return {
        ...idleRunState,
        status: "success",
        mode: "run_workflow",
      };
    },

    stopRun() {
      return {
        ...idleRunState,
        status: "stopped",
        mode: "run_workflow",
      };
    },

    getRunState() {
      return idleRunState;
    },

    validateSchedule(schedule: OrchestrationSchedule) {
      return schedule;
    },

    exportWorkflow(workflowId: string): WorkflowExport {
      const workflow = requireWorkflow(workflowId);
      return {
        version: 1,
        workflow: summaryToWorkflow(workflow),
        steps: [],
        settings: repository.getWorkflowSettings(workflowId),
      };
    },

    importWorkflow(exported: WorkflowExport): WorkflowDetail {
      const workflow = createWorkflow(exported.workflow.name);
      if (exported.settings) {
        saveSettings(workflow.id, {
          ...exported.settings,
          workflow_id: workflow.id,
          general: {
            ...exported.settings.general,
            name: workflow.name,
          },
        });
      }
      return { workflow, steps: [] };
    },

    exportWorkflowPackage(
      workflowId: string,
      options: WorkflowPackageExportOptions,
    ): WorkflowPackage {
      const workflow = requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      const { packageSettings, omittedFields } = buildPackageSettings(
        settings,
        options.settings_sections,
      );

      return {
        kind: "workflow_package",
        version: 2,
        workflow: { name: workflow.name },
        included_sections: [
          ...(options.include_flow ? ["flow"] : []),
          ...options.settings_sections.map((section) => `settings.${section}`),
        ],
        omitted_fields: omittedFields,
        flow: options.include_flow ? this.getWorkflowGraph(workflowId) : null,
        settings: packageSettings,
      };
    },

    previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
      validateWorkflowPackage(packageValue);
      return {
        workflow_name: packageValue.workflow.name,
        includes_flow: Boolean(packageValue.flow),
        settings_sections: packageSettingsSections(packageValue),
        omitted_fields: packageValue.omitted_fields,
      };
    },

    importWorkflowPackage(
      packageValue: WorkflowPackage,
      options: WorkflowPackageImportOptions,
    ): WorkflowDetail {
      validateWorkflowPackage(packageValue);
      const workflow = createWorkflow(`${packageValue.workflow.name} (imported)`);
      if (options.include_flow && packageValue.flow) {
        repository.saveWorkflowGraph(workflow.id, packageValue.flow);
      }

      if (packageValue.settings && options.settings_sections.length > 0) {
        const settings = getSettings(workflow.id);
        let nextSettings = structuredClone(settings);
        for (const section of options.settings_sections) {
          const sectionValue = packageValue.settings[section];
          if (sectionValue) {
            nextSettings = {
              ...nextSettings,
              [section]: structuredClone(sectionValue),
            };
          }
        }
        saveSettings(workflow.id, {
          ...nextSettings,
          workflow_id: workflow.id,
          general: {
            ...nextSettings.general,
            name: workflow.name,
          },
        });
      }

      return { workflow, steps: [] };
    },

    runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      requireWorkflow(workflowId);
      return {
        total: request.rows.length,
        succeeded: request.rows.length,
        failed: 0,
        results: request.rows.map((_, rowIndex) => ({
          row_index: rowIndex,
          status: "success" as const,
          error: null,
        })),
      };
    },

    suggestSelectors(snapshot: ElementSnapshot): SelectorCandidate[] {
      const selector = snapshot.test_id
        ? `[data-testid="${snapshot.test_id}"]`
        : snapshot.id
          ? `#${snapshot.id}`
          : snapshot.tag;
      return [
        {
          selector_type: snapshot.test_id ? "test_id" : snapshot.id ? "id" : "tag",
          selector,
          score: 1,
          reason: "Generated from stable element attributes.",
        },
      ];
    },

    normalizeRecordedEvents(events: RecordedEvent[]): ActionConfig[] {
      return events.map((event) =>
        event.type === "click"
          ? {
              type: "click",
              config: {
                xpath: event.xpath,
              },
            }
          : {
              type: "input_text",
              config: {
                xpath: event.xpath,
                text: event.text,
                clear_before_input: true,
              },
            },
      ) as ActionConfig[];
    },

    dryRunValidateConfig(_config: ActionConfig) {},

    async saveWorkflowPackageFile(packageValue: WorkflowPackage) {
      if (!context.saveWorkflowPackageFile) {
        throw commandError("Workflow package file saving is not available");
      }
      return context.saveWorkflowPackageFile(packageValue);
    },
  };
}

export function serializeCommandError(error: unknown): CommandError {
  if (error instanceof Error) return { message: error.message };
  if (isCommandError(error)) return error;
  return { message: "Unexpected command error" };
}

function validateSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
  const issues: SettingsValidationIssue[] = [];
  if (!settings.general.name.trim()) {
    issues.push({
      section: "general",
      field: "name",
      level: "error",
      message: "Workflow name is required",
    });
  }
  if (settings.browser.proxy_enabled && !settings.browser.proxy_server?.trim()) {
    issues.push({
      section: "browser",
      field: "proxy_server",
      level: "error",
      message: "Proxy server is required when proxy is enabled",
    });
  }
  for (const field of ["viewport_width", "viewport_height"] as const) {
    const value = settings.browser[field];
    if (value != null && value <= 0) {
      issues.push({
        section: "browser",
        field,
        level: "error",
        message: "Viewport dimensions must be greater than zero",
      });
    }
  }
  if (settings.browser.fingerprint_preflight_enabled) {
    const probeUrl = settings.browser.fingerprint_probe_url?.trim();
    if (!probeUrl || !/^https?:\/\//i.test(probeUrl)) {
      issues.push({
        section: "browser",
        field: "fingerprint_probe_url",
        level: "error",
        message: "Fingerprint probe URL must be allowlisted HTTP(S)",
      });
    }
    if (!settings.browser.fingerprint_profile_id?.trim()) {
      issues.push({
        section: "browser",
        field: "fingerprint_profile_id",
        level: "error",
        message: "Fingerprint identity profile is required",
      });
    }
    if (settings.browser.headless) {
      issues.push({
        section: "browser",
        field: "headless",
        level: "error",
        message: "Fingerprint preflight requires headed browser mode",
      });
    }
  }
  return issues;
}

function buildPackageSettings(
  settings: WorkflowSettings,
  sections: WorkflowSettingsSectionId[],
) {
  const packageSettings: WorkflowPackageSettings = {};
  const omittedFields: string[] = [];

  for (const section of sections) {
    if (section === "browser") {
      packageSettings.browser = sanitizeBrowserSettings(settings.browser, omittedFields);
    } else if (section === "environment") {
      packageSettings.environment = sanitizeEnvironmentSettings(
        settings.environment,
        omittedFields,
      );
    } else {
      packageSettings[section] = structuredClone(settings[section]) as never;
    }
  }

  return { packageSettings, omittedFields };
}

function sanitizeBrowserSettings(
  browser: WorkflowSettingsBrowser,
  omittedFields: string[],
): WorkflowSettingsBrowser {
  const sanitized = structuredClone(browser);
  if (sanitized.proxy_password) {
    omittedFields.push("settings.browser.proxy_password");
  }
  sanitized.proxy_password = null;
  return sanitized;
}

function sanitizeEnvironmentSettings(
  environment: WorkflowSettingsEnvironment,
  omittedFields: string[],
): WorkflowSettingsEnvironment {
  const sanitized = structuredClone(environment);
  if (sanitized.download_directory) {
    omittedFields.push("settings.environment.download_directory");
  }
  if (sanitized.cookies.length > 0) {
    omittedFields.push("settings.environment.cookies");
  }
  if (sanitized.local_storage.length > 0) {
    omittedFields.push("settings.environment.local_storage");
  }
  if (sanitized.session_storage.length > 0) {
    omittedFields.push("settings.environment.session_storage");
  }
  if (sanitized.session_restore_ref) {
    omittedFields.push("settings.environment.session_restore_ref");
  }
  sanitized.download_directory = null;
  sanitized.cookies = [];
  sanitized.local_storage = [];
  sanitized.session_storage = [];
  sanitized.session_restore_ref = null;
  return sanitized;
}

function validateWorkflowPackage(packageValue: WorkflowPackage) {
  if (packageValue.kind !== "workflow_package" || packageValue.version !== 2) {
    throw commandError("Unsupported workflow package", "package");
  }
  if (!packageValue.workflow.name.trim()) {
    throw commandError("Workflow package name is required", "package.workflow.name");
  }
}

function packageSettingsSections(
  packageValue: WorkflowPackage,
): WorkflowSettingsSectionId[] {
  return packageValue.included_sections
    .filter((section) => section.startsWith("settings."))
    .map((section) => section.replace("settings.", ""))
    .filter(isWorkflowSettingsSection);
}

function commandError(message: string, field?: string): CommandError {
  return { message, field };
}

function isCommandError(error: unknown): error is CommandError {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: unknown }).message === "string",
  );
}

function summaryToWorkflow(summary: WorkflowSummary): Workflow {
  return {
    id: summary.id,
    name: summary.name,
    created_at: summary.created_at,
    updated_at: summary.updated_at,
  };
}

function createDraftGraph(): WorkflowGraph {
  return {
    version: 1,
    nodes: [
      {
        id: "start",
        node_type: "start",
        label: "Start",
        position: { x: 0, y: 0 },
        config: null,
        ports: [{ id: "out", label: "Out", direction: "output" }],
      },
      {
        id: "new-node",
        node_type: "action",
        label: "New node",
        position: { x: 240, y: 0 },
        config: null,
        ports: [
          { id: "in", label: "In", direction: "input" },
          { id: "out", label: "Out", direction: "output" },
        ],
      },
    ],
    edges: [
      {
        id: "start-to-new-node",
        source_node_id: "start",
        source_port: "out",
        target_node_id: "new-node",
        target_port: "in",
      },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

function defaultBrowserConfig(workflowId: string): WorkflowBrowserConfig {
  return {
    workflow_id: workflowId,
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
  };
}

function configToSettingsBrowser(config: WorkflowBrowserConfig): WorkflowSettingsBrowser {
  return normalizeSettingsBrowser({
    profile_name: nullableText(config.profile_name),
    proxy_enabled: config.proxy_enabled,
    proxy_server: nullableText(config.proxy_server),
    proxy_username: nullableText(config.proxy_username),
    proxy_password: nullableText(config.proxy_password),
    user_agent: nullableText(config.user_agent),
    viewport_width: config.viewport_width ?? null,
    viewport_height: config.viewport_height ?? null,
    mobile: config.mobile,
    touch: config.touch,
    challenge_policy: config.challenge_policy,
    headless: config.headless ?? false,
  });
}

function settingsBrowserToConfig(
  workflowId: string,
  browser: WorkflowSettingsBrowser,
): WorkflowBrowserConfig {
  return {
    workflow_id: workflowId,
    profile_name: browser.profile_name ?? null,
    proxy_enabled: browser.proxy_enabled,
    proxy_server: browser.proxy_server ?? null,
    proxy_username: browser.proxy_username ?? null,
    proxy_password: browser.proxy_password ?? null,
    user_agent: browser.user_agent ?? null,
    viewport_width: browser.viewport_width ?? null,
    viewport_height: browser.viewport_height ?? null,
    mobile: browser.mobile,
    touch: browser.touch,
    challenge_policy: browser.challenge_policy,
    headless: browser.headless,
  };
}

function normalizeSettingsBrowser(
  browser: WorkflowSettingsBrowser,
): WorkflowSettingsBrowser {
  return {
    ...browser,
    profile_name: nullableText(browser.profile_name),
    proxy_server: nullableText(browser.proxy_server),
    proxy_username: nullableText(browser.proxy_username),
    proxy_password: nullableText(browser.proxy_password),
    user_agent: nullableText(browser.user_agent),
    viewport_width: browser.viewport_width ?? null,
    viewport_height: browser.viewport_height ?? null,
  };
}

function defaultWorkflowSettings(workflow: WorkflowSummary): WorkflowSettings {
  const browser = configToSettingsBrowser(defaultBrowserConfig(workflow.id));
  return {
    workflow_id: workflow.id,
    version: 1,
    general: {
      name: workflow.name,
      description: "",
      tags: [],
      notes: "",
      created_at: workflow.created_at,
      updated_at: workflow.updated_at,
    },
    execution: {
      default_action_timeout_ms: null,
      default_retry_attempts: null,
      default_retry_interval_ms: null,
      max_workflow_duration_ms: null,
      browser_retention: "retain",
      failure_policy: "stop_on_first_failure",
      interaction_fidelity: "standard",
      direct_dom_fallback: "explicit",
      timing_profile: "balanced",
      wait_between_nodes_enabled: false,
      wait_between_nodes_random: false,
      wait_between_nodes_ms: null,
      wait_between_nodes_min_ms: null,
      wait_between_nodes_max_ms: null,
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
      output_retention_days: null,
    },
    browser,
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
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };
}

function isWorkflowSettingsSection(
  value: string,
): value is WorkflowSettingsSectionId {
  return workflowSettingsSections.includes(value as WorkflowSettingsSectionId);
}

function nullableText(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized.length > 0 ? normalized : null;
}
