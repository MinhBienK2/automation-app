import path from "node:path";
import {
  compileGraphToRunPlan,
  validateGraph,
  type ElectronWorkflowGraph,
  type GraphNodeType,
} from "./graph.js";
import type { IdentityProfileRecord, StorageService, WorkflowRecord } from "./storage.js";
import { runPlan, type BrowserAutomationAdapter } from "../runner/runnerCore.js";
import type {
  ClickActionConfig,
  ExtractTextActionConfig,
  FillActionConfig,
  LocatorConfig,
  IdentityProfileSnapshot,
  RunnerEvent,
  RunnerActionConfig,
  RunnerResult,
  RunPlan,
  StartRunPayload,
  WaitActionConfig,
} from "../shared/product.js";

export type RunnerProcessClient = {
  startRun(payload: StartRunPayload, onEvent: (event: RunnerEvent) => void): Promise<RunnerResult>;
  cancelRun?: (input: { runId: string }) => Promise<{ ok: true }>;
};

export type AppApiOptions = {
  storage: StorageService;
  appDataDir: string;
  createAdapter: () => BrowserAutomationAdapter;
  runner?: RunnerProcessClient;
  onRunEvent?: (event: RunnerEvent) => void;
};

type LegacyActionConfig = {
  type: string;
  config: Record<string, unknown>;
};

type LegacyWorkflow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type LegacyWorkflowSummary = LegacyWorkflow & {
  step_count: number;
};

type LegacyWorkflowDetail = {
  workflow: LegacyWorkflow;
  steps: unknown[];
};

type LegacyGraphPort = {
  id: string;
  label: string;
  direction: "input" | "output";
};

type LegacyGraphNode = {
  id: string;
  node_type: string;
  label: string;
  position: { x: number; y: number };
  config: unknown;
  ports: LegacyGraphPort[];
  group_id?: string | null;
};

type LegacyGraphEdge = {
  id: string;
  source_node_id: string;
  source_port: string;
  target_node_id: string;
  target_port: string;
  label?: string | null;
  condition?: unknown;
};

type LegacyWorkflowGraph = {
  version: number;
  nodes: LegacyGraphNode[];
  edges: LegacyGraphEdge[];
  viewport: { x: number; y: number; zoom: number };
};

type LegacyGraphValidationIssue = {
  level: "error" | "warning";
  node_id?: string | null;
  edge_id?: string | null;
  message: string;
};

type LegacyCompiledWorkflowGraph = {
  steps: Array<{
    node_id: string;
    label: string;
    config: LegacyActionConfig;
  }>;
};

type LegacyRunState = {
  status: "idle" | "running" | "success" | "failed" | "stopped";
  mode: "none" | "run_workflow" | "test_step";
  target_step_id: string | null;
  current_step_id: string | null;
  current_step_number: number | null;
  completed_step_ids: string[];
  outputs?: Record<string, unknown>;
  error: null | {
    step_id?: string | null;
    step_number: number;
    step_name?: string | null;
    action_type: string;
    reason: string;
  };
};

type RunStateWithId = LegacyRunState & {
  run_id?: string;
};

type LegacyWorkflowSettings = Record<string, unknown> & {
  workflow_id: string;
  version: number;
  general: Record<string, unknown>;
  execution: Record<string, unknown>;
  browser: Record<string, unknown>;
  environment: Record<string, unknown>;
  inputs: Record<string, unknown>;
  triggers: Record<string, unknown>;
  advanced: Record<string, unknown>;
};

function defaultSettings(workflow: WorkflowRecord): LegacyWorkflowSettings {
  return {
    workflow_id: workflow.id,
    version: 1,
    general: {
      name: workflow.name,
      description: workflow.description,
      tags: workflow.tags,
      notes: workflow.notes,
      created_at: workflow.createdAt,
      updated_at: workflow.updatedAt,
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
      profile_name: null,
      proxy_enabled: false,
      proxy_server: null,
      proxy_username: null,
      proxy_password: null,
      user_agent: null,
      viewport_width: 1280,
      viewport_height: 720,
      mobile: false,
      touch: false,
      challenge_policy: "none",
      headless: true,
      fingerprint_preflight_enabled: false,
      fingerprint_probe_url: null,
      fingerprint_profile_id: null,
      fingerprint_allowed_origins: [],
      fingerprint_proxy_label: null,
      fingerprint_proxy_region: null,
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
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
  };
}

function workflowSettings(options: AppApiOptions, workflowId: string): LegacyWorkflowSettings {
  const workflow = options.storage.getWorkflow(workflowId);
  const stored = options.storage.loadWorkflowSettings(workflowId);
  if (!stored) return defaultSettings(workflow);
  return {
    ...defaultSettings(workflow),
    ...stored,
    workflow_id: workflowId,
  } as LegacyWorkflowSettings;
}

export type AppApi = ReturnType<typeof createAppApi>;

function toLegacyWorkflow(workflow: WorkflowRecord): LegacyWorkflow {
  return {
    id: workflow.id,
    name: workflow.name,
    created_at: workflow.createdAt,
    updated_at: workflow.updatedAt,
  };
}

function toLegacySummary(workflow: WorkflowRecord): LegacyWorkflowSummary {
  return {
    ...toLegacyWorkflow(workflow),
    step_count: 0,
  };
}

function toPort(id: string, direction: LegacyGraphPort["direction"]): LegacyGraphPort {
  return {
    id,
    label: id,
    direction,
  };
}

function toLegacyActionConfig(config: RunnerActionConfig): LegacyActionConfig {
  switch (config.type) {
    case "navigate":
      return {
        type: "navigate",
        config: {
          url: config.url,
          timeout_ms: config.timeoutMs ?? null,
        },
      };
    case "click":
      return {
        type: "click",
        config: {
          xpath: config.locator.strategy === "xpath" ? config.locator.value : "",
          target: null,
          iframe_xpath: null,
          timeout_ms: config.timeoutMs ?? null,
        },
      };
    case "fill":
      return {
        type: "input_text",
        config: {
          xpath: config.locator.strategy === "xpath" ? config.locator.value : "",
          target: null,
          iframe_xpath: null,
          text: config.value,
          clear_before_input: true,
          timeout_ms: config.timeoutMs ?? null,
        },
      };
    case "wait":
      return {
        type: "wait",
        config: {
          condition: config.durationMs ? "duration" : "page_load",
          duration_ms: config.durationMs ?? null,
          url: config.url ?? null,
          timeout_ms: config.timeoutMs ?? null,
          xpath: config.locator?.strategy === "xpath" ? config.locator.value : null,
          target: null,
        },
      };
    case "take_screenshot":
      return {
        type: "take_screenshot",
        config: {
          path: config.fileName ?? "screenshot.png",
          output_name: null,
          full_page: config.fullPage ?? true,
        },
      };
    case "extract_text":
      return {
        type: "extract_text",
        config: {
          xpath: config.locator.strategy === "xpath" ? config.locator.value : "",
          target: null,
          iframe_xpath: null,
          output_name: config.outputName,
          timeout_ms: config.timeoutMs ?? null,
        },
      };
  }
}

function toLegacyGraph(graph: ElectronWorkflowGraph): LegacyWorkflowGraph {
  return {
    version: graph.schemaVersion,
    nodes: graph.nodes.map<LegacyGraphNode>((node) => ({
      id: node.id,
      node_type: node.type === "terminal" ? "end_success" : node.type,
      label: node.label,
      position: node.position,
      config:
        node.type === "action" && node.config
          ? toLegacyActionConfig(node.config as RunnerActionConfig)
          : node.config,
      ports: [
        ...(node.ports.inputs ?? []).map((port) => toPort(port, "input")),
        ...(node.ports.outputs ?? []).map((port) => toPort(port, "output")),
      ],
      group_id: null,
    })),
    edges: graph.edges.map<LegacyGraphEdge>((edge) => ({
      id: edge.id,
      source_node_id: edge.sourceNodeId,
      source_port: edge.sourcePort,
      target_node_id: edge.targetNodeId,
      target_port: edge.targetPort,
      label: edge.label ?? null,
      condition: null,
    })),
    viewport: graph.viewport,
  };
}

function locatorFromLegacyConfig(config: Record<string, unknown>): LocatorConfig {
  const target = config.target as { strategy?: unknown; value?: unknown; selector?: unknown } | undefined;
  if (target?.strategy && target.value) {
    return {
      strategy: target.strategy === "test_id" ? "testId" : (target.strategy as LocatorConfig["strategy"]),
      value: String(target.value),
      filters: { visible: true },
      fallbacks: [],
    };
  }

  const xpath = typeof config.xpath === "string" ? config.xpath : "";
  return {
    strategy: "xpath",
    value: xpath,
    filters: { visible: true },
    fallbacks: [],
  };
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function fromLegacyActionConfig(value: unknown): RunnerActionConfig | null {
  const action = asRecord(value);
  const type = action.type;
  const config = asRecord(action.config);

  switch (type) {
    case "navigate":
      return {
        type: "navigate",
        url: String(config.url ?? ""),
        timeoutMs: Number(config.timeout_ms ?? 0) || undefined,
      };
    case "click": {
      const clickConfig: ClickActionConfig = {
        type: "click",
        locator: locatorFromLegacyConfig(config),
        timeoutMs: Number(config.timeout_ms ?? 0) || undefined,
      };
      return clickConfig;
    }
    case "input_text":
    case "fill": {
      const fillConfig: FillActionConfig = {
        type: "fill",
        locator: locatorFromLegacyConfig(config),
        value: String(config.text ?? config.value ?? ""),
        timeoutMs: Number(config.timeout_ms ?? 0) || undefined,
      };
      return fillConfig;
    }
    case "wait": {
      const waitConfig: WaitActionConfig = {
        type: "wait",
        durationMs: Number(config.duration_ms ?? 0) || undefined,
        url: typeof config.url === "string" ? config.url : undefined,
        timeoutMs: Number(config.timeout_ms ?? 0) || undefined,
      };
      return waitConfig;
    }
    case "take_screenshot":
      return {
        type: "take_screenshot",
        fileName: String(config.file_name ?? config.path ?? "screenshot.png"),
        fullPage: typeof config.full_page === "boolean" ? config.full_page : true,
      };
    case "extract_text": {
      const extractConfig: ExtractTextActionConfig = {
        type: "extract_text",
        locator: locatorFromLegacyConfig(config),
        outputName: String(config.output_name ?? "text"),
        timeoutMs: Number(config.timeout_ms ?? 0) || undefined,
      };
      return extractConfig;
    }
    default:
      return null;
  }
}

function fromLegacyGraph(graph: LegacyWorkflowGraph): ElectronWorkflowGraph {
  const toGraphNodeType = (nodeType: string): GraphNodeType => {
    if (nodeType === "end_success" || nodeType === "end_failure") return "terminal";
    if (
      nodeType === "start" ||
      nodeType === "action" ||
      nodeType === "logic" ||
      nodeType === "variable" ||
      nodeType === "checkpoint" ||
      nodeType === "terminal" ||
      nodeType === "subworkflow"
    ) {
      return nodeType;
    }
    return "logic";
  };

  return {
    schemaVersion: 1,
    nodes: graph.nodes.map((node) => ({
      id: node.id,
      type: toGraphNodeType(node.node_type),
      label: node.label,
      position: node.position,
      config: node.node_type === "action" ? fromLegacyActionConfig(node.config) : asRecord(node.config),
      ports: {
        inputs: node.ports.filter((port) => port.direction === "input").map((port) => port.id),
        outputs: node.ports.filter((port) => port.direction === "output").map((port) => port.id),
      },
      ui: {},
    })),
    edges: graph.edges.map((edge) => ({
      id: edge.id,
      sourceNodeId: edge.source_node_id,
      sourcePort: edge.source_port,
      targetNodeId: edge.target_node_id,
      targetPort: edge.target_port,
      label: edge.label ?? undefined,
      metadata: {},
    })),
    viewport: graph.viewport,
    metadata: {},
  };
}

function graphIssuesToLegacy(graph: ElectronWorkflowGraph): LegacyGraphValidationIssue[] {
  return validateGraph(graph).map((issue) => ({
    level: issue.level,
    node_id: issue.nodeId ?? null,
    edge_id: issue.edgeId ?? null,
    message: issue.message,
  }));
}

function compiledToLegacy(plan: RunPlan): LegacyCompiledWorkflowGraph {
  return {
    steps: plan.steps.map((step) => ({
      node_id: step.sourceNodeId,
      label: step.label,
      config: toLegacyActionConfig(step.config),
    })),
  };
}

function artifactDirectories(appDataDir: string, runId: string) {
  const root = path.join(appDataDir, "artifacts", "runs", runId);
  return {
    root,
    screenshots: path.join(root, "screenshots"),
    downloads: path.join(root, "downloads"),
    traces: path.join(root, "traces"),
    evidence: path.join(root, "evidence"),
  };
}

function defaultIdentitySnapshot(): IdentityProfileSnapshot {
  return {
    id: "id_default",
    name: "Default CloakBrowser",
    browserEngine: "cloakbrowser",
    headless: true,
    viewport: { width: 1280, height: 720 },
    profileReuseEnabled: false,
  };
}

function numberField(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function stringField(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function identitySnapshotFromProfile(profile: IdentityProfileRecord): IdentityProfileSnapshot {
  const deviceIdentity = profile.deviceIdentity;
  const viewport = deviceIdentity.viewport as { width?: unknown; height?: unknown } | undefined;
  const width = numberField(viewport?.width);
  const height = numberField(viewport?.height);
  const locale = profile.locale;
  const proxyReference = profile.proxyReference;
  const proxyServer = stringField(proxyReference.server);
  const preflightPolicy = profile.preflightPolicy;
  const preflightEnabled = preflightPolicy.enabled === true;
  const preflightProbeUrl = stringField(preflightPolicy.probeUrl);
  const preflightAllowedOrigins = Array.isArray(preflightPolicy.allowedOrigins)
    ? preflightPolicy.allowedOrigins.map(String)
    : [];

  return {
    id: profile.id,
    name: profile.name,
    browserEngine: "cloakbrowser",
    headless:
      profile.headedPolicy === "headed_only"
        ? false
        : profile.headedPolicy === "headless_only"
          ? true
          : typeof deviceIdentity.headless === "boolean"
            ? deviceIdentity.headless
            : true,
    viewport: width && height ? { width, height } : undefined,
    userAgent: stringField(deviceIdentity.userAgent),
    locale: stringField(locale.locale),
    timezone: stringField(locale.timezone),
    proxy: proxyServer
      ? {
          server: proxyServer,
          username: stringField(proxyReference.username),
          label: stringField(proxyReference.label),
          region: stringField(proxyReference.region),
        }
      : null,
    profileReuseEnabled: Boolean(profile.persistentProfilePath),
    persistentProfilePath: profile.persistentProfilePath,
    preflightPolicy:
      preflightEnabled && preflightProbeUrl
        ? {
            enabled: true,
            probeUrl: preflightProbeUrl,
            allowedOrigins: preflightAllowedOrigins,
            verdictLocator: asRecord(preflightPolicy.verdictLocator) as LocatorConfig | undefined,
          }
        : undefined,
  };
}

export function createAppApi(options: AppApiOptions) {
  let lastRunState: RunStateWithId = {
    status: "idle",
    mode: "none",
    target_step_id: null,
    current_step_id: null,
    current_step_number: null,
    completed_step_ids: [],
    outputs: {},
    error: null,
  };
  let activeRunId: string | null = null;

  return {
    workflows: {
      async list() {
        return options.storage.listWorkflows().map(toLegacySummary);
      },

      async get(input: { id: string }): Promise<LegacyWorkflowDetail | null> {
        try {
          return {
            workflow: toLegacyWorkflow(options.storage.getWorkflow(input.id)),
            steps: [],
          };
        } catch {
          return null;
        }
      },

      async create(input: { name: string }) {
        return toLegacyWorkflow(options.storage.createWorkflow({ name: input.name }));
      },

      async rename(input: { id: string; name: string }) {
        const workflow = options.storage.updateWorkflow(input.id, { name: input.name });
        const settings = workflowSettings(options, workflow.id);
        options.storage.saveWorkflowSettings(workflow.id, {
          ...settings,
          general: {
            ...settings.general,
            name: workflow.name,
            updated_at: workflow.updatedAt,
          },
        });
      },

      async duplicate(input: { workflowId: string; name: string }): Promise<LegacyWorkflowDetail> {
        const workflow = options.storage.duplicateWorkflow(input.workflowId, input.name);
        return {
          workflow: toLegacyWorkflow(workflow),
          steps: [],
        };
      },

      async delete(input: { id: string }) {
        options.storage.softDeleteWorkflow(input.id);
      },
    },

    settings: {
      async get(input: { workflowId: string }) {
        return workflowSettings(options, input.workflowId);
      },

      async save(input: { workflowId: string; settings: LegacyWorkflowSettings }) {
        const general = input.settings.general;
        const workflow = options.storage.updateWorkflow(input.workflowId, {
          name: typeof general.name === "string" ? general.name : undefined,
          description:
            typeof general.description === "string" ? general.description : undefined,
          tags: Array.isArray(general.tags) ? general.tags.map(String) : undefined,
          notes: typeof general.notes === "string" ? general.notes : undefined,
        });
        const saved = {
          ...input.settings,
          workflow_id: workflow.id,
          general: {
            ...general,
            name: workflow.name,
            description: workflow.description,
            tags: workflow.tags,
            notes: workflow.notes,
            updated_at: workflow.updatedAt,
          },
        };
        options.storage.saveWorkflowSettings(input.workflowId, saved);
        return saved;
      },

      async saveSection(input: {
        workflowId: string;
        section: string;
        sectionValue: Record<string, unknown>;
      }) {
        const current = workflowSettings(options, input.workflowId);
        let saved = {
          ...current,
          [input.section]: input.sectionValue,
        } as LegacyWorkflowSettings;
        if (input.section === "general") {
          const general = input.sectionValue;
          const workflow = options.storage.updateWorkflow(input.workflowId, {
            name: typeof general.name === "string" ? general.name : undefined,
            description:
              typeof general.description === "string" ? general.description : undefined,
            tags: Array.isArray(general.tags) ? general.tags.map(String) : undefined,
            notes: typeof general.notes === "string" ? general.notes : undefined,
          });
          saved = {
            ...saved,
            general: {
              ...general,
              name: workflow.name,
              description: workflow.description,
              tags: workflow.tags,
              notes: workflow.notes,
              updated_at: workflow.updatedAt,
            },
          };
        }
        options.storage.saveWorkflowSettings(input.workflowId, saved);
        return workflowSettings(options, input.workflowId);
      },

      async validate() {
        return [];
      },

      async validateRun(input: { workflowId: string }) {
        const graph = options.storage.loadActiveGraph(input.workflowId);
        return graph ? graphIssuesToLegacy(graph) : [];
      },
    },

    profiles: {
      async list() {
        return options.storage.listIdentityProfiles();
      },

      async get(input: { id: string }) {
        return options.storage.getIdentityProfile(input.id);
      },

      async create(input: Parameters<typeof options.storage.createIdentityProfile>[0]) {
        return options.storage.createIdentityProfile(input);
      },

      async update(input: {
        id: string;
        profile: Parameters<typeof options.storage.updateIdentityProfile>[1];
      }) {
        return options.storage.updateIdentityProfile(input.id, input.profile);
      },

      async delete(input: { id: string }) {
        options.storage.deleteIdentityProfile(input.id);
      },

      async validate(input: {
        profile: Parameters<typeof options.storage.validateIdentityProfile>[0];
      }) {
        return options.storage.validateIdentityProfile(input.profile);
      },
    },

    evidence: {
      async listEvents(input: { runId: string }) {
        return options.storage.listRunEvents(input.runId);
      },

      async listArtifacts(input: { runId: string }) {
        return options.storage.listArtifacts(input.runId);
      },

      async exportRun(input: { runId: string }) {
        return options.storage.exportRunEvidence(input.runId);
      },

      async sanitize(input: { payload: Record<string, unknown> }) {
        return options.storage.sanitizeEvidencePayload(input.payload);
      },
    },

    graphs: {
      async loadActive(input: { workflowId: string }) {
        const graph = options.storage.loadActiveGraph(input.workflowId);
        if (!graph) throw new Error(`Workflow '${input.workflowId}' has no active graph.`);
        return toLegacyGraph(graph);
      },

      async save(input: { workflowId: string; graph: LegacyWorkflowGraph }) {
        options.storage.saveActiveGraph(input.workflowId, fromLegacyGraph(input.graph), "user_save");
      },

      async validate(input: { graph: LegacyWorkflowGraph }) {
        return graphIssuesToLegacy(fromLegacyGraph(input.graph));
      },

      async compile(input: { graph: LegacyWorkflowGraph }) {
        const graph = fromLegacyGraph(input.graph);
        const plan = compileGraphToRunPlan({
          workflowId: "workflow_preview",
          graphVersionId: "graph_preview",
          graph,
        });
        return compiledToLegacy(plan);
      },
    },

    runs: {
      async list(input: { workflowId?: string; limit?: number } = {}) {
        return options.storage.listRuns(input);
      },

      async start(input: { workflowId: string }): Promise<RunStateWithId> {
        const graph = options.storage.loadActiveGraph(input.workflowId);
        if (!graph) throw new Error(`Workflow '${input.workflowId}' has no active graph.`);
        const workflow = options.storage.getWorkflow(input.workflowId);
        const activeVersion = options.storage.getActiveGraphVersion(input.workflowId);
        const plan = compileGraphToRunPlan({
          workflowId: input.workflowId,
          graphVersionId: activeVersion.id,
          graph,
        });
        const identityProfileSnapshot = workflow.defaultIdentityProfileId
          ? identitySnapshotFromProfile(options.storage.getIdentityProfile(workflow.defaultIdentityProfileId))
          : defaultIdentitySnapshot();
        const operatorPolicySnapshot = options.storage.getWorkspacePolicy();
        const run = options.storage.createRun({
          workflowId: input.workflowId,
          graphVersionId: activeVersion.id,
          runProfileSnapshot: { timeoutMs: 30_000 },
          identityProfileSnapshot,
          environmentSnapshot: { initialVariables: {} },
          operatorLabel: "local",
        });
        activeRunId = run.id;
        const completedStepIds: string[] = [];
        const payload: StartRunPayload = {
          protocolVersion: 1,
          runId: run.id,
          workflowId: input.workflowId,
          runPlan: plan,
          runProfileSnapshot: {
            timeoutMs: 30_000,
            evidencePolicy: { screenshots: true },
            browserRetention: "close",
          },
          identityProfileSnapshot,
          environmentSnapshot: { initialVariables: {} },
          artifactDirectories: artifactDirectories(options.appDataDir, run.id),
          operatorPolicySnapshot,
        };

        const persistEvent = (event: RunnerEvent) => {
          const persisted = options.storage.appendRunEvent(run.id, {
            type: event.type,
            severity: event.severity,
            nodeId: event.nodeId ?? null,
            actionId: event.actionId ?? null,
            payload: event.payload,
          });

          if (event.type === "step.completed" && event.nodeId) {
            completedStepIds.push(event.nodeId);
          }

          if (event.type === "artifact.created") {
            options.storage.registerArtifact({
              runId: run.id,
              eventId: persisted.id,
              type: String(event.payload.type),
              relativePath: String(event.payload.relativePath),
              mimeType: String(event.payload.mimeType),
              sizeBytes: Number(event.payload.sizeBytes),
              checksum: String(event.payload.checksum),
              sanitized: event.payload.sanitized === true,
            });
          }

          if (event.type === "preflight.verdictReceived") {
            options.storage.createEvidenceRecord({
              runId: run.id,
              evidenceType: "preflight_verdict",
              payload: {
                ...event.payload,
                eventId: persisted.id,
              },
            });
          }

          options.onRunEvent?.(event);
        };

        const result = options.runner
          ? await options.runner.startRun(payload, persistEvent)
          : await runPlan(payload, options.createAdapter(), {
              emit: persistEvent,
            });
        options.storage.finishRun(run.id, {
          status: result.status,
          terminalReason: result.reason ?? null,
        });
        if (activeRunId === run.id) {
          activeRunId = null;
        }

        lastRunState = {
          run_id: run.id,
          status:
            result.status === "completed"
              ? "success"
              : result.status === "cancelled"
                ? "stopped"
                : "failed",
          mode: "run_workflow",
          target_step_id: null,
          current_step_id: null,
          current_step_number: null,
          completed_step_ids: completedStepIds,
          outputs: {},
          error:
            result.status === "failed"
              ? {
                  step_number: completedStepIds.length + 1,
                  action_type: "workflow",
                  reason: result.reason ?? "Run failed.",
                }
              : null,
        };
        return lastRunState;
      },

      async stop() {
        const runId = activeRunId;
        if (runId && options.runner?.cancelRun) {
          await options.runner.cancelRun({ runId });
        }
        lastRunState = {
          ...lastRunState,
          status: "stopped",
          current_step_id: null,
          current_step_number: null,
          error: null,
        };
        return lastRunState;
      },

      async getState() {
        return lastRunState;
      },
    },
  };
}
