import { test, expect } from "./support/electronFixture";
import { linearGraph, runState } from "./support/workflows";

test.describe("run from selected real session", () => {
  test("enables the detail action after a retained workflow run and selected node", async ({
    appWindow,
    fixtureServer,
  }) => {
    const graph = linearGraph([
      {
        id: "visit",
        label: "Visit fixture",
        config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/basic` } },
      },
      {
        id: "extract-title",
        label: "Extract title",
        config: {
          type: "extract_text",
          config: {
            target: { locators: [{ kind: "test_id", value: "title" }] },
            output_name: "fixture_title",
          },
        },
      },
    ]);

    await appWindow.evaluate(async ({ workflowGraph }) => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");

      const workflow = await api.createWorkflow("Run from selected retained session");
      const settings = await api.getWorkflowSettings(workflow.id);
      await api.saveWorkflowSettings(workflow.id, {
        ...settings,
        run_policy: {
          ...settings.run_policy,
          browser_retention: "retain",
          run_from_selected_enabled: true,
          run_from_selected_mode: "from_selected",
        },
        browser_launch: {
          ...settings.browser_launch,
          session_mode: "persistent_profile",
          profile_name:
            settings.browser_launch.profile_dir ??
            settings.browser_launch.profile_name,
          headless: true,
        },
      });
      await api.saveWorkflowGraph(workflow.id, workflowGraph);
      await api.runWorkflow(workflow.id);
    }, { workflowGraph: graph });

    await expect
      .poll(() => runState(appWindow), { timeout: 45_000 })
      .toMatchObject({
        status: "success",
        retained_session: { available: true },
        outputs: { fixture_title: "Basic Fixture" },
      });

    await appWindow.reload();
    await expect(appWindow.getByRole("heading", { name: "Workflows", exact: true }))
      .toBeVisible();
    await appWindow.getByRole("button", { name: "View Details" }).click();

    const editor = appWindow.getByRole("region", { name: "Visual Graph" });
    await editor.getByRole("button", { name: "Graph canvas node visit" }).click();

    const runFromSelected = appWindow.getByRole("button", { name: "Run from selected" });
    await expect(runFromSelected).toBeEnabled();
    await expect(runFromSelected).toHaveAttribute(
      "title",
      "Run from the selected node using the retained browser session.",
    );
    const runCountBefore = await appWindow.evaluate(async () => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      return (await api.listRunStates()).length;
    });
    await runFromSelected.click();
    await appWindow.getByRole("menuitem", { name: "Run from selected node onward" }).click();
    await expect
      .poll(
        () =>
          appWindow.evaluate(async () => {
            const api = window.workflowApi;
            if (!api) throw new Error("Workflow API bridge is unavailable");
            const snapshots = await api.listRunStates();
            const latest = snapshots[snapshots.length - 1];
            return {
              count: snapshots.length,
              status: latest?.state.status,
              target: latest?.state.target_step_id,
              retained: latest?.state.retained_session?.available,
            };
          }),
        { timeout: 45_000 },
      )
      .toMatchObject({
        count: runCountBefore + 1,
        status: "success",
        target: "visit",
        retained: true,
      });
  });
});
