import { describe, expect, test } from "vitest";
import {
  defaultWorkflowSettings,
  workflowSettingsHelp,
  workflowSettingsSections,
} from "./workflowSettings";

describe("workflow settings model", () => {
  test("creates complete defaults for every settings section", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Login flow",
      createdAt: "1",
      updatedAt: "2",
    });

    expect(settings.workflow_id).toBe("workflow-1");
    expect(settings.version).toBe(1);
    expect(settings.general.name).toBe("Login flow");
    expect(settings.general.tags).toEqual([]);
    expect(settings.execution.browser_retention).toBe("retain");
    expect(settings.browser.challenge_policy).toBe("none");
    expect(settings.environment.permissions).toEqual([]);
    expect(settings.inputs.input_schema).toEqual([]);
    expect(settings.triggers.enabled).toBe(false);
    expect(settings.triggers.mode).toBe("manual");
    expect(settings.advanced.compatibility_warnings).toEqual([]);
  });

  test("defines sidebar sections and decision-guide help for each section", () => {
    expect(workflowSettingsSections.map((section) => section.id)).toEqual([
      "general",
      "execution",
      "browser",
      "environment",
      "inputs",
      "triggers",
      "advanced",
    ]);

    for (const section of workflowSettingsSections) {
      const help = workflowSettingsHelp[section.id];
      expect(help.title).toContain(section.label);
      expect(help.summary.length).toBeGreaterThan(20);
      expect(help.fieldGuide.length).toBeGreaterThan(0);
      expect(help.commonMistakes.length).toBeGreaterThan(0);
    }
  });
});
