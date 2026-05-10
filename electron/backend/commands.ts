import { randomUUID } from "node:crypto";
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
import {
  compileWorkflowRunPlan,
  compileWorkflowGraph as compileGraph,
  validateActionConfig,
  validateWorkflowGraph as validateGraph,
} from "./graphCompiler.js";
import { BrowserWorkflowRunner } from "./runner.js";
import { WorkflowRepository } from "./workflowRepository.js";

export type CommandError = {
  message: string;
  field?: string | null;
};

export type WorkflowCommandHandlers = ReturnType<typeof createWorkflowCommandHandlers>;

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
  runner?: Pick<BrowserWorkflowRunner, "run" | "closeRetainedContext">;
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
  const runner = context.runner ?? new BrowserWorkflowRunner({ appPaths: context.appPaths });
  let currentRunState = idleRunState;
  let currentRunAbortController: AbortController | null = null;
  let currentRunId: string | null = null;

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

  function getWorkflowGraph(workflowId: string): WorkflowGraph {
    const graph = repository.getWorkflowGraph(workflowId);
    if (!graph) {
      requireWorkflow(workflowId);
      return createDraftGraph();
    }
    return graph;
  }

  function validateWorkflowRun(workflowId: string): RunValidationIssue[] {
    const graph = getWorkflowGraph(workflowId);
    return [
      ...validateGraph(graph).map((issue) => ({
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
      return validateWorkflowRun(workflowId);
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
      return getWorkflowGraph(workflowId);
    },

    saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
      requireWorkflow(workflowId);
      repository.saveWorkflowGraph(workflowId, graph);
    },

    validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
      return validateGraph(graph);
    },

    compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
      return compileGraph(graph);
    },

    async runWorkflow(workflowId: string): Promise<RunState> {
      requireWorkflow(workflowId);
      if (currentRunAbortController) {
        throw commandError("A workflow run is already active", "run");
      }
      const graph = getWorkflowGraph(workflowId);
      const runIssues = validateWorkflowRun(workflowId);
      const firstError = runIssues.find((issue) => issue.level === "error");
      if (firstError) {
        throw commandError(firstError.message, firstError.field ?? firstError.node_id ?? "workflowId");
      }
      if (compileGraph(graph).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }

      const settings = getSettings(workflowId);
      const compiledGraph = compileWorkflowRunPlan(graph, settings);
      currentRunAbortController = new AbortController();
      currentRunId = beginRun(context.database, workflowId, settings, graph);
      currentRunState = {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
      };
      let timedOut = false;
      const abortController = currentRunAbortController;
      const runId = currentRunId;
      const timeoutMs = settings.execution.max_workflow_duration_ms;
      const timeoutHandle = timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            abortController.abort();
          }, timeoutMs)
        : null;
      void (async () => {
        try {
          let terminalState = await runner.run({
            graph: compiledGraph,
            settings,
            mode: "run_workflow",
            signal: abortController.signal,
            onProgress(progress) {
              if (abortController.signal.aborted && currentRunState.status === "stopped") {
                return;
              }
              currentRunState = {
                ...currentRunState,
                ...progress,
                status: "running",
                mode: "run_workflow",
              };
            },
          });
          if (timedOut && terminalState.status === "stopped") {
            terminalState = {
              ...terminalState,
              status: "failed",
              error: {
                step_id: terminalState.error?.step_id ?? null,
                step_number: terminalState.error?.step_number ?? 0,
                step_name: terminalState.error?.step_name ?? null,
                action_type: terminalState.error?.action_type ?? "workflow",
                reason: `Workflow exceeded maximum duration of ${timeoutMs} ms`,
              },
            };
          } else if (
            abortController.signal.aborted &&
            currentRunState.status === "stopped"
          ) {
            terminalState = {
              ...terminalState,
              status: "stopped",
              error: null,
            };
          }
          currentRunState = terminalState;
          finishRun(context.database, runId, compiledGraph, currentRunState);
        } catch (error) {
          currentRunState = {
            ...idleRunState,
            status: "failed",
            mode: "run_workflow",
            error: {
              step_id: currentRunState.current_step_id,
              step_number: currentRunState.current_step_number ?? 0,
              step_name: null,
              action_type: "workflow",
              reason: error instanceof Error ? error.message : String(error),
            },
          };
          finishRun(context.database, runId, compiledGraph, currentRunState);
        } finally {
          if (timeoutHandle) clearTimeout(timeoutHandle);
          if (currentRunAbortController === abortController) {
            currentRunAbortController = null;
          }
          if (currentRunId === runId) {
            currentRunId = null;
          }
        }
      })();
      return currentRunState;
    },

    async stopRun() {
      currentRunAbortController?.abort();
      if (!currentRunAbortController) {
        await runner.closeRetainedContext?.();
      }
      currentRunState = {
        ...idleRunState,
        status: "stopped",
        mode: "run_workflow",
      };
      return currentRunState;
    },

    getRunState() {
      return currentRunState;
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
        flow: options.include_flow ? getWorkflowGraph(workflowId) : null,
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

    async runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      const concurrencyLimit =
        request.concurrency_limit ?? settings.execution.batch_concurrency_limit ?? 1;
      if (concurrencyLimit > 1) {
        throw commandError(
          "Batch concurrency above 1 is not supported until row isolation is implemented",
          "concurrency_limit",
        );
      }
      const graph = getWorkflowGraph(workflowId);
      if (compileGraph(graph).steps.length === 0) {
        throw commandError("Workflow graph has no executable steps", "graph");
      }
      const compiledGraph = compileWorkflowRunPlan(graph, settings);
      const batchSettings: WorkflowSettings = {
        ...settings,
        execution: {
          ...settings.execution,
          browser_retention: "close",
        },
        browser: {
          ...settings.browser,
          headless: request.headless ?? settings.execution.batch_headless,
        },
      };
      const results = [];
      let succeeded = 0;
      let failed = 0;
      for (const [rowIndex, row] of request.rows.entries()) {
        const rowGraph = prependBatchRowVariables(compiledGraph, rowIndex, row);
        const runId = beginRun(context.database, workflowId, batchSettings, graph);
        const result = await runner.run({
          graph: rowGraph,
          settings: batchSettings,
          mode: "run_workflow",
        });
        finishRun(context.database, runId, rowGraph, result);
        if (result.status === "success") {
          succeeded += 1;
        } else {
          failed += 1;
        }
        results.push({
          row_index: rowIndex,
          status: result.status,
          error: result.error?.reason ?? null,
        });
        if (result.status !== "success" && settings.execution.batch_stop_on_first_failed_row) {
          break;
        }
      }
      return {
        total: request.rows.length,
        succeeded,
        failed,
        results,
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

    dryRunValidateConfig(config: ActionConfig) {
      const validation = validateActionConfig(config);
      if (validation) throw commandError(validation.message, validation.field);
    },

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
  for (const field of [
    "default_action_timeout_ms",
    "default_retry_attempts",
    "default_retry_interval_ms",
    "max_workflow_duration_ms",
    "batch_concurrency_limit",
    "output_retention_days",
  ] as const) {
    const value = settings.execution[field];
    if (value != null && value <= 0) {
      issues.push({
        section: "execution",
        field,
        level: "error",
        message: "Execution numeric settings must be greater than zero when set",
      });
    }
  }
  if (settings.execution.wait_between_nodes_enabled) {
    if (settings.execution.wait_between_nodes_random) {
      const minMs = settings.execution.wait_between_nodes_min_ms;
      const maxMs = settings.execution.wait_between_nodes_max_ms;
      if (minMs != null && minMs <= 0) {
        issues.push({
          section: "execution",
          field: "wait_between_nodes_min_ms",
          level: "error",
          message: "Minimum wait must be greater than zero",
        });
      }
      if (maxMs != null && maxMs <= 0) {
        issues.push({
          section: "execution",
          field: "wait_between_nodes_max_ms",
          level: "error",
          message: "Maximum wait must be greater than zero",
        });
      }
      if (minMs != null && maxMs != null && maxMs < minMs) {
        issues.push({
          section: "execution",
          field: "wait_between_nodes_max_ms",
          level: "error",
          message: "Maximum wait must be greater than or equal to minimum wait",
        });
      }
    } else if (
      settings.execution.wait_between_nodes_ms != null &&
      settings.execution.wait_between_nodes_ms <= 0
    ) {
      issues.push({
        section: "execution",
        field: "wait_between_nodes_ms",
        level: "error",
        message: "Wait between nodes must be greater than zero",
      });
    }
  }
  if (settings.environment.geolocation) {
    const { latitude, longitude, accuracy } = settings.environment.geolocation;
    if (latitude < -90 || latitude > 90) {
      issues.push({
        section: "environment",
        field: "geolocation.latitude",
        level: "error",
        message: "Latitude must be between -90 and 90",
      });
    }
    if (longitude < -180 || longitude > 180) {
      issues.push({
        section: "environment",
        field: "geolocation.longitude",
        level: "error",
        message: "Longitude must be between -180 and 180",
      });
    }
    if (accuracy != null && accuracy <= 0) {
      issues.push({
        section: "environment",
        field: "geolocation.accuracy",
        level: "error",
        message: "Geolocation accuracy must be greater than zero",
      });
    }
  }
  if (settings.browser.fingerprint_preflight_enabled) {
    const probeUrl = settings.browser.fingerprint_probe_url?.trim();
    let probeOrigin: string | null = null;
    if (!probeUrl || !/^https?:\/\//i.test(probeUrl)) {
      issues.push({
        section: "browser",
        field: "fingerprint_probe_url",
        level: "error",
        message: "Fingerprint probe URL must be allowlisted HTTP(S)",
      });
    } else {
      try {
        probeOrigin = new URL(probeUrl).origin;
      } catch {
        issues.push({
          section: "browser",
          field: "fingerprint_probe_url",
          level: "error",
          message: "Fingerprint probe URL must be valid HTTP(S)",
        });
      }
    }
    const allowedOrigins = settings.browser.fingerprint_allowed_origins ?? [];
    if (
      probeOrigin &&
      (allowedOrigins.length === 0 ||
        !allowedOrigins.map(normalizeOrigin).includes(probeOrigin))
    ) {
      issues.push({
        section: "browser",
        field: "fingerprint_allowed_origins",
        level: "error",
        message: "Fingerprint probe origin must be in the allowed origins list",
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

export function defaultWorkflowSettings(workflow: WorkflowSummary): WorkflowSettings {
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

function beginRun(
  database: DatabaseSync,
  workflowId: string,
  settings: WorkflowSettings,
  graph: WorkflowGraph,
) {
  const runId = randomUUID();
  database
    .prepare(
      `INSERT INTO runs (
        id,
        workflow_id,
        status,
        started_at,
        settings_snapshot_json,
        graph_snapshot_json
      ) VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      runId,
      workflowId,
      "running",
      new Date().toISOString(),
      JSON.stringify(settings),
      JSON.stringify(graph),
    );
  return runId;
}

function finishRun(
  database: DatabaseSync,
  runId: string | null,
  graph: CompiledWorkflowGraph,
  state: RunState,
) {
  if (!runId) return;
  database
    .prepare(
      `UPDATE runs
       SET status = ?,
           finished_at = ?,
           outputs_json = ?,
           error_json = ?
       WHERE id = ?`,
    )
    .run(
      state.status,
      new Date().toISOString(),
      JSON.stringify(state.outputs ?? {}),
      state.error ? JSON.stringify(state.error) : null,
      runId,
    );

  const traces = Array.isArray(state.outputs?.__action_traces)
    ? (state.outputs.__action_traces as Array<Record<string, unknown>>)
    : [];
  const insertStep = database.prepare(
    `INSERT INTO run_steps (
      id,
      run_id,
      node_id,
      step_number,
      action_type,
      status,
      finished_at,
      trace_json,
      error_json
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const [index, step] of graph.steps.entries()) {
    const trace = traces.find((candidate) => candidate.node_id === step.node_id);
    const failed = state.error?.step_id === step.node_id;
    const completed = state.completed_step_ids.includes(step.node_id);
    insertStep.run(
      randomUUID(),
      runId,
      step.node_id,
      index + 1,
      step.config.type,
      failed ? "failed" : completed ? "success" : "skipped",
      trace || failed ? new Date().toISOString() : null,
      trace ? JSON.stringify(trace) : null,
      failed && state.error ? JSON.stringify(state.error) : null,
    );
  }
}

function prependBatchRowVariables(
  graph: CompiledWorkflowGraph,
  rowIndex: number,
  row: Record<string, string>,
): CompiledWorkflowGraph {
  return {
    steps: [
      {
        node_id: `batch-row-${rowIndex}`,
        label: `Batch row ${rowIndex + 1}`,
        config: {
          type: "set_variable",
          config: {
            variables: Object.entries(row).map(([name, value]) => ({
              name,
              value_type: "text",
              value,
            })),
          },
        },
      },
      ...graph.steps,
    ],
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

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}
