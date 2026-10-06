import type { SurfaceStepTrace } from "../../../runtime/actionTrace.js";
import type { VariableScope } from "../../../runtime/actionRuntime.js";
import type { ExecutionSurface } from "../../../runtime/surface.js";

export type DesktopRuntime = VariableScope & {
  surface: ExecutionSurface;
  runId: string;
  currentStepNumber: number | null;
  currentStepId: string | null;
  currentSurfaceTrace: SurfaceStepTrace | null;
};

export type StepScope = VariableScope & {
  currentSurfaceTrace: SurfaceStepTrace | null;
  signal?: AbortSignal;
};

export function noteTrace(runtime: StepScope, fields: Partial<SurfaceStepTrace>): void {
  runtime.currentSurfaceTrace = { ...(runtime.currentSurfaceTrace ?? {}), ...fields };
}

export type ResolvedTarget = {
  elementToken?: string;
  x?: number;
  y?: number;
  warnings: string[];
};

export type LocatorConfig = {
  role: string;
  name?: { kind: "exact" | "prefix" | "pattern"; value: string } | null;
  ancestors?: Array<{ role: string; name?: { kind: string; value: string } | null }> | null;
  ordinal?: number | null;
  automation_id?: string | null;
};

export type StepConfig = {
  target:
    | { kind: "element"; locator: LocatorConfig }
    | { kind: "pixel"; x: number; y: number; origin: "window" };
  expect?: unknown[] | null;
  timeout_ms?: number | null;
};

export type DesktopExecutorDependencies<Runtime> = {
  evidenceDir: string;
  recordEvidence: (
    runtime: Runtime,
    artifact: {
      actionType: string;
      artifactKind: "screenshot" | "download";
      relativePath: string;
    },
  ) => void;
};
