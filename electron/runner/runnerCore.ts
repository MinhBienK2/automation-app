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

function resolveArtifactPath(root: string, kind: "screenshots" | "downloads" | "traces", fileName: string) {
  if (fileName.includes("\0")) {
    throw new RunnerActionError("Artifact file path contains an invalid character.", "validation");
  }
  const rootPath = path.resolve(root);
  const artifactPath = path.resolve(rootPath, fileName);
  if (artifactPath !== rootPath && !artifactPath.startsWith(`${rootPath}${path.sep}`)) {
    throw new RunnerActionError(
      `Artifact file path must stay inside the allocated ${kind} directory.`,
      "validation",
    );
  }
  return artifactPath;
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function event(input: Omit<RunnerEvent, "createdAt">): RunnerEvent {
  return {
    ...input,
    createdAt: createdAt(),
  };
}

function delay(durationMs: number) {
  if (durationMs <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, durationMs));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | null | undefined,
  onTimeout: () => void,
): Promise<T> {
  if (!timeoutMs || timeoutMs <= 0) return promise;

  let timeout: NodeJS.Timeout | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => {
          onTimeout();
          reject(new RunnerActionError(`Action timed out after ${timeoutMs}ms.`, "runtime"));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
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

    const preflightPolicy = payload.identityProfileSnapshot.preflightPolicy;
    if (preflightPolicy?.enabled) {
      emit({
        type: "preflight.started",
        severity: "info",
        runId: payload.runId,
        payload: {
          profileId: payload.identityProfileSnapshot.id,
          probeOrigin: new URL(preflightPolicy.probeUrl).origin,
        },
      });

      try {
        if (!originAllowed(preflightPolicy.probeUrl, preflightPolicy.allowedOrigins)) {
          throw new RunnerActionError(
            `Fingerprint preflight probe is outside the owned allowlist: ${preflightPolicy.probeUrl}`,
            "policy",
          );
        }
        await adapter.navigate({ type: "navigate", url: preflightPolicy.probeUrl });
        const verdictText = await adapter.extractText({
          type: "extract_text",
          locator: preflightPolicy.verdictLocator ?? {
            strategy: "css",
            value: "body",
            filters: { visible: true },
            fallbacks: [],
          },
          outputName: "fingerprint_preflight_verdict",
        });
        const verdict = asRecord(JSON.parse(verdictText));
        if (!verdict || typeof verdict.passed !== "boolean") {
          throw new RunnerActionError("Fingerprint preflight verdict is malformed.", "validation");
        }

        emit({
          type: "preflight.verdictReceived",
          severity: verdict.passed ? "info" : "warning",
          runId: payload.runId,
          payload: verdict,
        });

        if (verdict.passed !== true) {
          const reason = `Fingerprint preflight blocked run with verdict '${String(verdict.verdict ?? "blocked")}'.`;
          emit({
            type: "issue.created",
            severity: "error",
            runId: payload.runId,
            payload: {
              category: "policy",
              message: reason,
            },
          });
          emit({
            type: "preflight.failed",
            severity: "error",
            runId: payload.runId,
            payload: {
              reason,
              verdict: verdict.verdict ?? null,
            },
          });
          emit({
            type: "run.failed",
            severity: "error",
            runId: payload.runId,
            payload: {
              category: "policy",
              reason,
            },
          });
          return { runId: payload.runId, status: "failed", reason };
        }

        emit({
          type: "preflight.passed",
          severity: "info",
          runId: payload.runId,
          payload: {
            verdict: verdict.verdict ?? "passed",
          },
        });
      } catch (error) {
        const actionError =
          error instanceof RunnerActionError
            ? error
            : new RunnerActionError(error instanceof Error ? error.message : String(error), "validation");
        emit({
          type: "issue.created",
          severity: "error",
          runId: payload.runId,
          payload: {
            category: actionError.category,
            message: actionError.message,
          },
        });
        emit({
          type: "preflight.failed",
          severity: "error",
          runId: payload.runId,
          payload: {
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

      const maxAttempts = Math.max(1, step.retry?.attempts ?? 1);
      let actionError: RunnerActionError | null = null;

      for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        try {
          const timeoutMs = step.timeoutMs ?? ("timeoutMs" in step.config ? step.config.timeoutMs : null);
          await withTimeout(
            (async () => {
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
                  const screenshotPath = resolveArtifactPath(
                    payload.artifactDirectories.screenshots,
                    "screenshots",
                    fileName,
                  );
                  const screenshot = await adapter.screenshot({
                    path: screenshotPath,
                    fullPage: (step.config as ScreenshotActionConfig).fullPage,
                  });
                  const buffer = Buffer.isBuffer(screenshot) ? screenshot : Buffer.from(screenshot);
                  try {
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
                  } catch (error) {
                    const reason = `Failed to write screenshot artifact '${fileName}': ${errorMessage(error)}`;
                    if (payload.runProfileSnapshot.evidencePolicy?.strict === true) {
                      throw new RunnerActionError(reason, "system");
                    }
                    emit({
                      type: "issue.created",
                      severity: "warning",
                      runId: payload.runId,
                      nodeId: step.sourceNodeId,
                      actionId: step.id,
                      payload: {
                        category: "system",
                        artifactType: "screenshot",
                        fileName,
                        message: reason,
                      },
                    });
                  }
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
            })(),
            timeoutMs,
            () =>
              emit({
                type: "action.timeout",
                severity: "error",
                runId: payload.runId,
                nodeId: step.sourceNodeId,
                actionId: step.id,
                payload: {
                  actionType: step.actionType,
                  timeoutMs,
                  attempt,
                },
              }),
          );

          actionError = null;
          break;
        } catch (error) {
          actionError =
            error instanceof RunnerActionError
              ? error
              : new RunnerActionError(error instanceof Error ? error.message : String(error), "runtime");

          if (attempt < maxAttempts && actionError.category === "runtime") {
            emit({
              type: "action.retrying",
              severity: "warning",
              runId: payload.runId,
              nodeId: step.sourceNodeId,
              actionId: step.id,
              payload: {
                actionType: step.actionType,
                attempt,
                nextAttempt: attempt + 1,
                maxAttempts,
                intervalMs: step.retry?.intervalMs ?? 0,
                reason: actionError.message,
              },
            });
            await delay(step.retry?.intervalMs ?? 0);
            continue;
          }

          break;
        }
      }

      if (actionError) {
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
