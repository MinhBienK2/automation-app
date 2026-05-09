import fs from "node:fs/promises";
import path from "node:path";
import { dialog } from "electron";
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
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "../../src/types/workflow.js";
import type { AppPaths } from "./database.js";

export type CommandError = {
  message: string;
  field?: string | null;
};

export type WorkflowCommandHandlers = ReturnType<typeof createWorkflowCommandHandlers>;

type CommandContext = {
  appPaths: AppPaths;
  database: DatabaseSync;
};

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

const workflows = new Map<string, WorkflowSummary>();
const graphs = new Map<string, WorkflowGraph>();

export function createWorkflowCommandHandlers(context: CommandContext) {
  void context.database;

  return {
    listWorkflows() {
      return [...workflows.values()].sort((left, right) =>
        right.updated_at.localeCompare(left.updated_at) ||
        left.name.localeCompare(right.name),
      );
    },

    getWorkflow(id: string): WorkflowDetail | null {
      const workflow = workflows.get(id);
      if (!workflow) return null;

      return {
        workflow: toWorkflow(workflow),
        steps: [],
      };
    },

    getWorkflowBrowserConfig(workflowId: string): WorkflowBrowserConfig {
      ensureWorkflow(workflowId);
      return defaultBrowserConfig(workflowId);
    },

    saveWorkflowBrowserConfig(
      workflowId: string,
      _config: WorkflowBrowserConfig,
    ) {
      ensureWorkflow(workflowId);
    },

    getWorkflowSettings(workflowId: string): WorkflowSettings {
      const workflow = ensureWorkflow(workflowId);
      return defaultWorkflowSettings(workflow);
    },

    saveWorkflowSettings(
      workflowId: string,
      settings: WorkflowSettings,
    ): WorkflowSettings {
      const workflow = ensureWorkflow(workflowId);
      if (!settings.general.name.trim()) {
        throw commandError("Workflow name is required", "general.name");
      }
      const updated = {
        ...workflow,
        name: settings.general.name.trim(),
        updated_at: new Date().toISOString(),
      };
      workflows.set(workflowId, updated);
      return {
        ...settings,
        workflow_id: workflowId,
        general: {
          ...settings.general,
          name: updated.name,
          updated_at: updated.updated_at,
        },
        updated_at: updated.updated_at,
      };
    },

    saveWorkflowSettingsSection<Section extends WorkflowSettingsSectionId>(
      workflowId: string,
      section: Section,
      sectionValue: WorkflowSettings[Section],
    ): WorkflowSettings {
      const current = defaultWorkflowSettings(ensureWorkflow(workflowId));
      return this.saveWorkflowSettings(workflowId, {
        ...current,
        [section]: sectionValue,
      });
    },

    validateWorkflowSettings(settings: WorkflowSettings): SettingsValidationIssue[] {
      return settings.general.name.trim()
        ? []
        : [
            {
              section: "general",
              field: "name",
              level: "error",
              message: "Workflow name is required",
            },
          ];
    },

    validateWorkflowRun(workflowId: string) {
      ensureWorkflow(workflowId);
      return [];
    },

    createWorkflow(name: string): Workflow {
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }

      const now = new Date().toISOString();
      const id = crypto.randomUUID();
      const workflow: WorkflowSummary = {
        id,
        name: normalized,
        step_count: 0,
        created_at: now,
        updated_at: now,
      };
      workflows.set(id, workflow);
      graphs.set(id, createDraftGraph());
      return toWorkflow(workflow);
    },

    renameWorkflow(id: string, name: string) {
      const workflow = ensureWorkflow(id);
      const normalized = name.trim();
      if (!normalized) {
        throw commandError("Workflow name is required", "name");
      }
      workflows.set(id, {
        ...workflow,
        name: normalized,
        updated_at: new Date().toISOString(),
      });
    },

    deleteWorkflow(id: string) {
      workflows.delete(id);
      graphs.delete(id);
    },

    duplicateWorkflow(workflowId: string, name: string): WorkflowDetail {
      ensureWorkflow(workflowId);
      const created = this.createWorkflow(name);
      const sourceGraph = graphs.get(workflowId);
      if (sourceGraph) {
        graphs.set(created.id, structuredClone(sourceGraph));
      }
      return { workflow: created, steps: [] };
    },

    getWorkflowGraph(workflowId: string): WorkflowGraph {
      ensureWorkflow(workflowId);
      return structuredClone(graphs.get(workflowId) ?? createDraftGraph());
    },

    saveWorkflowGraph(workflowId: string, graph: WorkflowGraph) {
      const workflow = ensureWorkflow(workflowId);
      graphs.set(workflowId, structuredClone(graph));
      workflows.set(workflowId, {
        ...workflow,
        updated_at: new Date().toISOString(),
      });
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
      ensureWorkflow(workflowId);
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
      const workflow = ensureWorkflow(workflowId);
      return {
        version: 1,
        workflow: toWorkflow(workflow),
        steps: [],
      };
    },

    importWorkflow(exported: WorkflowExport): WorkflowDetail {
      const workflow = this.createWorkflow(exported.workflow.name);
      return { workflow, steps: [] };
    },

    exportWorkflowPackage(
      workflowId: string,
      options: WorkflowPackageExportOptions,
    ): WorkflowPackage {
      const workflow = ensureWorkflow(workflowId);
      const includedSections = [
        ...(options.include_flow ? ["flow"] : []),
        ...options.settings_sections.map((section) => `settings.${section}`),
      ];

      return {
        kind: "workflow_package",
        version: 2,
        workflow: { name: workflow.name },
        included_sections: includedSections,
        omitted_fields: [],
        flow: options.include_flow
          ? structuredClone(graphs.get(workflowId) ?? createDraftGraph())
          : null,
        settings: null,
      };
    },

    previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
      return {
        workflow_name: packageValue.workflow.name,
        includes_flow: Boolean(packageValue.flow),
        settings_sections: (packageValue.included_sections
          .filter((section) => section.startsWith("settings."))
          .map((section) => section.replace("settings.", ""))
          .filter(isWorkflowSettingsSection)) as WorkflowSettingsSectionId[],
        omitted_fields: packageValue.omitted_fields,
      };
    },

    importWorkflowPackage(
      packageValue: WorkflowPackage,
      _options: WorkflowPackageImportOptions,
    ): WorkflowDetail {
      const workflow = this.createWorkflow(`${packageValue.workflow.name} (imported)`);
      if (packageValue.flow) {
        graphs.set(workflow.id, structuredClone(packageValue.flow));
      }
      return { workflow, steps: [] };
    },

    runBatchWorkflow(
      _workflowId: string,
      request: BatchRunRequest,
    ) {
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
          reason: "Generated from Electron command stub.",
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
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: path.join(
          context.appPaths.rootDir,
          `${filenameFromWorkflowName(packageValue.workflow.name)}.workflow.json`,
        ),
        filters: [{ name: "Workflow package", extensions: ["json"] }],
        title: "Export Workflow",
      });
      if (canceled || !filePath) return null;

      await fs.writeFile(filePath, JSON.stringify(packageValue, null, 2), "utf8");
      return filePath;
    },
  };
}

export function serializeCommandError(error: unknown): CommandError {
  if (isCommandError(error)) return error;
  if (error instanceof Error) return { message: error.message };
  return { message: "Unexpected command error" };
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

function ensureWorkflow(id: string): WorkflowSummary {
  const workflow = workflows.get(id);
  if (!workflow) {
    throw commandError("Workflow not found", "workflowId");
  }
  return workflow;
}

function toWorkflow(summary: WorkflowSummary): Workflow {
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

function defaultWorkflowSettings(workflow: WorkflowSummary): WorkflowSettings {
  const browserConfig = defaultBrowserConfig(workflow.id);
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
    browser: {
      profile_name: browserConfig.profile_name,
      proxy_enabled: browserConfig.proxy_enabled,
      proxy_server: browserConfig.proxy_server,
      proxy_username: browserConfig.proxy_username,
      proxy_password: browserConfig.proxy_password,
      user_agent: browserConfig.user_agent,
      viewport_width: browserConfig.viewport_width,
      viewport_height: browserConfig.viewport_height,
      mobile: browserConfig.mobile,
      touch: browserConfig.touch,
      challenge_policy: browserConfig.challenge_policy,
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
    created_at: workflow.created_at,
    updated_at: workflow.updated_at,
  };
}

function isWorkflowSettingsSection(
  value: string,
): value is WorkflowSettingsSectionId {
  return [
    "general",
    "execution",
    "browser",
    "environment",
    "inputs",
    "triggers",
    "advanced",
  ].includes(value);
}

function filenameFromWorkflowName(name: string) {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "workflow";
}
