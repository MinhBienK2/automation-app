import { test, expect } from "./support/electronFixture";
import { createWorkflowWithoutRun, linearGraph } from "./support/workflows";

test.describe("desktop workflow package import and export", () => {
  test("exports, previews, and imports a workflow package without overwriting the source", async ({
    appWindow,
    fixtureServer,
  }) => {
    const sourceWorkflowId = await createWorkflowWithoutRun(
      appWindow,
      "Package source",
      linearGraph([
        {
          id: "navigate-basic",
          label: "Navigate Basic",
          config: { type: "navigate", config: { url: `${fixtureServer.baseUrl}/basic` } },
        },
      ]),
    );

    const result = await appWindow.evaluate(async (workflowId) => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      const settings = await api.getWorkflowSettings(workflowId);
      await api.saveWorkflowSettings(workflowId, {
        ...settings,
        general: {
          ...settings.general,
          description: "Exported through E2E",
          tags: ["e2e", "package"],
        },
        browser_launch: {
          ...settings.browser_launch,
          proxy_enabled: true,
          proxy_server: "http://proxy.local:8080",
          proxy_username: "agent",
          proxy_password: "secret",
        },
      });

      const packageValue = await api.exportWorkflowPackage(workflowId, {
        include_flow: true,
        settings_sections: ["general", "browser_launch"],
      });
      const preview = await api.previewWorkflowPackage(packageValue);
      const imported = await api.importWorkflowPackage(
        { ...packageValue, workflow: { name: "Imported package" } },
        { include_flow: true, settings_sections: ["general", "browser_launch"] },
      );
      return {
        packageValue,
        preview,
        imported,
        importedGraph: await api.getWorkflowGraph(imported.workflow.id),
        importedSettings: await api.getWorkflowSettings(imported.workflow.id),
      };
    }, sourceWorkflowId);

    expect(result.packageValue.settings?.browser_launch?.proxy_password).toBeNull();
    expect(result.packageValue.omitted_fields).toContain("settings.browser_launch.proxy_password");
    expect(result.preview).toMatchObject({
      workflow_name: "Package source",
      includes_flow: true,
      settings_sections: ["general", "browser_launch"],
    });
    expect(result.imported.workflow.name).toBe("Imported package (imported)");
    expect(result.importedGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "navigate-basic", node_type: "action" }),
      ]),
    );
    expect(result.importedSettings.general).toMatchObject({
      name: "Imported package (imported)",
      description: "Exported through E2E",
      tags: ["e2e", "package"],
    });
    expect(result.importedSettings.browser_launch.proxy_password).toBeNull();

    await appWindow.reload();
    await appWindow.getByRole("button", { name: "Projects", exact: true }).click();
    const projectDetail = appWindow.getByRole("region", { name: "Project detail" });
    await expect(projectDetail).toBeVisible();
    await projectDetail.getByRole("navigation", { name: "Project sections" }).getByRole("button", { name: "Workflows" }).click();
    await expect(appWindow.getByRole("heading", { name: "Workflows", exact: true }))
      .toBeVisible();
    await expect(appWindow.getByRole("heading", { name: "Package source" })).toBeVisible();
    await expect(appWindow.getByRole("heading", { name: "Imported package (imported)" }))
      .toBeVisible();
  });
});
