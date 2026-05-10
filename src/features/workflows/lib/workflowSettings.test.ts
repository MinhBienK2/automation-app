import { describe, expect, test } from "vitest";
import {
  applyBrowserDeviceProfile,
  createDefaultBrowserProfileName,
  defaultWorkflowSettings,
  variableRowsFromJsonText,
  variablesJsonFromRows,
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
    expect(settings.execution.direct_dom_fallback).toBe("explicit");
    expect(settings.execution.wait_between_nodes_enabled).toBe(false);
    expect(settings.execution.wait_between_nodes_random).toBe(false);
    expect(settings.execution.wait_between_nodes_ms).toBeNull();
    expect(settings.execution.wait_between_nodes_min_ms).toBeNull();
    expect(settings.execution.wait_between_nodes_max_ms).toBeNull();
    expect(settings.execution.batch_concurrency_limit).toBe(1);
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
      const helpByLanguage = workflowSettingsHelp[section.id];

      expect(Object.keys(helpByLanguage).sort()).toEqual(["en", "vi"]);

      for (const language of ["en", "vi"] as const) {
        const help = helpByLanguage[language];
        expect(help.title.length).toBeGreaterThan(10);
        expect(help.summary.length).toBeGreaterThan(80);
        expect(help.fieldGuide.length).toBeGreaterThanOrEqual(3);
        expect(help.commonMistakes.length).toBeGreaterThan(0);

        for (const field of help.fieldGuide) {
          expect(field.description.length).toBeGreaterThan(90);
          expect(field.whenToUse?.length ?? 0).toBeGreaterThan(40);
        }
      }
    }
  });

  test("applies browser device profile presets as coherent launch settings", () => {
    const settings = defaultWorkflowSettings({
      workflowId: "workflow-1",
      workflowName: "Login flow",
    });

    const android = applyBrowserDeviceProfile(settings.browser, "android_chrome");

    expect(android.user_agent).toContain("Android");
    expect(android.user_agent).toContain("Chrome/");
    expect(android.viewport_width).toBe(390);
    expect(android.viewport_height).toBe(844);
    expect(android.mobile).toBe(true);
    expect(android.touch).toBe(true);

    const custom = applyBrowserDeviceProfile(android, "custom");

    expect(custom).toEqual(android);
  });

  test("creates readable generated browser profile names", () => {
    expect(createDefaultBrowserProfileName("abc123")).toBe("profile-abc123");
    expect(createDefaultBrowserProfileName("A B/C")).toBe("profile-A_B_C");
  });

  test("converts initial variables between rows and JSON text", () => {
    const rows = variableRowsFromJsonText(
      `{
        "user": { "email": "ada@example.com" },
        "active": true,
        "count": 3,
        "flags": ["qa", "login"]
      }`,
    );

    expect(rows).toEqual({
      rows: [
        { name: "user.email", value_type: "text", value: "ada@example.com" },
        { name: "active", value_type: "boolean", value: "true" },
        { name: "count", value_type: "number", value: "3" },
        { name: "flags", value_type: "json", value: "[\"qa\",\"login\"]" },
      ],
      error: null,
    });

    expect(variablesJsonFromRows(rows.rows)).toBe(
      [
        "{",
        "  \"user\": {",
        "    \"email\": \"ada@example.com\"",
        "  },",
        "  \"active\": true,",
        "  \"count\": 3,",
        "  \"flags\": [",
        "    \"qa\",",
        "    \"login\"",
        "  ]",
        "}",
      ].join("\n"),
    );
  });
});
