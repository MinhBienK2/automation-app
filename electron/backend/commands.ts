import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
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
  compileWorkflowGraphFromNode,
  compileWorkflowRunPlan,
  compileWorkflowGraph as compileGraph,
  validateActionConfig,
  validateWorkflowGraph as validateGraph,
} from "./graphCompiler.js";
import { BrowserWorkflowRunner } from "./runner.js";
import { elementTargetFromXpath, migrateWorkflowGraph } from "./workflowGraphMigration.js";
import { WorkflowRepository } from "./workflowRepository.js";

const nodeRequire = createRequire(import.meta.url);

export type CommandError = {
  message: string;
  field?: string | null;
};

export type WorkflowCommandHandlers = ReturnType<typeof createWorkflowCommandHandlers>;

type RunnerCommandPort = {
  run: BrowserWorkflowRunner["run"];
  closeRetainedContext?: BrowserWorkflowRunner["closeRetainedContext"];
  hasReusableRetainedSession?: BrowserWorkflowRunner["hasReusableRetainedSession"];
  getRetainedSessionState?: BrowserWorkflowRunner["getRetainedSessionState"];
};

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
  runner?: RunnerCommandPort;
  saveWorkflowPackageFile?: (packageValue: WorkflowPackage) => Promise<string | null>;
};

const workflowSettingsSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "environment",
];

const idleRunState: RunState = {
  status: "idle",
  mode: "none",
  target_step_id: null,
  current_step_id: null,
  current_step_number: null,
  completed_step_ids: [],
  outputs: {},
  retained_session: {
    available: false,
    workflow_id: null,
    profile_name: null,
    reason: "No retained browser session",
  },
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
    const activeSettings = stripRemovedWorkflowSettingsSections(settings);
    const issues = validateSettings(activeSettings);
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
      ...activeSettings,
      workflow_id: workflowId,
      version: 2,
      general: {
        ...activeSettings.general,
        name: activeSettings.general.name.trim(),
        updated_at: timestamp,
        created_at: activeSettings.general.created_at ?? workflow.created_at,
      },
      browser_launch: normalizeSettingsBrowserLaunch(activeSettings.browser_launch),
      migration_notes: activeSettings.migration_notes ?? [],
      updated_at: timestamp,
      created_at: activeSettings.created_at ?? workflow.created_at,
    };
    repository.saveWorkflowSettings(workflowId, normalized);
    return normalized;
  }

  function createWorkflow(name: string): Workflow {
    const normalized = name.trim();
    if (!normalized) {
      throw commandError("Workflow name is required", "name");
    }
    const workflow = repository.createWorkflow(normalized, createDraftGraph());
    repository.saveWorkflowSettings(
      workflow.id,
      defaultWorkflowSettings(workflow, { randomizeIdentity: true }),
    );
    return workflow;
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
        browser_launch: {
          ...settings.browser_launch,
          ...configToSettingsBrowserLaunch(config, {
            id: workflowId,
            name: settings.general.name,
          }),
          ...browserIdentityPreferences(settings.browser_launch),
        },
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
            retainedSessionWorkflowId: workflowId,
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

    async runWorkflowFromNode(workflowId: string, startNodeId: string): Promise<RunState> {
      requireWorkflow(workflowId);
      if (currentRunAbortController) {
        throw commandError("A workflow run is already active", "run");
      }
      const settings = getSettings(workflowId);
      const profileKey = browserProfileKey(settings);
      if (settings.browser_launch.session_mode !== "persistent_profile" || !profileKey) {
        throw commandError(
          "Run from selected requires Reuse login session to be enabled",
          "browser_launch.session_mode",
        );
      }
      if (settings.run_policy.browser_retention !== "retain") {
        throw commandError(
          "Run from selected requires browser retention to be set to retain",
          "run_policy.browser_retention",
        );
      }
      if (!settings.browser_launch.run_from_selected_enabled) {
        throw commandError(
          "Run from selected must be enabled in Workflow Settings",
          "browser_launch.run_from_selected_enabled",
        );
      }
      if (!runner.hasReusableRetainedSession?.(workflowId, profileKey)) {
        currentRunState = {
          ...currentRunState,
          retained_session: runner.getRetainedSessionState?.() ?? {
            available: false,
            workflow_id: null,
            profile_name: null,
            reason: "No retained browser session",
          },
        };
        throw commandError(
          "No reusable browser session is available. Run the workflow again to create one.",
          "run",
        );
      }

      const graph = getWorkflowGraph(workflowId);
      const compiledGraph = compileWorkflowGraphFromNode(graph, startNodeId);
      if (compiledGraph.steps.length === 0) {
        throw commandError("Selected graph node has no executable steps", "startNodeId");
      }

      currentRunAbortController = new AbortController();
      currentRunId = beginRun(context.database, workflowId, settings, graph);
      currentRunState = {
        ...idleRunState,
        status: "running",
        mode: "run_workflow",
        target_step_id: startNodeId,
        retained_session: runner.getRetainedSessionState?.() ?? currentRunState.retained_session,
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
            targetStepId: startNodeId,
            reuseRetainedSession: true,
            retainedSessionWorkflowId: workflowId,
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
                target_step_id: startNodeId,
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
            target_step_id: startNodeId,
            retained_session: runner.getRetainedSessionState?.() ?? null,
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
      if (currentRunState.status !== "running") {
        currentRunState = {
          ...currentRunState,
          retained_session: runner.getRetainedSessionState?.() ?? currentRunState.retained_session,
        };
      }
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
  if (settings.browser_launch.geoip && !isOptionalModuleAvailable("mmdb-lib")) {
    issues.push({
      section: "browser_launch",
      field: "geoip",
      level: "error",
      message: "GeoIP requires mmdb-lib to be installed",
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
  if (
    settings.browser_launch.user_agent &&
    /mobile|iphone|android/i.test(settings.browser_launch.user_agent) &&
    (!settings.browser_launch.mobile || !settings.browser_launch.touch)
  ) {
    issues.push({
      section: "browser_launch",
      field: "mobile",
      level: "warning",
      message: "Mobile user agents should use mobile viewport and touch settings",
    });
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
  return issues;
}

function isOptionalModuleAvailable(name: string) {
  try {
    nodeRequire.resolve(name);
    return true;
  } catch {
    return false;
  }
}

function originForUrl(value: string) {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function stripRemovedWorkflowSettingsSections(settings: WorkflowSettings): WorkflowSettings {
  const legacySettings = settings as WorkflowSettings & { owned_test_gates?: unknown };
  const { owned_test_gates: removedOwnedTestGates, ...activeSettings } = legacySettings;
  const migrationNotes = [...(activeSettings.migration_notes ?? [])];
  if (
    removedOwnedTestGates !== undefined &&
    !migrationNotes.some((note) => note.path === "owned_test_gates")
  ) {
    migrationNotes.push({
      path: "owned_test_gates",
      action: "dropped",
      message: "Dropped removed Owned Test Gates settings section.",
    });
  }
  return {
    ...activeSettings,
    migration_notes: migrationNotes,
  };
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
  if (sanitized.preflight_probe_url) {
    const sanitizedProbeUrl = sanitizeUrlSearch(sanitized.preflight_probe_url);
    if (sanitizedProbeUrl !== sanitized.preflight_probe_url) {
      omittedFields.push("settings.browser_launch.preflight_probe_url.search");
      sanitized.preflight_probe_url = sanitizedProbeUrl;
    }
  }
  return sanitized;
}

function sanitizeUrlSearch(value: string) {
  try {
    const url = new URL(value);
    url.search = "";
    url.hash = "";
    return url.toString();
  } catch {
    return value;
  }
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
    const activeSettings = stripRemovedWorkflowSettingsSections(settings);
    return {
      ...activeSettings,
      browser_launch: normalizeSettingsBrowserLaunch(activeSettings.browser_launch),
      migration_notes: activeSettings.migration_notes ?? [],
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
    "fingerprint_preflight_enabled",
    "fingerprint_probe_url",
    "fingerprint_profile_id",
    "fingerprint_allowed_origins",
    "fingerprint_proxy_label",
    "fingerprint_proxy_region",
  ]) {
    if (field in legacyBrowser) dropped(`browser.${field}`, "Dropped removed fingerprint preflight setting.");
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
): WorkflowSettingsBrowserLaunch {
  const profileName = nullableText(browser.profile_name);
  const identityId = nullableText(browser.identity_id) ?? createStableBrowserIdentityId(profileName ?? "workflow");
  const profileDir = nullableText(browser.profile_dir) ?? identityId;
  const fingerprintSeed = nullableText(browser.fingerprint_seed) ?? stableFingerprintSeed(identityId);
  return {
    ...browser,
    identity_id: identityId,
    display_name: nullableText(browser.display_name) ?? `${profileName ?? "Workflow"} identity`,
    profile_dir: profileDir,
    fingerprint_seed: fingerprintSeed,
    viewport_width: positiveNumberOrDefault(browser.viewport_width, 1920),
    viewport_height: positiveNumberOrDefault(browser.viewport_height, 947),
    device_scale_factor: positiveNumberOrDefault(browser.device_scale_factor, 1),
    mobile: Boolean(browser.mobile),
    touch: Boolean(browser.touch),
    timezone: nullableText(browser.timezone),
    locale: nullableText(browser.locale),
    geoip: Boolean(browser.geoip),
    proxy_label: nullableText(browser.proxy_label),
    proxy_region: nullableText(browser.proxy_region),
    webrtc_policy: validWebRtcPolicy(browser.webrtc_policy)
      ? browser.webrtc_policy
      : "default",
    webrtc_ip: nullableText(browser.webrtc_ip),
    storage_quota_mb: positiveOptionalNumber(browser.storage_quota_mb),
    humanize: browser.humanize !== false,
    human_preset: browser.human_preset === "careful" ? "careful" : "default",
    preflight_enabled: Boolean(browser.preflight_enabled),
    preflight_probe_url: nullableText(browser.preflight_probe_url),
    preflight_allowed_origins: Array.isArray(browser.preflight_allowed_origins)
      ? browser.preflight_allowed_origins.filter((origin) => typeof origin === "string" && origin.trim())
      : [],
    user_agent: nullableText(browser.user_agent),
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
      batch_concurrency_limit: 1,
      batch_headless: false,
      batch_stop_on_first_failed_row: false,
    },
    browser_launch: browserLaunch,
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };
}

function createDefaultBrowserIdentity(
  workflow?: Pick<WorkflowSummary, "id" | "name">,
  options: { randomizeIdentity?: boolean } = {},
): Pick<
  WorkflowSettingsBrowserLaunch,
  | "identity_id"
  | "display_name"
  | "profile_dir"
  | "fingerprint_seed"
  | "viewport_width"
  | "viewport_height"
  | "device_scale_factor"
  | "mobile"
  | "touch"
  | "timezone"
  | "locale"
  | "geoip"
  | "proxy_label"
  | "proxy_region"
  | "webrtc_policy"
  | "webrtc_ip"
  | "storage_quota_mb"
  | "humanize"
  | "human_preset"
  | "preflight_enabled"
  | "preflight_probe_url"
  | "preflight_allowed_origins"
  | "user_agent"
> {
  const identityId = options.randomizeIdentity
    ? `bi_${randomUUID().replace(/-/g, "").slice(0, 12)}`
    : createStableBrowserIdentityId(workflow?.id ?? "workflow");
  return {
    identity_id: identityId,
    display_name: `${workflow?.name ?? "Workflow"} identity`,
    profile_dir: identityId,
    fingerprint_seed: options.randomizeIdentity
      ? String(10000 + Math.floor(Math.random() * 90000))
      : stableFingerprintSeed(identityId),
    viewport_width: 1920,
    viewport_height: 947,
    device_scale_factor: 1,
    mobile: false,
    touch: false,
    timezone: null,
    locale: null,
    geoip: false,
    proxy_label: null,
    proxy_region: null,
    webrtc_policy: "default",
    webrtc_ip: null,
    storage_quota_mb: null,
    humanize: true,
    human_preset: "default",
    preflight_enabled: false,
    preflight_probe_url: null,
    preflight_allowed_origins: [],
    user_agent: null,
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

function positiveNumberOrDefault(value: unknown, defaultValue: number) {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : defaultValue;
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
    value === "explicit_ip" ||
    value === "disabled_if_supported"
  );
}

function browserProfileKey(settings: WorkflowSettings) {
  if (settings.browser_launch.session_mode !== "persistent_profile") return null;
  return settings.browser_launch.profile_dir?.trim() || settings.browser_launch.profile_name?.trim() || null;
}

function browserIdentityPreferences(
  browser: WorkflowSettingsBrowserLaunch,
): Pick<
  WorkflowSettingsBrowserLaunch,
  | "identity_id"
  | "display_name"
  | "profile_dir"
  | "fingerprint_seed"
  | "user_agent"
  | "viewport_width"
  | "viewport_height"
  | "device_scale_factor"
  | "mobile"
  | "touch"
  | "timezone"
  | "locale"
  | "geoip"
  | "proxy_label"
  | "proxy_region"
  | "webrtc_policy"
  | "webrtc_ip"
  | "storage_quota_mb"
  | "humanize"
  | "human_preset"
  | "preflight_enabled"
  | "preflight_probe_url"
  | "preflight_allowed_origins"
> {
  return {
    identity_id: browser.identity_id,
    display_name: browser.display_name,
    profile_dir: browser.profile_dir,
    fingerprint_seed: browser.fingerprint_seed,
    user_agent: browser.user_agent,
    viewport_width: browser.viewport_width,
    viewport_height: browser.viewport_height,
    device_scale_factor: browser.device_scale_factor,
    mobile: browser.mobile,
    touch: browser.touch,
    timezone: browser.timezone,
    locale: browser.locale,
    geoip: browser.geoip,
    proxy_label: browser.proxy_label,
    proxy_region: browser.proxy_region,
    webrtc_policy: browser.webrtc_policy,
    webrtc_ip: browser.webrtc_ip,
    storage_quota_mb: browser.storage_quota_mb,
    humanize: browser.humanize,
    human_preset: browser.human_preset,
    preflight_enabled: browser.preflight_enabled,
    preflight_probe_url: browser.preflight_probe_url,
    preflight_allowed_origins: browser.preflight_allowed_origins,
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
