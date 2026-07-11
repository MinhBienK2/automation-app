// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { Workflow, WorkflowSettings } from "../../../../src/types/workflow";
import {
  duplicateProjectWorkflowSettings,
  getBrowserProfileKey,
} from "./projectCommandCascades";

describe("project command cascade helpers", () => {
  test("copies workflow settings for a duplicated project workflow without retaining run-from-selected state", () => {
    const created: Workflow = {
      id: "workflow-copy",
      name: "Copied workflow",
      project_id: "project-copy",
      browser_profile_id: "environment-copy",
      created_at: "2026-05-27T12:00:00.000Z",
      updated_at: "2026-05-27T12:00:00.000Z",
    };
    const browserLaunch = {
      ...settings().browser_launch,
      identity_id: "identity-copy",
      profile_dir: "identity-copy",
      profile_name: "identity-copy",
    };

    const copied = duplicateProjectWorkflowSettings(settings(), created, browserLaunch);

    expect(copied).toMatchObject({
      workflow_id: "workflow-copy",
      general: {
        name: "Copied workflow",
        created_at: "2026-05-27T12:00:00.000Z",
        updated_at: "2026-05-27T12:00:00.000Z",
      },
      run_policy: {
        run_from_selected_enabled: false,
      },
      browser_launch: {
        identity_id: "identity-copy",
        profile_dir: "identity-copy",
        profile_name: "identity-copy",
      },
      created_at: "2026-05-27T12:00:00.000Z",
      updated_at: "2026-05-27T12:00:00.000Z",
    });
  });

  test("returns the persistent browser profile key", () => {
    expect(getBrowserProfileKey({
      id: "environment-1",
      project_id: "project-1",
      name: "Saved session",
      description: "",
      is_default: true,
      browser_launch: {
        ...settings().browser_launch,
        session_mode: "persistent_profile",
        profile_dir: "profile-dir",
        profile_name: "profile-name",
      },
      created_at: "2026-05-27T12:00:00.000Z",
      updated_at: "2026-05-27T12:00:00.000Z",
    })).toBe("profile-dir");
  });
});

function settings(): WorkflowSettings {
  return {
    workflow_id: "workflow-source",
    version: 2,
    general: {
      name: "Source workflow",
      description: "",
      tags: [],
      notes: "",
      created_at: "2026-05-27T10:00:00.000Z",
      updated_at: "2026-05-27T10:00:00.000Z",
    },
    run_policy: {
      browser_retention: "retain",
      execute_js_enabled: true,
      run_from_selected_enabled: true,
      run_from_selected_mode: "from_selected",
      batch_headless: true,
      batch_stop_on_first_failed_row: true,
    },
    browser_launch: {
      proxy_enabled: false,
      session_mode: "persistent_profile",
      identity_id: "identity-source",
      display_name: "Identity",
      persona_id: "persona",
      persona: {
        id: "persona",
        label: "Persona",
        rationale: "",
        os_bucket: "linux_desktop",
        browser_channel_bucket: "chromium_stable",
        viewport: { width: 1280, height: 720 },
        window: { width: 1280, height: 720 },
        timezone: "UTC",
        locale: "en-US",
        proxy_geo_policy: "direct",
        webrtc_mode: "default",
        font_bundle: { label: "System", expected_families: [] },
        behavioral_timing_profile: "default",
      },
      profile_dir: "identity-source",
      profile_name: "identity-source",
      fingerprint_seed: "seed-source",
      geoip: true,
      webrtc_policy: "default",
      headless: true,
      humanize: true,
      human_preset: "default",
    },
    graph_defaults: {
      default_edge_delay: null,
      live_run_enabled: true,
      live_run_follow_current: false,
    },
    environment: {
      initial_variables: [],
    },
    migration_notes: [],
    created_at: "2026-05-27T10:00:00.000Z",
    updated_at: "2026-05-27T10:00:00.000Z",
  };
}
