import type { DesktopSurface } from "../../../runtime/surface.js";
import { captureDesktopScreenshot, isSensitiveStep } from "../evidence.js";
import { resolveDesktopLocator } from "../locator.js";
import { snapshotWarnings, tierOf } from "../snapshot.js";
import { pointFromSnapshot, resolveOrThrow, resolvePoint, resolveStep } from "./targetResolution.js";
import { verify } from "./stateVerification.js";
import {
  noteTrace,
  type DesktopExecutorDependencies,
  type DesktopRuntime,
  type StepConfig,
  type StepScope,
} from "./types.js";

export async function hoverOver(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig,
): Promise<void> {
  const point = await resolvePoint(desktop, config.target, runtime, "desktop_hover");
  await desktop.driver.moveCursor(desktop.binding, { x: point.x, y: point.y }, runtime.signal);
  await verify(desktop, config, runtime);
}

export async function scrollAt(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig & {
    direction: "up" | "down" | "left" | "right";
    by?: "line" | "page" | null;
    amount?: number | null;
  },
): Promise<void> {
  const point = await resolvePoint(desktop, config.target, runtime, "desktop_scroll");
  await desktop.driver.scroll(
    desktop.binding,
    {
      x: point.x,
      y: point.y,
      direction: config.direction,
      by: config.by ?? undefined,
      amount: config.amount ?? undefined,
    },
    runtime.signal,
  );
  await verify(desktop, config, runtime);
}

export async function dragBetween(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig & {
    to: StepConfig["target"];
    button?: "left" | "right" | "middle" | null;
    duration_ms?: number | null;
    steps?: number | null;
  },
): Promise<void> {
  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  noteTrace(runtime, { tier: tierOf(snapshot) });
  const from = pointFromSnapshot(snapshot, config.target, runtime, "desktop_drag (from)");
  const to = pointFromSnapshot(snapshot, config.to, runtime, "desktop_drag (to)");
  await desktop.driver.drag(
    desktop.binding,
    {
      fromX: from.x,
      fromY: from.y,
      toX: to.x,
      toY: to.y,
      button: config.button ?? undefined,
      durationMs: config.duration_ms ?? undefined,
      steps: config.steps ?? undefined,
    },
    runtime.signal,
  );
  await verify(desktop, config, runtime);
}

export async function readClipboard(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: { output_name: string },
): Promise<void> {
  const clipboard = await desktop.driver.readClipboard(runtime.signal);
  noteTrace(runtime, { verified: true });
  runtime.outputs[config.output_name] = clipboard.supported ? (clipboard.text ?? "") : "";
}

export async function setClipboard(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: { text: string },
): Promise<void> {
  await desktop.driver.writeClipboard({ text: config.text }, runtime.signal);
  const readback = await desktop.driver.readClipboard(runtime.signal);
  const verified = readback.supported && readback.text === config.text;
  noteTrace(runtime, { verified });
  if (!verified) {
    throw new Error(
      "desktop_set_clipboard wrote the clipboard but the read-back did not match; the write may not have taken effect.",
    );
  }
}

export async function readTable(
  desktop: DesktopSurface,
  runtime: StepScope & { signal?: AbortSignal },
  config: StepConfig & { output_name: string; max_rows?: number | null },
): Promise<void> {
  const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
  const warnings = snapshotWarnings(snapshot);
  noteTrace(runtime, {
    tier: tierOf(snapshot),
    ...(warnings.length > 0 ? { warnings } : {}),
  });
  const element = resolveOrThrow(snapshot, config, "desktop_read_table", runtime);
  const rows = extractTable(snapshot, element.element_index, config.max_rows ?? undefined);
  noteTrace(runtime, { verified: true });
  runtime.outputs[config.output_name] = rows;
}

export function extractTable(
  snapshot: { elements: Array<{ element_index: number; parent_index?: number; label?: string; value?: string }> },
  anchorIndex: number,
  maxRows?: number,
): string[][] {
  const childrenOf = (parent: number) =>
    snapshot.elements.filter((element) => element.parent_index === parent);
  const textOf = (element: { label?: string; value?: string }) =>
    (element.value ?? element.label ?? "").trim();

  const rows: string[][] = [];
  for (const row of childrenOf(anchorIndex)) {
    if (maxRows !== undefined && rows.length >= maxRows) break;
    const cells = childrenOf(row.element_index);
    rows.push(cells.length > 0 ? cells.map(textOf) : [textOf(row)]);
  }
  return rows;
}

export async function screenshot<Runtime extends DesktopRuntime>(
  desktop: DesktopSurface,
  runtime: Runtime,
  deps: DesktopExecutorDependencies<Runtime>,
  config: { path?: string | null; sensitive?: boolean | null; output_name?: string | null },
): Promise<void> {
  const capture = await captureDesktopScreenshot({
    surface: desktop,
    evidenceDir: deps.evidenceDir,
    runId: runtime.runId,
    stepNumber: runtime.currentStepNumber,
    nodeId: runtime.currentStepId,
    requestedName: config.path,
    sensitive: isSensitiveStep({ flag: config.sensitive }),
    signal: runtime.signal,
  });

  if (!capture.captured) {
    if (config.output_name) runtime.outputs[config.output_name] = capture.reason;
    return;
  }

  deps.recordEvidence(runtime, {
    actionType: "desktop_screenshot",
    artifactKind: "screenshot",
    relativePath: capture.relativePath,
  });
  if (config.output_name) runtime.outputs[config.output_name] = capture.relativePath;
}

export async function walkMenu(
  desktop: DesktopSurface,
  runtime: StepScope,
  path: string[],
): Promise<void> {
  for (const item of path) {
    const snapshot = await desktop.driver.getWindowState(desktop.binding, runtime.signal);
    noteTrace(runtime, { tier: tierOf(snapshot) });
    const resolution = resolveDesktopLocator(
      { role: "MenuItem", name: { kind: "exact", value: item } },
      snapshot,
    );
    if (!resolution.ok) {
      throw new Error(`desktop_invoke_menu could not find "${item}": ${resolution.detail}`);
    }
    noteTrace(runtime, {
      role: resolution.element.role,
      ...(resolution.element.label !== undefined ? { label: resolution.element.label } : {}),
      matched: resolution.matchedBy,
    });
    await desktop.driver.click(
      desktop.binding,
      { elementToken: resolution.elementToken },
      runtime.signal,
    );
  }
}

export async function typeInto(
  desktop: DesktopSurface,
  runtime: StepScope,
  config: StepConfig,
  act: () => Promise<unknown>,
): Promise<void> {
  await resolveStep(desktop, config, runtime);
  await act();
  await verify(desktop, config, runtime);
}
