import fs from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test, expect } from "./support/electronFixture";
import { createWorkflowWithoutRun, linearGraph } from "./support/workflows";

test.describe("desktop batch execution and persisted evidence", () => {
  test("runs batch rows through the saved graph and persists row evidence", async ({
    appDataDir,
    appWindow,
    fixtureServer,
  }) => {
    const workflowId = await createWorkflowWithoutRun(
      appWindow,
      "E2E batch evidence",
      linearGraph([
        {
          id: "navigate-basic",
          label: "Navigate Basic",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/basic` } },
        },
        {
          id: "record-row",
          label: "Record Row",
          config: {
            type: "set_variable",
            config: {
              variables: [
                { name: "row_marker", value_type: "text", value: "{{row_id}}" },
              ],
            },
          },
        },
        {
          id: "extract-title",
          label: "Extract Title",
          config: {
            type: "extract_text",
            config: {
              target: { locators: [{ kind: "test_id", value: "title" }] },
              output_name: "batch_title",
            },
          },
        },
        {
          id: "batch-screenshot",
          label: "Batch Screenshot",
          config: {
            type: "take_screenshot",
            config: {
              path: "batch-row.png",
              output_name: "batch_screenshot",
              full_page: false,
            },
          },
        },
      ]),
    );

    const summary = await appWindow.evaluate(async (id) => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      return api.runBatchWorkflow(id, {
        rows: [{ row_id: "one" }, { row_id: "two" }],
        headless: true,
      });
    }, workflowId);

    expect(summary).toMatchObject({
      total: 2,
      succeeded: 2,
      failed: 0,
      results: [
        { row_index: 0, status: "success" },
        { row_index: 1, status: "success" },
      ],
    });

    const database = new DatabaseSync(
      path.join(appDataDir, "automation-app", "database.sqlite"),
    );
    try {
      const runs = database.prepare(
        "SELECT id, status, outputs_json FROM runs WHERE workflow_id = ? ORDER BY started_at ASC",
      ).all(workflowId) as Array<{ id: string; status: string; outputs_json: string }>;
      expect(runs).toHaveLength(2);
      expect(runs.map((run) => run.status)).toEqual(["success", "success"]);

      const outputs = runs.map((run) => JSON.parse(run.outputs_json));
      expect(outputs.map((output) => output.row_marker)).toEqual(["one", "two"]);
      expect(outputs.map((output) => output.batch_title)).toEqual([
        "Basic Fixture",
        "Basic Fixture",
      ]);

      for (const output of outputs) {
        expect(String(output.batch_screenshot)).toMatch(
          /^runs\/.+\/screenshots\/\d+-batch-screenshot-batch-row\.png$/,
        );
        await expect(
          fs.stat(path.join(appDataDir, "automation-app", "evidence", output.batch_screenshot)),
        ).resolves.toMatchObject({ size: expect.any(Number) });
        expect(output.__evidence).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              artifact_kind: "screenshot",
              node_id: "batch-screenshot",
            }),
          ]),
        );
      }

      const stepRows = database.prepare(
        "SELECT run_id, node_id, action_type, status FROM run_steps ORDER BY run_id, step_number",
      ).all() as Array<{
        run_id: string;
        node_id: string;
        action_type: string;
        status: string;
      }>;
      for (const run of runs) {
        const runSteps = stepRows.filter((step) => step.run_id === run.id);
        expect(runSteps).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ node_id: "navigate-basic", action_type: "navigate", status: "success" }),
            expect.objectContaining({ node_id: "record-row", action_type: "set_variable", status: "success" }),
            expect.objectContaining({ node_id: "extract-title", action_type: "extract_text", status: "success" }),
            expect.objectContaining({ node_id: "batch-screenshot", action_type: "take_screenshot", status: "success" }),
          ]),
        );
      }
    } finally {
      database.close();
    }
  });
});
