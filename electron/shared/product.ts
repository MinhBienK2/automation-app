export type ProductErrorCategory =
  | "validation"
  | "startup"
  | "runtime"
  | "policy"
  | "cancellation"
  | "system";

export type RunEventSeverity = "debug" | "info" | "warning" | "error";

export type Point = {
  x: number;
  y: number;
};

export type Viewport = Point & {
  zoom: number;
};

export type LocatorStrategy =
  | "role"
  | "label"
  | "placeholder"
  | "text"
  | "testId"
  | "css"
  | "xpath"
  | "attribute";

export type LocatorConfig = {
  strategy: LocatorStrategy;
  value: string;
  name?: string | null;
  exact?: boolean;
  frame?: string | null;
  filters?: {
    hasText?: string | null;
    visible?: boolean;
    index?: number | null;
  };
  fallbacks?: LocatorConfig[];
};

export type NavigateActionConfig = {
  type: "navigate";
  url: string;
  timeoutMs?: number;
};

export type ClickActionConfig = {
  type: "click";
  locator: LocatorConfig;
  timeoutMs?: number;
};

export type FillActionConfig = {
  type: "fill";
  locator: LocatorConfig;
  value: string;
  timeoutMs?: number;
};

export type WaitActionConfig = {
  type: "wait";
  durationMs?: number;
  url?: string;
  locator?: LocatorConfig;
  timeoutMs?: number;
};

export type ScreenshotActionConfig = {
  type: "take_screenshot";
  fileName?: string;
  fullPage?: boolean;
};

export type ExtractTextActionConfig = {
  type: "extract_text";
  locator: LocatorConfig;
  outputName: string;
  timeoutMs?: number;
};

export type RunnerActionConfig =
  | NavigateActionConfig
  | ClickActionConfig
  | FillActionConfig
  | WaitActionConfig
  | ScreenshotActionConfig
  | ExtractTextActionConfig;

export type RunnerActionType = RunnerActionConfig["type"];

export type RunPlanStep = {
  id: string;
  sourceNodeId: string;
  actionType: RunnerActionType;
  label: string;
  config: RunnerActionConfig;
  timeoutMs?: number | null;
  retry?: {
    attempts: number;
    intervalMs: number;
  } | null;
  evidenceTags?: string[];
};

export type RunPlan = {
  schemaVersion: 1;
  workflowId: string;
  graphVersionId: string;
  steps: RunPlanStep[];
  nodeMap: Record<string, string>;
};

export type RunProfileSnapshot = {
  timeoutMs?: number;
  evidencePolicy?: {
    screenshots?: boolean;
    strict?: boolean;
  };
  browserRetention?: "retain" | "close";
};

export type IdentityProfileSnapshot = {
  id: string;
  name: string;
  browserEngine: "cloakbrowser";
  headless: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  userAgent?: string | null;
  locale?: string | null;
  timezone?: string | null;
  proxy?: {
    server: string;
    username?: string | null;
    password?: string | null;
    label?: string | null;
    region?: string | null;
  } | null;
  profileReuseEnabled: boolean;
  persistentProfilePath?: string | null;
};

export type EnvironmentSnapshot = {
  initialVariables?: Record<string, unknown>;
  permissions?: string[];
  locale?: string | null;
  timezone?: string | null;
  extraHTTPHeaders?: Record<string, string>;
};

export type ArtifactDirectories = {
  root: string;
  screenshots: string;
  downloads: string;
  traces: string;
  evidence: string;
};

export type OperatorPolicySnapshot = {
  allowedOrigins: string[];
  maxConcurrency: number;
};

export type StartRunPayload = {
  protocolVersion: 1;
  runId: string;
  workflowId: string;
  runPlan: RunPlan;
  runProfileSnapshot: RunProfileSnapshot;
  identityProfileSnapshot: IdentityProfileSnapshot;
  environmentSnapshot: EnvironmentSnapshot;
  artifactDirectories: ArtifactDirectories;
  operatorPolicySnapshot: OperatorPolicySnapshot;
};

export type RunnerTerminalStatus = "completed" | "failed" | "cancelled";

export type RunnerResult = {
  runId: string;
  status: RunnerTerminalStatus;
  reason?: string;
};

export type RunnerEvent = {
  type: string;
  severity: RunEventSeverity;
  runId: string;
  nodeId?: string | null;
  actionId?: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ArtifactRecordInput = {
  runId: string;
  eventId?: string | null;
  type: string;
  relativePath: string;
  mimeType: string;
  sizeBytes: number;
  checksum: string;
  sanitized: boolean;
};
