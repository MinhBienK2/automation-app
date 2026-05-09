// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createAppApi, type AppApi } from "./appApi";
import { createStorageService, type StorageService } from "./storage";
import type { BrowserAutomationAdapter } from "../runner/runnerCore";

let appDataDir = "";
let storage: StorageService;
let api: AppApi;

function adapter(): BrowserAutomationAdapter {
  return {
    async launch() {},
    async close() {},
    async navigate() {},
    async click() {},
    async fill() {},
    async wait() {},
    async screenshot() {
      return Buffer.from("api-screenshot");
    },
    async extractText() {
      return "Extracted text";
    },
  };
}

beforeEach(() => {
  appDataDir = mkdtempSync(path.join(tmpdir(), "cloak-app-api-"));
  storage = createStorageService({ appDataDir });
  storage.initialize();
  api = createAppApi({
    storage,
    appDataDir,
    createAdapter: adapter,
  });
});

afterEach(() => {
  storage.close();
  rmSync(appDataDir, { recursive: true, force: true });
});

describe("Electron app API", () => {
  test("exposes workflow and graph operations through the preload-shaped API", async () => {
    const workflow = await api.workflows.create({ name: "Owned smoke flow" });
    const workflows = await api.workflows.list();
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const issues = await api.graphs.validate({ graph });

    expect(workflows).toEqual([
      expect.objectContaining({
        id: workflow.id,
        name: "Owned smoke flow",
        step_count: 0,
      }),
    ]);
    expect(graph.nodes.map((node) => node.node_type)).toEqual(["start", "action"]);
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          node_id: graph.nodes[1]?.id,
          message: expect.stringContaining("configured"),
        }),
      ]),
    );
  });

  test("renames, duplicates, and persists workflow settings through the UI facade", async () => {
    const workflow = await api.workflows.create({ name: "Original" });

    await api.workflows.rename({ id: workflow.id, name: "Renamed" });
    const settings = await api.settings.get({ workflowId: workflow.id });
    await api.settings.saveSection({
      workflowId: workflow.id,
      section: "browser",
      sectionValue: { ...settings.browser, headless: true },
    });
    const duplicate = await api.workflows.duplicate({
      workflowId: workflow.id,
      name: "Copy of Renamed",
    });

    expect((await api.workflows.get({ id: workflow.id }))?.workflow.name).toBe("Renamed");
    expect((await api.settings.get({ workflowId: workflow.id })).browser.headless).toBe(true);
    expect(duplicate.workflow.id).not.toBe(workflow.id);
    expect((await api.graphs.loadActive({ workflowId: duplicate.workflow.id })).nodes).toHaveLength(2);
  });

  test("starts a configured vertical-slice run and persists events plus artifact metadata", async () => {
    const workflow = await api.workflows.create({ name: "Runnable flow" });
    const graph = await api.graphs.loadActive({ workflowId: workflow.id });
    const start = graph.nodes[0];
    const draft = graph.nodes[1];
    if (!start || !draft) throw new Error("Missing draft graph nodes.");
    draft.label = "Screenshot";
    draft.config = { type: "take_screenshot", config: { file_name: "final.png" } };

    await api.graphs.save({ workflowId: workflow.id, graph });
    const runState = await api.runs.start({ workflowId: workflow.id });

    expect(runState).toMatchObject({
      status: "success",
      mode: "run_workflow",
      completed_step_ids: [draft.id],
    });

    const runs = storage.listRunEvents(runState.run_id ?? "");
    expect(runs.map((event) => event.type)).toEqual([
      "run.started",
      "identity.profileResolved",
      "step.started",
      "artifact.created",
      "step.completed",
      "run.completed",
    ]);
    expect(storage.listArtifacts(runState.run_id ?? "")).toEqual([
      expect.objectContaining({
        type: "screenshot",
        relativePath: `runs/${runState.run_id}/screenshots/final.png`,
      }),
    ]);
  });
});
