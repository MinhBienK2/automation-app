import { describe, expect, test } from "vitest";
import {
  createDefaultBrowserProfileName,
  defaultWorkflowSettings,
  tagsFromInput,
  tagsToInput,
} from "./workflowSettingsDefaults";
import { withWorkflowSettingsDefaults } from "./workflowSettings";

describe("workflow settings defaults", () => {
  test("creates browser identity defaults from workflow metadata", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Login flow",
    });

    expect(settings.workflow_id).toBe("workflow-1");
    expect(settings.browser_launch.identity_id).toBe("bi_workflow-1");
    expect(settings.browser_launch.display_name).toBe("Login flow identity");
    expect(settings.browser_launch.profile_name).toBe("bi_workflow-1");
    expect(settings.graph_defaults.live_run_enabled).toBe(true);
  });

  test("normalizes profile names and comma-separated tags", () => {
    expect(createDefaultBrowserProfileName("A B/C")).toBe("profile-A_B_C");
    expect(tagsFromInput(" QA, login, qa ,, smoke ")).toEqual(["qa", "login", "smoke"]);
    expect(tagsToInput(["qa", "login"])).toBe("qa, login");
  });

  test("fills missing nested settings from workflow metadata defaults", () => {
    const defaults = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Login flow",
    });
    const merged = withWorkflowSettingsDefaults(
      {
        ...defaults,
        browser_launch: {
          display_name: "QA identity",
        },
        graph_defaults: {
          live_run_enabled: false,
        },
      } as typeof defaults,
      {
        workflowId: "workflow-1",
        workflowName: "Login flow",
      },
    );

    expect(merged.browser_launch.display_name).toBe("QA identity");
    expect(merged.browser_launch.identity_id).toBe(defaults.browser_launch.identity_id);
    expect(merged.browser_launch.profile_name).toBe(defaults.browser_launch.profile_name);
    expect(merged.graph_defaults.live_run_enabled).toBe(false);
    expect(merged.graph_defaults.live_run_follow_current)
      .toBe(defaults.graph_defaults.live_run_follow_current);
  });
});
