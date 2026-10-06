import type {
  ActionConfig,
  CompiledStepMetadata,
  CompiledWorkflowGraph,
  RunMode,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../db/database.js";
import {
  requireWebSurface,
  type ExecutionSurface,
  type BrowserDriver,
} from "./surface.js";
import type { CloakHumanScrollAdapter } from "./interactionActions.js";
import type { RunnerActionRuntime } from "./runnerActionExecutors.js";
import type { ActionTrace } from "./actionTrace.js";
import type { RunEvidenceArtifact } from "./runnerEvidence.js";

export type {
  BrowserDriver,
  BrowserDriverLocator,
  BrowserDriverFrameLocator,
} from "./surface.js";

export type BrowserLaunchOptions = Record<string, unknown>;

export type SessionManagerPort = {
  closeRetainedContext?(): Promise<void>;
  closeRetainedSession?(workflowId: string | null, profileName: string | null): Promise<void>;
  hasReusableRetainedSession?(workflowId: string, profileName?: string | null): boolean;
  getRetainedSessionState?(workflowId?: string | null, profileName?: string | null): RunState["retained_session"];
  getRetainedSessionStates?(): NonNullable<RunState["retained_session"]>[];
  createIsolatedManager?(): SessionManagerPort;
};

export type RunnerOptions = {
  appPaths: AppPaths;
  driver?: BrowserDriver;
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>;
  random?: () => number;
  cloakHumanScroll?: CloakHumanScrollAdapter;
  openSurface?: (request: RunnerRunRequest) => Promise<OpenedSurface>;
  sessionManager?: SessionManagerPort;
  retainedSessions?: Map<string, any>;
  usesDefaultDriver?: boolean;
};

/**
 * A surface the runner did not open itself.
 *
 * This is how Execution Surfaces reach the runner without `runtime/`
 * importing driver implementations directly — ADR-0001 forbids that, and the
 * ban is what keeps this module surface-independent. The caller binds a surface
 * into an opener closure; the runner only ever sees a surface and a way to close it.
 */
export type OpenedSurface = {
  surface: ExecutionSurface;
  /** Shown to the operator before the first action — a degraded tier, say. */
  warnings?: string[];
  outputs?: Record<string, unknown>;
  retainedSessionState?: () => RunState["retained_session"];
  close(options?: { status?: RunState["status"]; forceClose?: boolean }): Promise<void>;
};

export type RunnerRunRequest = {
  runId?: string | null;
  graph: CompiledWorkflowGraph;
  settings: WorkflowSettings;
  mode: RunMode;
  targetStepId?: string | null;
  reuseRetainedSession?: boolean;
  retainedSessionWorkflowId?: string | null;
  signal?: AbortSignal;
  onProgress?: (state: Partial<RunState>) => void;
  /**
   * Supplied for a non-web run. Its presence is what makes this a desktop run:
   * the browser is never launched, and none of the retained-session machinery
   * applies, because a desktop application is not ours to retain.
   */
  openSurface?: () => Promise<OpenedSurface>;
};

export function webSurfaceOf(runtime: Pick<RunnerActionRuntime, "surface">) {
  return requireWebSurface(runtime.surface);
}

export function sensitivityOf(config: ActionConfig): boolean | null {
  if ("config" in config && config.config && typeof config.config === "object" && "sensitive" in config.config) {
    const sensitive = config.config.sensitive;
    return typeof sensitive === "boolean" ? sensitive : null;
  }
  return null;
}

export type Runtime = RunnerActionRuntime & {
  domainPolicy: { allowed_domains: string[] } | null;
  traces: ActionTrace[];
  evidence: RunEvidenceArtifact[];
  liveState: RunState;
  onProgress?: (state: Partial<RunState>) => void;
  failedStepInfo?: {
    step_id: string;
    step_name: string;
    action_type: string;
    action_summary: string | null;
    metadata: CompiledStepMetadata | null;
    parent_step_id?: string | null;
    parent_step_ids?: string[] | null;
  } | null;
};

export class RunnerStop extends Error {
  status: "success" | "failure" | "stopped";
  closeBrowser: boolean;

  constructor(status: "success" | "failure" | "stopped", message: string, closeBrowser = false) {
    super(message);
    this.status = status;
    this.closeBrowser = closeBrowser;
  }
}

export class LoopControl extends Error {
  kind: "break" | "continue";

  constructor(kind: "break" | "continue") {
    super(`${kind}_loop`);
    this.kind = kind;
  }
}

export function isAbortError(error: unknown): boolean {
  if (error instanceof Error && error.name === "AbortError") return true;
  if (typeof error === "object" && error !== null && "name" in error) {
    return error.name === "AbortError";
  }
  return false;
}
