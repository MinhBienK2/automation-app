import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type {
  ClickActionConfig,
  ExtractTextActionConfig,
  FillActionConfig,
  LocatorConfig,
  NavigateActionConfig,
  RunnerEvent,
  RunnerResult,
  ScreenshotActionConfig,
  StartRunPayload,
  WaitActionConfig,
} from "../shared/product.js";

export type { RunnerEvent } from "../shared/product.js";

export type BrowserAutomationAdapter = {
  launch(payload: StartRunPayload): Promise<void>;
  close(): Promise<void>;
  navigate(config: NavigateActionConfig): Promise<void>;
  click(config: ClickActionConfig): Promise<void>;
  fill(config: FillActionConfig): Promise<void>;
  wait(config: WaitActionConfig): Promise<void>;
  screenshot(input: { path: string; fullPage?: boolean }): Promise<Buffer | string>;
  extractText(config: ExtractTextActionConfig): Promise<string>;
};

export type RunnerController = {
  emit(event: RunnerEvent): void;
  isCancelled?: () => boolean;
};

class RunnerActionError extends Error {
  constructor(
    message: string,
    readonly category: "runtime" | "policy" | "validation" | "system",
  ) {
    super(message);
  }
}

function createdAt() {
  return new Date().toISOString();
}

function locatorSummary(locator?: LocatorConfig) {
  if (!locator) return null;
  return {
    strategy: locator.strategy,
    value: locator.value,
    name: locator.name ?? null,
    exact: locator.exact ?? false,
    fallbackCount: locator.fallbacks?.length ?? 0,
  };
}

function checksum(buffer: Buffer) {
  return `sha256:${createHash("sha256").update(buffer).digest("hex")}`;
}

function originAllowed(urlValue: string, allowedOrigins: string[]) {
  if (allowedOrigins.length === 0) return true;
  const url = new URL(urlValue);
  return allowedOrigins.includes(url.origin);
}

function relativeArtifactPath(runId: string, kind: "screenshots" | "downloads" | "traces", fileName: string) {
  return `runs/${runId}/${kind}/${fileName}`;
}

function event(input: Omit<RunnerEvent, "createdAt">): RunnerEvent {
  return {
    ...input,
    createdAt: createdAt(),
  };
}

export async function runPlan(
  payload: StartRunPayload,
  adapter: BrowserAutomationAdapter,
  controller: RunnerController,
): Promise<RunnerResult> {
  const emit = (next: Omit<RunnerEvent, "createdAt">) => controller.emit(event(next));
  const isCancelled = () => controller.isCancelled?.() === true;

  mkdirSync(payload.artifactDirectories.screenshots, { recursive: true });
  mkdirSync(payload.artifactDirectories.downloads, { recursive: true });
  mkdirSync(payload.artifactDirectories.traces, { recursive: true });
  mkdirSync(payload.artifactDirectories.evidence, { recursive: true });

  emit({
    type: "run.started",
    severity: "info",
    runId: payload.runId,
    payload: {
      workflowId: payload.workflowId,
      graphVersionId: payload.runPlan.graphVersionId,
      stepCount: payload.runPlan.steps.length,
    },
  });

  try {
    await adapter.launch(payload);
    emit({
      type: "identity.profileResolved",
      severity: "info",
      runId: payload.runId,
      payload: {
        identityProfileId: payload.identityProfileSnapshot.id,
        identityProfileName: payload.identityProfileSnapshot.name,
        headless: payload.identityProfileSnapshot.headless,
      },
    });

    for (const step of payload.runPlan.steps) {
      if (isCancelled()) {
        emit({
          type: "run.cancelled",
          severity: "warning",
          runId: payload.runId,
          payload: { reason: "Operator cancelled run." },
        });
        return { runId: payload.runId, status: "cancelled", reason: "cancelled" };
      }

      emit({
        type: "step.started",
        severity: "info",
        runId: payload.runId,
        nodeId: step.sourceNodeId,
        actionId: step.id,
        payload: {
          label: step.label,
          actionType: step.actionType,
          locator: locatorSummary("locator" in step.config ? step.config.locator : undefined),
        },
      });

      try {
        switch (step.config.type) {
          case "navigate":
            if (!originAllowed(step.config.url, payload.operatorPolicySnapshot.allowedOrigins)) {
              throw new RunnerActionError(
                `Navigation origin is outside the allowed operator policy: ${step.config.url}`,
                "policy",
              );
            }
            await adapter.navigate(step.config);
            break;
          case "click":
            await adapter.click(step.config);
            break;
          case "fill":
            await adapter.fill(step.config);
            break;
          case "wait":
            await adapter.wait(step.config);
            break;
          case "take_screenshot": {
            const fileName = step.config.fileName || `${step.sourceNodeId}.png`;
            const screenshotPath = path.join(payload.artifactDirectories.screenshots, fileName);
            const screenshot = await adapter.screenshot({
              path: screenshotPath,
              fullPage: (step.config as ScreenshotActionConfig).fullPage,
            });
            const buffer = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
            writeFileSync(screenshotPath, buffer);
            emit({
              type: "artifact.created",
              severity: "info",
              runId: payload.runId,
              nodeId: step.sourceNodeId,
              actionId: step.id,
              payload: {
                type: "screenshot",
                relativePath: relativeArtifactPath(payload.runId, "screenshots", fileName),
                mimeType: "image/png",
                sizeBytes: buffer.byteLength,
                checksum: checksum(buffer),
                sanitized: true,
              },
            });
            break;
          }
          case "extract_text": {
            const value = await adapter.extractText(step.config);
            emit({
              type: "output.captured",
              severity: "info",
              runId: payload.runId,
              nodeId: step.sourceNodeId,
              actionId: step.id,
              payload: {
                name: step.config.outputName,
                value,
                locator: locatorSummary(step.config.locator),
              },
            });
            break;
          }
        }

        emit({
          type: "step.completed",
          severity: "info",
          runId: payload.runId,
          nodeId: step.sourceNodeId,
          actionId: step.id,
          payload: {
            actionType: step.actionType,
            mode: modeForAction(step.config.type),
          },
        });
      } catch (error) {
        const actionError =
          error instanceof RunnerActionError
            ? error
            : new RunnerActionError(error instanceof Error ? error.message : String(error), "runtime");
        emit({
          type: "issue.created",
          severity: "error",
          runId: payload.runId,
          nodeId: step.sourceNodeId,
          actionId: step.id,
          payload: {
            category: actionError.category,
            message: actionError.message,
          },
        });
        emit({
          type: "step.failed",
          severity: "error",
          runId: payload.runId,
          nodeId: step.sourceNodeId,
          actionId: step.id,
          payload: {
            actionType: step.actionType,
            reason: actionError.message,
          },
        });
        emit({
          type: "run.failed",
          severity: "error",
          runId: payload.runId,
          payload: {
            category: actionError.category,
            reason: actionError.message,
          },
        });
        return { runId: payload.runId, status: "failed", reason: actionError.message };
      }
    }

    emit({
      type: "run.completed",
      severity: "info",
      runId: payload.runId,
      payload: { status: "completed" },
    });
    return { runId: payload.runId, status: "completed" };
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    emit({
      type: "run.failed",
      severity: "error",
      runId: payload.runId,
      payload: {
        category: "system",
        reason,
      },
    });
    return { runId: payload.runId, status: "failed", reason };
  } finally {
    await adapter.close().catch(() => undefined);
  }
}

function modeForAction(actionType: string) {
  switch (actionType) {
    case "click":
    case "fill":
      return "playwright_action";
    case "navigate":
    case "wait":
      return "browser_input";
    case "extract_text":
      return "observer";
    case "take_screenshot":
      return "observer";
    default:
      return "control";
  }
}
