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
  WorkflowSettingsBrowserLaunch,
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
import { elementTargetFromXpath, migrateWorkflowGraph } from "./workflowGraphMigration.js";
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
  "run_policy",
  "browser_launch",
  "environment",
  "owned_test_gates",
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
    if (persisted) return migrateWorkflowSettings(persisted, requireWorkflow(workflowId));
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
      version: 2,
      general: {
        ...settings.general,
        name: settings.general.name.trim(),
        updated_at: timestamp,
        created_at: settings.general.created_at ?? workflow.created_at,
      },
      browser_launch: normalizeSettingsBrowserLaunch(settings.browser_launch),
      migration_notes: settings.migration_notes ?? [],
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
    const migrated = migrateWorkflowGraph(graph);
    if (JSON.stringify(migrated) !== JSON.stringify(graph)) {
      repository.saveWorkflowGraph(workflowId, migrated);
    }
    return migrated;
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
      return settingsBrowserToConfig(workflowId, getSettings(workflowId).browser_launch);
    },

    saveWorkflowBrowserConfig(
      workflowId: string,
      config: WorkflowBrowserConfig,
    ) {
      const settings = getSettings(workflowId);
      saveSettings(workflowId, {
        ...settings,
        browser_launch: configToSettingsBrowserLaunch(config),
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
      repository.saveWorkflowGraph(workflowId, migrateWorkflowGraph(graph));
    },

    validateWorkflowGraph(graph: WorkflowGraph): GraphValidationIssue[] {
      return validateGraph(migrateWorkflowGraph(graph));
    },

    compileWorkflowGraph(graph: WorkflowGraph): CompiledWorkflowGraph {
      return compileGraph(migrateWorkflowGraph(graph));
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
      const timeoutMs = settings.run_policy.max_workflow_duration_ms;
      const timeoutHandle = timeoutMs
        ? setTimeout(() => {
            timedOut = true;
            abortController.abort();
          }, timeoutMs)
        : null;
      void (async () => {
        try {
          let terminalState = await runner.run({
            runId,
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
      const packageFlow = packageValue.flow ? migrateWorkflowGraph(packageValue.flow) : null;
      if (options.include_flow && packageFlow) {
        const flowError = validateGraph(packageFlow).find(
          (issue) => issue.level === "error" && !isImportableDraftFlowIssue(issue.message),
        );
        if (flowError) {
          throw commandError(flowError.message, "package.flow");
        }
      }

      const importedName = `${packageValue.workflow.name} (imported)`;
      const timestamp = new Date().toISOString();
      const candidateSettings = packageValue.settings && options.settings_sections.length > 0
        ? buildImportedSettingsCandidate(
            importedName,
            timestamp,
            packageValue.settings,
            options.settings_sections,
          )
        : null;
      if (candidateSettings) {
        const settingsError = validateSettings(candidateSettings).find((issue) => issue.level === "error");
        if (settingsError) {
          throw commandError(
            settingsError.message,
            settingsError.field
              ? `${settingsError.section}.${settingsError.field}`
              : settingsError.section,
          );
        }
      }

      context.database.exec("BEGIN IMMEDIATE");
      try {
        const workflow = createWorkflow(importedName);
        if (options.include_flow && packageFlow) {
          repository.saveWorkflowGraph(workflow.id, packageFlow);
        }

        if (candidateSettings) {
          saveSettings(workflow.id, {
            ...candidateSettings,
            workflow_id: workflow.id,
            general: {
              ...candidateSettings.general,
              name: workflow.name,
            },
          });
        }
        context.database.exec("COMMIT");
        return { workflow, steps: [] };
      } catch (error) {
        context.database.exec("ROLLBACK");
        throw error;
      }
    },

    async runBatchWorkflow(
      workflowId: string,
      request: BatchRunRequest,
    ) {
      requireWorkflow(workflowId);
      if (currentRunAbortController) {
        throw commandError("A workflow run is already active", "run");
      }
      const settings = getSettings(workflowId);
      const concurrencyLimit =
        request.concurrency_limit ?? settings.run_policy.batch_concurrency_limit ?? 1;
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
        run_policy: {
          ...settings.run_policy,
          browser_retention: "close",
        },
        browser_launch: {
          ...settings.browser_launch,
          headless: request.headless ?? settings.run_policy.batch_headless,
        },
      };
      const results = [];
      let succeeded = 0;
      let failed = 0;
      currentRunAbortController = new AbortController();
      const abortController = currentRunAbortController;
      currentRunState = {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
        outputs: {
          batch_total: request.rows.length,
          batch_current_row_index: 0,
          batch_succeeded: 0,
          batch_failed: 0,
        },
      };
      try {
        for (const [rowIndex, row] of request.rows.entries()) {
          if (abortController.signal.aborted) break;
          currentRunState = {
            ...currentRunState,
            status: "running",
            outputs: {
              ...(currentRunState.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          };
          const rowGraph = prependBatchRowVariables(compiledGraph, rowIndex, row);
          const runId = beginRun(context.database, workflowId, batchSettings, graph);
          currentRunId = runId;
          let result = await runner.run({
            runId,
            graph: rowGraph,
            settings: batchSettings,
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
                outputs: {
                  ...(currentRunState.outputs ?? {}),
                  batch_total: request.rows.length,
                  batch_current_row_index: rowIndex,
                  batch_succeeded: succeeded,
                  batch_failed: failed,
                },
              };
            },
          });
          if (abortController.signal.aborted && currentRunState.status === "stopped") {
            result = {
              ...result,
              status: "stopped",
              error: null,
            };
          }
          finishRun(context.database, runId, rowGraph, result);
          currentRunId = null;
          if (result.status === "success") {
            succeeded += 1;
          } else if (result.status === "failed") {
            failed += 1;
          }
          results.push({
            row_index: rowIndex,
            status: result.status,
            error: result.error?.reason ?? null,
          });
          currentRunState = {
            ...currentRunState,
            status: result.status === "stopped" ? "stopped" : "running",
            current_step_id: null,
            current_step_number: null,
            outputs: {
              ...(currentRunState.outputs ?? {}),
              batch_total: request.rows.length,
              batch_current_row_index: rowIndex,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
            error: result.status === "failed" ? result.error : null,
          };
          if (result.status === "stopped") break;
          if (result.status !== "success" && settings.run_policy.batch_stop_on_first_failed_row) {
            break;
          }
        }
        if (currentRunState.status !== "stopped") {
          currentRunState = {
            ...currentRunState,
            status: failed > 0 ? "failed" : "success",
            current_step_id: null,
            current_step_number: null,
            outputs: {
              ...(currentRunState.outputs ?? {}),
              batch_total: request.rows.length,
              batch_succeeded: succeeded,
              batch_failed: failed,
            },
          };
        }
      } finally {
        if (currentRunAbortController === abortController) {
          currentRunAbortController = null;
        }
        currentRunId = null;
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
                target: elementTargetFromXpath(event.xpath),
              },
            }
          : {
              type: "input_text",
              config: {
                target: elementTargetFromXpath(event.xpath),
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
  if (settings.browser_launch.proxy_enabled && !settings.browser_launch.proxy_server?.trim()) {
    issues.push({
      section: "browser_launch",
      field: "proxy_server",
      level: "error",
      message: "Proxy server is required when proxy is enabled",
    });
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
  if (settings.owned_test_gates.fingerprint_preflight_enabled) {
    const probeUrl = settings.owned_test_gates.fingerprint_probe_url?.trim();
    let probeOrigin: string | null = null;
    if (!probeUrl || !/^https?:\/\//i.test(probeUrl)) {
      issues.push({
        section: "owned_test_gates",
        field: "fingerprint_probe_url",
        level: "error",
        message: "Fingerprint probe URL must be allowlisted HTTP(S)",
      });
    } else {
      try {
        probeOrigin = new URL(probeUrl).origin;
      } catch {
        issues.push({
          section: "owned_test_gates",
          field: "fingerprint_probe_url",
          level: "error",
          message: "Fingerprint probe URL must be valid HTTP(S)",
        });
      }
    }
    const allowedOrigins = settings.owned_test_gates.fingerprint_allowed_origins ?? [];
    if (
      probeOrigin &&
      (allowedOrigins.length === 0 ||
        !allowedOrigins.map(normalizeOrigin).includes(probeOrigin))
    ) {
      issues.push({
        section: "owned_test_gates",
        field: "fingerprint_allowed_origins",
        level: "error",
        message: "Fingerprint probe origin must be in the allowed origins list",
      });
    }
    if (!settings.owned_test_gates.fingerprint_profile_id?.trim()) {
      issues.push({
        section: "owned_test_gates",
        field: "fingerprint_profile_id",
        level: "error",
        message: "Fingerprint identity profile is required",
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
  return issues;
}

function buildPackageSettings(
  settings: WorkflowSettings,
  sections: WorkflowSettingsSectionId[],
) {
  const packageSettings: WorkflowPackageSettings = {};
  const omittedFields: string[] = [];

  for (const section of sections) {
    if (section === "browser_launch") {
      packageSettings.browser_launch = sanitizeBrowserLaunchSettings(
        settings.browser_launch,
        omittedFields,
      );
    } else {
      packageSettings[section] = structuredClone(settings[section]) as never;
    }
  }

  return { packageSettings, omittedFields };
}

function sanitizeBrowserLaunchSettings(
  browser: WorkflowSettingsBrowserLaunch,
  omittedFields: string[],
): WorkflowSettingsBrowserLaunch {
  const sanitized = structuredClone(browser);
  if (sanitized.proxy_password) {
    omittedFields.push("settings.browser_launch.proxy_password");
  }
  sanitized.proxy_password = null;
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

function buildImportedSettingsCandidate(
  workflowName: string,
  timestamp: string,
  packageSettings: WorkflowPackageSettings,
  sections: WorkflowSettingsSectionId[],
): WorkflowSettings {
  let nextSettings = defaultWorkflowSettings({
    id: "__import_preview__",
    name: workflowName,
    step_count: 0,
    created_at: timestamp,
    updated_at: timestamp,
  });
  for (const section of sections) {
    const sectionValue = packageSettings[section];
    if (sectionValue) {
      nextSettings = {
        ...nextSettings,
        [section]: structuredClone(sectionValue),
      };
    }
  }
  return {
    ...nextSettings,
    workflow_id: "__import_preview__",
    general: {
      ...nextSettings.general,
      name: workflowName,
    },
  };
}

function isImportableDraftFlowIssue(message: string) {
  return message === "Choose an action type before running this node";
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

function migrateWorkflowSettings(
  settings: WorkflowSettings,
  workflow: WorkflowSummary,
): WorkflowSettings {
  if (settings.version === 2 && "run_policy" in settings) {
    return {
      ...settings,
      browser_launch: normalizeSettingsBrowserLaunch(settings.browser_launch),
      migration_notes: settings.migration_notes ?? [],
    };
  }

  const legacy = settings as unknown as Record<string, any>;
  const base = defaultWorkflowSettings(workflow);
  const notes = [...base.migration_notes];
  const converted = (pathValue: string, message: string) => {
    notes.push({ path: pathValue, action: "converted", message });
  };
  const dropped = (pathValue: string, message: string) => {
    notes.push({ path: pathValue, action: "dropped", message });
  };

  const legacyExecution = objectRecord(legacy.execution);
  const legacyBrowser = objectRecord(legacy.browser);
  const legacyEnvironment = objectRecord(legacy.environment);
  const legacyInputs = objectRecord(legacy.inputs);

  const profileName = nullableText(legacyBrowser.profile_name);
  if (profileName) converted("browser.profile_name", "Converted persistent profile into browser_launch.");
  for (const field of ["proxy_enabled", "proxy_server", "proxy_username", "proxy_password", "headless"]) {
    if (field in legacyBrowser) converted(`browser.${field}`, "Converted browser launch field.");
  }

  for (const field of [
    "default_action_timeout_ms",
    "default_retry_attempts",
    "default_retry_interval_ms",
    "failure_policy",
    "interaction_fidelity",
    "direct_dom_fallback",
    "timing_profile",
    "wait_between_nodes_enabled",
    "wait_between_nodes_random",
    "wait_between_nodes_ms",
    "wait_between_nodes_min_ms",
    "wait_between_nodes_max_ms",
    "output_retention_days",
  ]) {
    if (field in legacyExecution) dropped(`execution.${field}`, "Dropped obsolete engine-level run setting.");
  }
  for (const field of ["user_agent", "viewport_width", "viewport_height", "mobile", "touch", "challenge_policy"]) {
    if (field in legacyBrowser) dropped(`browser.${field}`, "Dropped browser emulation or challenge setting.");
  }
  for (const field of [
    "geolocation",
    "permissions",
    "extra_http_headers",
    "locale",
    "timezone",
    "download_directory",
    "cookies",
    "local_storage",
    "session_storage",
    "session_restore_ref",
  ]) {
    if (field in legacyEnvironment) dropped(`environment.${field}`, "Dropped browser context seeding from Workflow Settings.");
  }
  if (Array.isArray(legacyInputs.initial_variables)) {
    converted("inputs.initial_variables", "Converted initial variables into environment.");
  }

  return {
    ...base,
    workflow_id: typeof legacy.workflow_id === "string" ? legacy.workflow_id : workflow.id,
    version: 2,
    general: {
      ...base.general,
      ...objectRecord(legacy.general),
      name: String(objectRecord(legacy.general).name ?? workflow.name),
    },
    run_policy: {
      ...base.run_policy,
      max_workflow_duration_ms: numericOrNull(legacyExecution.max_workflow_duration_ms),
      browser_retention: legacyExecution.browser_retention === "close" ? "close" : "retain",
      batch_concurrency_limit: numericOrNull(legacyExecution.batch_concurrency_limit) ?? 1,
      batch_headless: Boolean(legacyExecution.batch_headless),
      batch_stop_on_first_failed_row: Boolean(legacyExecution.batch_stop_on_first_failed_row),
    },
    browser_launch: normalizeSettingsBrowserLaunch({
      ...base.browser_launch,
      session_mode: profileName ? "persistent_profile" : "temporary",
      profile_name: profileName,
      proxy_enabled: Boolean(legacyBrowser.proxy_enabled),
      proxy_server: nullableText(legacyBrowser.proxy_server),
      proxy_username: nullableText(legacyBrowser.proxy_username),
      proxy_password: nullableText(legacyBrowser.proxy_password),
      headless: Boolean(legacyBrowser.headless),
    }),
    environment: {
      initial_variables: Array.isArray(legacyInputs.initial_variables)
        ? legacyInputs.initial_variables
        : [],
    },
    owned_test_gates: {
      fingerprint_preflight_enabled: Boolean(legacyBrowser.fingerprint_preflight_enabled),
      fingerprint_probe_url: nullableText(legacyBrowser.fingerprint_probe_url),
      fingerprint_profile_id: nullableText(legacyBrowser.fingerprint_profile_id),
      fingerprint_allowed_origins: Array.isArray(legacyBrowser.fingerprint_allowed_origins)
        ? legacyBrowser.fingerprint_allowed_origins.filter((origin: unknown) => typeof origin === "string")
        : [],
      fingerprint_proxy_label: nullableText(legacyBrowser.fingerprint_proxy_label),
      fingerprint_proxy_region: nullableText(legacyBrowser.fingerprint_proxy_region),
    },
    migration_notes: notes,
  };
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
    version: 2,
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
    migration_notes: [],
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
    headless: false,
  };
}

function configToSettingsBrowserLaunch(config: WorkflowBrowserConfig): WorkflowSettingsBrowserLaunch {
  return normalizeSettingsBrowserLaunch({
    session_mode: config.profile_name ? "persistent_profile" : "temporary",
    profile_name: nullableText(config.profile_name),
    proxy_enabled: config.proxy_enabled,
    proxy_server: nullableText(config.proxy_server),
    proxy_username: nullableText(config.proxy_username),
    proxy_password: nullableText(config.proxy_password),
    headless: config.headless ?? false,
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
): WorkflowSettingsBrowserLaunch {
  const profileName = nullableText(browser.profile_name);
  return {
    ...browser,
    session_mode: browser.session_mode === "persistent_profile" && profileName
      ? "persistent_profile"
      : "temporary",
    profile_name: browser.session_mode === "persistent_profile" ? profileName : null,
    proxy_server: nullableText(browser.proxy_server),
    proxy_username: nullableText(browser.proxy_username),
    proxy_password: nullableText(browser.proxy_password),
  };
}

export function defaultWorkflowSettings(workflow: WorkflowSummary): WorkflowSettings {
  const browserLaunch = configToSettingsBrowserLaunch(defaultBrowserConfig(workflow.id));
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
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: browserLaunch,
    environment: {
      initial_variables: [],
    },
    owned_test_gates: {
      fingerprint_preflight_enabled: false,
      fingerprint_probe_url: null,
      fingerprint_profile_id: null,
      fingerprint_allowed_origins: [],
      fingerprint_proxy_label: null,
      fingerprint_proxy_region: null,
    },
    migration_notes: [],
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

function objectRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, any>)
    : {};
}

function numericOrNull(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeOrigin(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return value.trim().replace(/\/+$/, "");
  }
}
