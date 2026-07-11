// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  createTestHandlers,
  runnableGraph,
  waitFor,
  tempRoots,
  FakeRecordingDriver,
  FakeRecordingContext,
  FakeRecordingPage,
} from "../../commands.testHelpers";
import type {
  ActionConfig,
  WorkflowGraph,
  WorkflowPackage,
  RunState,
} from "../../../../src/types/workflow";

vi.mock("electron", () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

describe("Recording commands integration", () => {
  test("starts, reports, stops, and discards a new-workflow recording session", async () => {
    const { handlers } = await createTestHandlers();

    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded checkout",
      initial_url: "https://owned.test/checkout",
    });

    expect(session).toMatchObject({
      workflow_id: null,
      mode: "new_workflow",
      status: "recording",
      page_url: "https://owned.test/checkout",
      event_count: 1,
      warnings: [],
    });
    expect(session.id).toMatch(/^rec_/);
    expect(session.browser_identity).toMatchObject({
      identity_id: expect.stringMatching(/^bi_/),
      profile_dir: expect.stringMatching(/^bi_/),
      fingerprint_seed_hash: expect.any(String),
    });
    expect(session.workflow_settings_snapshot).toMatchObject({
      general: { name: "Recorded checkout" },
      browser_launch: {
        identity_id: session.browser_identity.identity_id,
        profile_dir: session.browser_identity.profile_dir,
        proxy_password: null,
      },
    });
    expect(handlers.getRecordingSession(session.id)).toEqual(session);
    expect(handlers.listRecordingEvents(session.id)).toMatchObject([
      {
        kind: "navigation",
        page_url: "https://owned.test/checkout",
      },
    ]);

    const stopped = await handlers.stopRecordingSession(session.id);
    expect(stopped).toMatchObject({
      id: session.id,
      status: "stopped",
      stopped_at: expect.any(String),
    });

    const discarded = await handlers.discardRecordingSession(session.id);
    expect(discarded).toMatchObject({
      id: session.id,
      status: "discarded",
    });
    expect(() => handlers.getRecordingSession(session.id)).toThrow("Recording session not found");
  });

  test("starts replace-current-graph recording from saved workflow settings without leaking secrets", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Saved identity");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    const savedSettings = await handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        display_name: "Owned staging account",
        proxy_enabled: true,
        proxy_server: "http://proxy.owned.test:8080",
        proxy_username: "operator",
        proxy_password: "secret",
      },
    });

    const session = await handlers.startRecordingSession({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
    });

    expect(session).toMatchObject({
      workflow_id: workflow.id,
      mode: "replace_current_graph",
      status: "recording",
      event_count: 0,
    });
    expect(session.browser_identity).toMatchObject({
      identity_id: savedSettings.browser_launch.identity_id,
      display_name: "Owned staging account",
      profile_dir: savedSettings.browser_launch.profile_dir,
    });
    expect(session.workflow_settings_snapshot.browser_launch).toMatchObject({
      identity_id: savedSettings.browser_launch.identity_id,
      proxy_enabled: true,
      proxy_server: "http://proxy.owned.test:8080",
      proxy_username: "operator",
      proxy_password: null,
    });
  });

  test("applies safe recorder browser launch overrides to the recording settings snapshot", async () => {
    const context = new FakeRecordingContext(new FakeRecordingPage());
    const driver = new FakeRecordingDriver(context);
    const { handlers } = await createTestHandlers({
      recorderDriver: driver,
    });

    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Headless recorder",
      browser_launch_overrides: { headless: true },
    });

    expect(session.warnings).toEqual([]);
    expect(session.browser_identity.headless).toBe(true);
    expect(session.workflow_settings_snapshot.browser_launch.headless).toBe(true);
    expect(driver.launches[0]?.options).toMatchObject({
      headless: true,
    });
  });

  test("starts a backend-owned recorder browser and collects page interaction events", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const driver = new FakeRecordingDriver(context);
    const { handlers } = await createTestHandlers({
      recorderDriver: driver,
    });

    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
      initial_url: "https://fixture.owned.test/form",
    });
    await page.emitRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        text_sample: "Save",
        locators: [],
      },
      value: null,
      raw: { trusted: true },
      confidence: "high",
      warnings: [],
    });
    await page.emitRecorderPayload({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "email",
        locators: [],
      },
      value: { text: "qa@example.test" },
      raw: {},
      confidence: "high",
      warnings: [],
    });

    const events = handlers.listRecordingEvents(session.id);

    expect(driver.launches).toHaveLength(1);
    expect(page.initScripts).toHaveLength(1);
    expect(page.gotoCalls).toEqual(["https://fixture.owned.test/form"]);
    expect(events.map((event) => event.kind)).toEqual([
      "navigation",
      "click",
      "input",
    ]);
    expect(events[0]).toMatchObject({
      session_id: session.id,
      sequence: 1,
      kind: "navigation",
      page_url: "https://fixture.owned.test/form",
    });
    expect(events[2]).toMatchObject({
      sequence: 3,
      value: { text: "qa@example.test" },
    });

    await handlers.stopRecordingSession(session.id);

    expect(context.closed).toBe(true);
  });

  test("closes the recorder browser when initial navigation fails before session registration", async () => {
    const page = new FakeRecordingPage();
    page.gotoError = new Error("Navigation failed");
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });

    await expect(handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Broken recorder",
      initial_url: "https://fixture.owned.test/fails",
    })).rejects.toThrow("Navigation failed");

    expect(context.closed).toBe(true);
  });

  test("generates a recording draft without persisting a workflow", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers, database } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
      initial_url: "https://fixture.owned.test/form",
    });
    await page.emitRecorderPayload({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "email",
        accessible_name: "Email",
        locators: [
          { kind: "test_id", value: "email", score: 1, reason: "Stable test id" },
        ],
      },
      value: { text: "qa@example.test" },
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);

    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });

    expect(draft).toMatchObject({
      id: expect.stringMatching(/^draft_/),
      session_id: session.id,
      workflow_id: null,
      mode: "new_workflow",
      status: "draft",
      steps: [
        { action: { type: "navigate" } },
        { action: { type: "input_text" } },
      ],
      validation_issues: [],
    });
    expect(draft.graph.nodes.map((node) => node.node_type)).toEqual([
      "start",
      "action",
      "action",
      "end_success",
    ]);
    expect(handlers.getRecordingDraft(draft.id)).toEqual(draft);
    expect(await handlers.listWorkflows()).toEqual([]);
    const countRow = await database.queryOne<{ count: number }>("SELECT COUNT(*) AS count FROM workflows");
    expect(countRow).toEqual({
      count: 0,
    });
  });

  test("saves a reviewed new-workflow recording draft with the recorder browser identity", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
      initial_url: "https://fixture.owned.test/form",
    });
    await page.emitRecorderPayload({
      kind: "input",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "email",
        accessible_name: "Email",
        locators: [
          { kind: "test_id", value: "email", score: 1, reason: "Stable test id" },
        ],
      },
      value: { text: "qa@example.test" },
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });
    const reviewedSteps = draft.steps.map((step, index) => ({
      ...step,
      label: index === 1 ? "Fill recorded email" : step.label,
      included: index !== 0,
    }));

    const saved = await handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Saved recording",
      save_mode: "create_new",
      reviewed_steps: reviewedSteps,
      add_terminal_success: true,
    });

    expect(saved.workflow.name).toBe("Saved recording");
    expect(await handlers.listWorkflows()).toHaveLength(1);
    expect((await handlers.getWorkflowGraph(saved.workflow.id)).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Fill recorded email",
          config: expect.objectContaining({ type: "input_text" }),
        }),
      ]),
    );
    expect(
      (await handlers.getWorkflowGraph(saved.workflow.id)).nodes.some((node) =>
        node.config && typeof node.config === "object" && "type" in node.config &&
        node.config.type === "navigate"
      ),
    ).toBe(false);
    expect((await handlers.getWorkflowSettings(saved.workflow.id)).browser_launch.identity_id)
      .toBe(draft.workflow_settings_snapshot.browser_launch.identity_id);
    expect(() => handlers.getRecordingDraft(draft.id)).toThrow("Recording draft not found");
    expect(() => handlers.getRecordingSession(session.id)).toThrow("Recording session not found");
  });

  test("reconciles reviewed recording steps against the backend draft before saving", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
    });
    await page.emitRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        accessible_name: "Save",
        locators: [
          {
            kind: "role",
            value: "button",
            name: "Save",
            score: 0.9,
            reason: "Accessible role",
          },
        ],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });
    const tamperedSteps = [
      null,
      {
        ...draft.steps[0],
        id: "injected-step",
        action: {
          type: "execute_js",
          config: { script: "return document.cookie", output_name: "cookie" },
        } as ActionConfig,
      },
      ...draft.steps.map((step) => ({
        ...step,
        label: "Reviewed click",
        action: {
          type: "execute_js",
          config: { script: "return document.cookie", output_name: "cookie" },
        } as ActionConfig,
        warnings: [],
      })),
    ] as unknown as typeof draft.steps;

    const saved = await handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Saved recording",
      save_mode: "create_new",
      reviewed_steps: tamperedSteps,
      add_terminal_success: true,
    });

    const graph = await handlers.getWorkflowGraph(saved.workflow.id);
    const actionNodes = graph.nodes.filter((node) => node.node_type === "action");
    expect(actionNodes).toHaveLength(1);
    expect(actionNodes[0]).toMatchObject({
      label: "Reviewed click",
      config: { type: "click" },
    });
    expect(JSON.stringify(graph)).not.toContain("execute_js");
    expect(JSON.stringify(graph)).not.toContain("document.cookie");
  });

  test("honors reviewed clipboard text while saving paste recording steps", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Recorded fixture",
    });
    await page.emitRecorderPayload({
      kind: "clipboard",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "input",
        input_type: "text",
        accessible_name: "Paste",
        locators: [
          { kind: "test_id", value: "paste-target", score: 1, reason: "Stable test id" },
        ],
      },
      value: { text: "recorded paste" },
      raw: { action: "paste" },
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: false,
    });
    const reviewedSteps = draft.steps.map((step) =>
      step.action.type === "set_clipboard"
        ? {
            ...step,
            action: {
              type: "set_clipboard" as const,
              config: { text: "reviewed paste" },
            },
          }
        : step,
    );

    const saved = await handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Saved recording",
      save_mode: "create_new",
      reviewed_steps: reviewedSteps,
      add_terminal_success: false,
    });

    const actionConfigs = (await handlers.getWorkflowGraph(saved.workflow.id)).nodes
      .flatMap((node) => node.node_type === "action" ? [node.config] : []);
    expect(actionConfigs).toEqual(
      expect.arrayContaining([
        { type: "set_clipboard", config: { text: "reviewed paste" } },
        expect.objectContaining({ type: "paste_clipboard" }),
      ]),
    );
  });

  test("drains buffered recorder events before stopping a session", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const session = await handlers.startRecordingSession({
      mode: "new_workflow",
      workflow_name: "Buffered recorder",
    });
    page.bufferRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        accessible_name: "Save",
        locators: [],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });

    await handlers.stopRecordingSession(session.id);

    expect(handlers.listRecordingEvents(session.id)).toMatchObject([
      {
        kind: "click",
        page_url: "https://fixture.owned.test/form",
      },
    ]);
  });

  test("replaces the current workflow graph without creating a new workflow", async () => {
    const page = new FakeRecordingPage();
    const context = new FakeRecordingContext(page);
    const { handlers } = await createTestHandlers({
      recorderDriver: new FakeRecordingDriver(context),
    });
    const workflow = await handlers.createWorkflow("Existing flow");
    const originalIdentity = (await handlers.getWorkflowSettings(workflow.id)).browser_launch.identity_id;
    const session = await handlers.startRecordingSession({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
    });
    await page.emitRecorderPayload({
      kind: "click",
      page_url: "https://fixture.owned.test/form",
      frame_url: "https://fixture.owned.test/form",
      target: {
        tag_name: "button",
        accessible_name: "Save",
        locators: [
          {
            kind: "role",
            value: "button",
            name: "Save",
            score: 0.9,
            reason: "Accessible role",
          },
        ],
      },
      value: null,
      raw: {},
      confidence: "high",
      warnings: [],
    });
    await handlers.stopRecordingSession(session.id);
    const draft = handlers.generateRecordingDraft(session.id, {
      include_event_ids: null,
      add_terminal_success: true,
    });

    const saved = await handlers.saveRecordingDraft(draft.id, {
      workflow_name: "Ignored for replace",
      save_mode: "replace_graph",
      reviewed_steps: draft.steps,
      add_terminal_success: true,
    });

    expect(saved.workflow.id).toBe(workflow.id);
    expect(await handlers.listWorkflows()).toHaveLength(1);
    expect((await handlers.getWorkflowGraph(workflow.id)).nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          config: expect.objectContaining({ type: "click" }),
        }),
      ]),
    );
    expect((await handlers.getWorkflowSettings(workflow.id)).browser_launch.identity_id)
      .toBe(originalIdentity);
  });

  test("rejects replacement recording while the workflow is running", async () => {
    let activeRunSignal: AbortSignal | null = null;
    const { handlers } = await createTestHandlers({
      runner: {
        async run(request: { signal?: AbortSignal }): Promise<RunState> {
          activeRunSignal = request.signal ?? null;
          await new Promise<void>((resolve) => {
            request.signal?.addEventListener("abort", resolve, { once: true });
          });
          return {
            status: "stopped",
            mode: "run_workflow",
            target_step_id: null,
            current_step_id: null,
            current_step_number: null,
            completed_step_ids: [],
            outputs: {},
            error: null,
          };
        },
      },
    });
    const workflow = await handlers.createWorkflow("Running workflow");
    await handlers.saveWorkflowGraph(workflow.id, runnableGraph());

    const runPromise = handlers.runWorkflow(workflow.id);
    await waitFor(() => activeRunSignal !== null);

    await expect(handlers.startRecordingSession({
      mode: "replace_current_graph",
      workflow_id: workflow.id,
    })).rejects.toThrow("This workflow is already running");

    const running = handlers.listRunStates().find((snapshot) =>
      snapshot.workflow_id === workflow.id && snapshot.state.status === "running"
    );
    if (running) await handlers.stopRun(running.run_id);
    await runPromise;
  });
});
