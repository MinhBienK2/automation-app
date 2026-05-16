import { describe, expect, test } from "vitest";
import {
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
    expect(settings.version).toBe(2);
    expect(settings.general.name).toBe("Login flow");
    expect(settings.general.tags).toEqual([]);
    expect(settings.run_policy.browser_retention).toBe("retain");
    expect(settings.run_policy.batch_concurrency_limit).toBe(1);
    expect(settings.browser_launch.session_mode).toBe("persistent_profile");
    expect(settings.browser_launch.identity_id).toBe("bi_workflow-1");
    expect(settings.browser_launch.display_name).toBe("Login flow identity");
    expect(settings.browser_launch.profile_dir).toBe("bi_workflow-1");
    expect(settings.browser_launch.profile_name).toBe("bi_workflow-1");
    expect(settings.browser_launch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(settings.browser_launch).not.toHaveProperty("humanize");
    expect(settings.browser_launch).not.toHaveProperty("human_preset");
    expect(settings.browser_launch).not.toHaveProperty("behavior_fidelity");
    expect(settings.browser_launch.proxy_provider).toBeNull();
    expect(settings.browser_launch.test_account_binding).toBeNull();
    expect(settings.browser_launch.fingerprint_platform).toBeNull();
    expect(settings.browser_launch.hardware_concurrency).toBeNull();
    expect(settings.browser_launch.device_memory_gb).toBeNull();
    expect(settings.browser_launch.viewport_width).toBe(1920);
    expect(settings.browser_launch.viewport_height).toBe(947);
    expect(settings.browser_launch.proxy_enabled).toBe(false);
    expect(settings.browser_launch.headless).toBe(false);
    expect(settings.environment.initial_variables).toEqual([]);
    expect(settings).not.toHaveProperty("owned_test_gates");
    expect(settings.migration_notes).toEqual([]);
    expect(settings).not.toHaveProperty("execution");
    expect(settings).not.toHaveProperty("browser");
    expect(settings).not.toHaveProperty("inputs");
    expect(settings).not.toHaveProperty("triggers");
    expect(settings).not.toHaveProperty("advanced");
  });

  test("defines sidebar sections and decision-guide help for each section", () => {
    const visibleSectionIds = [
      "general",
      "run_policy",
      "browser_launch",
      "environment",
    ];
    expect(workflowSettingsSections.map((section) => section.id)).toEqual(visibleSectionIds);
    expect(Object.keys(workflowSettingsHelp).sort()).toEqual([...visibleSectionIds].sort());

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

  test("keeps settings help aligned with the visible Workflow Settings dialog", () => {
    const helpText = JSON.stringify(workflowSettingsHelp);

    for (const staleTerm of [
      "Default action timeout",
      "Default retry attempts",
      "Default retry interval",
      "Wait between nodes",
      "Device profile",
      "User agent",
      "Mobile viewport",
      "Touch input",
      "Challenge policy",
      "Triggers Settings Help",
      "Advanced Settings Help",
      "Variables Settings Help",
    ]) {
      expect(helpText).not.toContain(staleTerm);
    }

    expect(workflowSettingsHelp.run_policy.en.title).toBe("Run Policy Settings Help");
    expect(workflowSettingsHelp.run_policy.en.fieldGuide.map((field) => field.name)).toEqual([
      "Max workflow duration ms",
      "Browser retention",
      "Batch concurrency limit",
      "Batch runs are headless",
      "Stop batch on first failed row",
    ]);
    expect(workflowSettingsHelp.browser_launch.en.title).toBe("Browser Identity Settings Help");
    expect(workflowSettingsHelp.browser_launch.en.fieldGuide.map((field) => field.name)).toEqual([
      "Reuse login session",
      "Identity display name",
      "Profile directory",
      "Fingerprint seed",
      "Enable Run from selected",
      "Use proxy",
      "Proxy server",
      "Proxy username",
      "Proxy password",
      "Proxy metadata",
      "Timezone",
      "Locale",
      "GeoIP from proxy",
      "Viewport",
      "Advanced fingerprint overrides",
      "Fingerprint preflight",
      "Headless browser",
    ]);
    expect(workflowSettingsHelp.environment.en.title).toBe("Environment Settings Help");
    expect(helpText).not.toContain("Owned Test Gates");
    expect(helpText).toContain("Fingerprint preflight");
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
