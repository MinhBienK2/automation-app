import { test, expect } from "./support/electronFixture";
import { createWorkflowWithoutRun, linearGraph, runState } from "./support/workflows";

test.describe("desktop workflow user journeys", () => {
  test("creates a workflow through the UI and exposes graph and settings controls", async ({
    appWindow,
  }) => {
    await appWindow.getByRole("button", { name: "Create Workflow" }).click();
    const dialog = appWindow.getByRole("dialog", { name: "Create Workflow" });
    await expect(dialog).toBeVisible();

    await dialog.getByLabel("New workflow name").fill("UI authored workflow");
    await dialog.getByRole("button", { name: "Create" }).click();

    await expect(appWindow.getByRole("button", { name: "Back to Workflows" })).toBeVisible();
    const editor = appWindow.getByRole("region", { name: "Visual Graph" });
    await expect(editor).toBeVisible();
    await expect(editor.getByRole("button", { name: "Graph canvas node new-node" }))
      .toBeVisible();
    await expect(editor.getByRole("button", { name: "Add Action" })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Add Logic" })).toBeVisible();
    await expect(editor.getByRole("button", { name: "Add Variable" })).toBeVisible();

    const header = appWindow.getByRole("region", { name: "Workflow detail header" });
    await header.getByRole("button", { name: "Settings" }).click();
    const settings = appWindow.getByRole("dialog", { name: "Workflow Settings" });
    await expect(settings).toBeVisible();
    await expect(settings.getByRole("tab", { name: "Browser Launch" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(settings.getByRole("switch", { name: "Reuse login session" })).toBeVisible();
    await expect(settings.getByRole("switch", { name: "Use proxy" })).toBeVisible();
    await settings.getByRole("button", { name: "Close dialog" }).click();
    await expect(settings).toBeHidden();
  });

  test("runs a saved workflow from the list UI and observes terminal status", async ({
    appWindow,
    fixtureServer,
  }) => {
    await createWorkflowWithoutRun(
      appWindow,
      "UI runnable workflow",
      linearGraph([
        {
          id: "navigate-basic",
          label: "Navigate Basic",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/basic` } },
        },
        {
          id: "extract-status",
          label: "Extract Status",
          config: {
            type: "extract_text",
            config: {
              target: { locators: [{ kind: "test_id", value: "title" }] },
              output_name: "ui_title",
            },
          },
        },
      ]),
    );
    await appWindow.reload();
    await expect(appWindow.getByRole("heading", { name: "Workflows", exact: true }))
      .toBeVisible();

    await appWindow.getByRole("button", { name: "Run UI runnable workflow" }).click();
    await expect(appWindow.getByText("Running: UI runnable workflow")).toBeVisible();
    await expect(appWindow.getByRole("button", { name: "Run UI runnable workflow" }))
      .toBeDisabled();

    await expect
      .poll(() => runState(appWindow), { timeout: 45_000 })
      .toMatchObject({ status: "success", outputs: { ui_title: "Basic Fixture" } });
    await expect(appWindow.getByRole("status")).toHaveText(
      "Run succeeded: UI runnable workflow",
    );
  });

  test("deletes a workflow through the UI confirmation dialog", async ({ appWindow }) => {
    await createWorkflowWithoutRun(appWindow, "UI delete workflow", linearGraph([]));
    await appWindow.reload();
    await expect(appWindow.getByRole("heading", { name: "Workflows", exact: true }))
      .toBeVisible();

    await appWindow.getByRole("button", { name: "Delete UI delete workflow" }).click();
    const dialog = appWindow.getByRole("dialog", { name: "Delete Workflow" });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/This removes UI delete workflow/i)).toBeVisible();

    await dialog.getByRole("button", { name: "Delete Workflow" }).click();

    await expect(appWindow.getByRole("heading", { name: "UI delete workflow" })).toBeHidden();
    await expect(appWindow.getByText("No workflows yet")).toBeVisible();
  });
});
