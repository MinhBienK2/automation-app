// @vitest-environment node

import { describe, expect, test, vi } from "vitest";
import { createWebSurfaceOpener } from "./surfaceOpener.js";
import { requireWebSurface } from "../../runtime/surface.js";
import type { BrowserDriverContext, BrowserDriverPage } from "./sessionManager.js";
import type { WorkflowSettings } from "../../../../src/types/workflow.js";

function fakePage(): BrowserDriverPage {
  return {
    url: () => "https://example.com",
    goto: vi.fn(),
    close: vi.fn(),
    locator: vi.fn(),
    isClosed: () => false,
  } as unknown as BrowserDriverPage;
}

function fakeContext(): BrowserDriverContext {
  const page = fakePage();
  const handlers = new Map<string, Array<() => void>>();
  return {
    newPage: vi.fn(async () => page),
    pages: () => [page],
    close: vi.fn(async () => {
      for (const h of handlers.get("close") ?? []) h();
    }),
    on: vi.fn((event: string, handler: () => void) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    }),
  } as unknown as BrowserDriverContext;
}

function fakeSessionManager() {
  const context = fakeContext();
  const page = context.pages()[0];
  const retained = new Map<string, { context: BrowserDriverContext; page: BrowserDriverPage }>();

  return {
    launchFreshSession: vi.fn(async () => ({ context, page, temporary: true })),
    reuseRetainedSession: vi.fn(async ({ retainedSessionWorkflowId }) => {
      const entry = retained.get(retainedSessionWorkflowId ?? "default");
      if (!entry) throw new Error("No reusable session");
      return { context: entry.context, page: entry.page, temporary: false };
    }),
    retainSession: vi.fn((ctx: BrowserDriverContext, pg: BrowserDriverPage, wfId: string | null) => {
      retained.set(wfId ?? "default", { context: ctx, page: pg });
    }),
    forgetContext: vi.fn(),
    getRetainedSessionState: vi.fn(() => ({
      available: retained.size > 0,
      workflow_id: "wf-1",
      profile_name: "default",
      reason: null,
    })),
    context,
    page,
    retained,
  };
}

const SETTINGS: WorkflowSettings = {
  execution_surface: "web",
  run_policy: {
    timeout_ms: 30000,
    concurrency_limit: 1,
    retry_count: 0,
    retry_delay_ms: 1000,
    step_timeout_ms: 10000,
    browser_retention: "retain",
  },
  browser_profile: {
    mode: "persistent_profile",
    profile_dir: "default",
  },
  browser_launch: {
    session_mode: "persistent_profile",
    profile_dir: "default",
    fingerprint_seed: "12345",
  },
} as unknown as WorkflowSettings;

describe("createWebSurfaceOpener", () => {
  test("opens a fresh session and produces WebSurface", async () => {
    const sm = fakeSessionManager();
    const opener = createWebSurfaceOpener({ sessionManager: sm as never });

    const opened = await opener({
      settings: SETTINGS,
      runId: "run-1",
      retention: "retain",
    })();

    const web = requireWebSurface(opened.surface);
    expect(web.kind).toBe("web");
    expect(web.context).toBe(sm.context);
    expect(web.page).toBe(sm.page);
    expect(opened.warnings).toEqual([]);
    expect(opened.retainedSessionState?.()).toEqual({
      available: false,
      workflow_id: "wf-1",
      profile_name: "default",
      reason: null,
    });
  });

  test("close() retains session when retention is retain and run succeeded", async () => {
    const sm = fakeSessionManager();
    const opener = createWebSurfaceOpener({ sessionManager: sm as never });

    const opened = await opener({
      settings: SETTINGS,
      runId: "run-1",
      retention: "retain",
      retainedSessionWorkflowId: "wf-1",
    })();

    await opened.close({ status: "success" });
    expect(sm.retainSession).toHaveBeenCalledWith(sm.context, sm.page, "wf-1", "default");
    expect(sm.context.close).not.toHaveBeenCalled();
  });

  test("close() closes context when retention is close", async () => {
    const sm = fakeSessionManager();
    const opener = createWebSurfaceOpener({ sessionManager: sm as never });

    const opened = await opener({
      settings: SETTINGS,
      runId: "run-1",
      retention: "close",
    })();

    await opened.close({ status: "success" });
    expect(sm.context.close).toHaveBeenCalled();
    expect(sm.forgetContext).toHaveBeenCalledWith(sm.context);
    expect(sm.retainSession).not.toHaveBeenCalled();
  });

  test("close() closes context when run failed even if retention is retain", async () => {
    const sm = fakeSessionManager();
    const opener = createWebSurfaceOpener({ sessionManager: sm as never });

    const opened = await opener({
      settings: SETTINGS,
      runId: "run-1",
      retention: "retain",
    })();

    await opened.close({ status: "failed" });
    expect(sm.context.close).toHaveBeenCalled();
    expect(sm.forgetContext).toHaveBeenCalledWith(sm.context);
    expect(sm.retainSession).not.toHaveBeenCalled();
  });

  test("close() closes context when profile is ephemeral even if retention is retain", async () => {
    const sm = fakeSessionManager();
    const opener = createWebSurfaceOpener({ sessionManager: sm as never });

    const ephemeralSettings = {
      ...SETTINGS,
      browser_launch: {
        session_mode: "temporary" as const,
      },
    } as unknown as WorkflowSettings;

    const opened = await opener({
      settings: ephemeralSettings,
      runId: "run-1",
      retention: "retain",
    })();

    await opened.close({ status: "success" });
    expect(sm.context.close).toHaveBeenCalled();
    expect(sm.forgetContext).toHaveBeenCalledWith(sm.context);
    expect(sm.retainSession).not.toHaveBeenCalled();
  });

  test("reuses retained session when requested", async () => {
    const sm = fakeSessionManager();
    sm.retained.set("wf-1", { context: sm.context, page: sm.page });
    const opener = createWebSurfaceOpener({ sessionManager: sm as never });

    const opened = await opener({
      settings: SETTINGS,
      runId: "run-2",
      reuseRetainedSession: true,
      retainedSessionWorkflowId: "wf-1",
    })();

    expect(sm.reuseRetainedSession).toHaveBeenCalled();
    expect(opened.surface.kind).toBe("web");
  });
});
