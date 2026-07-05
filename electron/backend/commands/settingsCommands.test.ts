// @vitest-environment node

import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, test, vi } from "vitest";
import {
  createTestHandlers,
  tempRoots,
  runnableGraph,
  type ProjectWorkflowTestHandlers,
} from "../commands.testHelpers";
import type {
  WorkflowSettings,
  RunState,
  WorkflowPackage,
  WorkflowExport,
} from "../../../src/types/workflow";
import { deriveFingerprintSeedFromIdentityId } from "../commands";

vi.mock("electron", () => ({
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

describe("Settings commands integration", () => {
  test("rotates browser identity through backend-owned high-entropy generation", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Identity reset");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "identity-fonts-"));
    tempRoots.push(fontsDir);
    await handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      run_policy: {
        ...settings.run_policy,
        run_from_selected_enabled: true,
      },
      browser_launch: {
        ...settings.browser_launch,
        proxy_enabled: true,
        proxy_server: "http://proxy.local:8080",
        timezone: "America/New_York",
        locale: "en-US",
        fingerprint_fonts_dir: fontsDir,
      },
    });

    const rotated = await handlers.resetWorkflowBrowserIdentity(workflow.id);

    expect(rotated.browser_launch.identity_id).toMatch(/^bi_[a-f0-9]{32}$/);
    expect(rotated.browser_launch.identity_id).not.toBe(settings.browser_launch.identity_id);
    expect(rotated.browser_launch.profile_dir).toBe(rotated.browser_launch.identity_id);
    expect(rotated.browser_launch.profile_name).toBe(rotated.browser_launch.identity_id);
    expect(rotated.browser_launch.fingerprint_seed).toMatch(/^\d{5}$/);
    expect(rotated.browser_launch.fingerprint_seed).toBe(
      deriveFingerprintSeedFromIdentityId(rotated.browser_launch.identity_id),
    );
    expect(rotated.run_policy.run_from_selected_enabled).toBe(false);
    expect(rotated.browser_launch.proxy_enabled).toBe(true);
    expect(rotated.browser_launch.proxy_server).toBe("http://proxy.local:8080");
    expect(rotated.browser_launch.timezone).toBe("America/New_York");
    expect(rotated.browser_launch.locale).toBe("en-US");
    expect(rotated.browser_launch.fingerprint_fonts_dir).toBe(fontsDir);
    expect(rotated.migration_notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "browser_launch.identity_id",
          action: "rotated",
          message: expect.stringContaining(settings.browser_launch.identity_id),
        }),
      ]),
    );
    expect((await handlers.getWorkflowSettings(workflow.id)).browser_launch.identity_id)
      .toBe(rotated.browser_launch.identity_id);
  });

  test("builds Identity Lab overview from current identity snapshots and closes retained sessions", async () => {
    const closeRetainedSession = vi.fn(async () => undefined);
    const { handlers, database } = await createTestHandlers({
      runner: {
        run: vi.fn(),
        closeRetainedSession,
        getRetainedSessionState: vi.fn((workflowId?: string | null, profileName?: string | null) => ({
          available: workflowId === "workflow-identity" && profileName === "profile-current",
          workflow_id: workflowId ?? null,
          profile_name: profileName ?? null,
          reason: workflowId === "workflow-identity" ? null : "No retained session",
        })),
        getRetainedSessionStates: vi.fn(() => [
          {
            available: true,
            workflow_id: "workflow-identity",
            profile_name: "profile-current",
            reason: null,
          },
        ]),
      },
    });
    const workflow = await handlers.createWorkflow("Identity flow");
    await database.execute("PRAGMA foreign_keys = OFF");
    await database.execute("UPDATE workflows SET id = $1 WHERE id = $2", ["workflow-identity", workflow.id]);
    await database.execute("UPDATE workflow_nodes SET workflow_id = $1 WHERE workflow_id = $2", ["workflow-identity", workflow.id]);
    await database.execute("UPDATE workflow_edges SET workflow_id = $1 WHERE workflow_id = $2", ["workflow-identity", workflow.id]);
    await database.execute("PRAGMA foreign_keys = ON");
    const settings = await handlers.getWorkflowSettings("workflow-identity");
    await handlers.saveWorkflowSettings("workflow-identity", {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        identity_id: "bi_current",
        display_name: "Current identity",
        profile_dir: "profile-current",
        profile_name: "profile-current",
        persona: {
          ...settings.browser_launch.persona,
          label: "Windows Chrome",
        },
        proxy_enabled: true,
        proxy_server: "http://user:secret@proxy.local:8080",
      },
      migration_notes: [
        {
          path: "browser_launch.identity_id",
          action: "rotated",
          message: "Browser identity rotated from bi_old to bi_current at 2026-05-27T08:00:00.000Z",
        },
      ],
    });
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at,
        settings_snapshot_json, outputs_json, error_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        "run-old",
        "workflow-identity",
        "manual",
        "success",
        "2026-05-27T07:00:00.000Z",
        "2026-05-27T07:01:00.000Z",
        JSON.stringify({ browser_launch: { identity_id: "bi_old", display_name: "Old identity" } }),
        JSON.stringify({ browser_identity: { identity_id: "bi_old" } }),
        null,
        database.ownerId,
      ]
    );
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at,
        settings_snapshot_json, outputs_json, error_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        "run-current",
        "workflow-identity",
        "manual",
        "failed",
        new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        new Date(Date.now() - 55 * 60 * 1000).toISOString(),
        JSON.stringify({
          browser_launch: { identity_id: "bi_current", display_name: "Current identity" },
        }),
        JSON.stringify({
          browser_identity: {
            identity_id: "bi_current",
            display_name: "Current identity",
            fingerprint_seed_hash: "seed-hash",
            proxy_password: "should-not-leak",
          },
          __evidence: [
            {
              artifact_kind: "screenshot",
              path: "runs/run-current/screenshots/one.png",
            },
            {
              artifact_kind: "download",
              path: "runs/run-current/downloads/two.csv",
            },
            {
              artifact_kind: "screenshot",
              path: "C:Users\\operator\\secret.png",
            },
          ],
        }),
        JSON.stringify({ reason: "Assertion failed" }),
        database.ownerId,
      ]
    );

    const overview = await handlers.getIdentityLabOverview();

    expect(overview.counts).toMatchObject({
      managed_identities: 1,
      active_retained_sessions: 1,
      identities_with_recent_failures: 1,
    });
    expect(overview.items).toEqual([
      expect.objectContaining({
        workflow_ref: { id: "workflow-identity", name: "Identity flow" },
        identity_ref: { id: "bi_current", display_name: "Current identity" },
        retained_session: { active: true },
        last_run: expect.objectContaining({ run_id: "run-current", status: "failed" }),
        recent_failures_24h: 1,
      }),
    ]);
    expect(overview.selected).toMatchObject({
      kind: "managed",
      latest_observed: expect.objectContaining({
        run_id: "run-current",
        fields: expect.arrayContaining([{ key: "fingerprint_seed_hash", value: "seed-hash" }]),
      }),
      rotation_history: [expect.objectContaining({ previous_identity_id: "bi_old" })],
      evidence_summary: { total: 2 },
      actions: {
        can_close_retained_session: true,
        can_reset_identity: false,
      },
    });
    expect(JSON.stringify(overview)).not.toContain("secret");
    expect(JSON.stringify(overview)).not.toContain("should-not-leak");

    await handlers.closeIdentityRetainedSession("workflow-identity", "profile-current");
    expect(closeRetainedSession).toHaveBeenCalledWith("workflow-identity", "profile-current");
  });

  test("filters getIdentityLabOverview by project_id", async () => {
    const { handlers } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const projectA = await projectHandlers.createProject({ name: "Project A" });
    const projectB = await projectHandlers.createProject({ name: "Project B" });
    const workflows = await handlers.listWorkflows();
    const workflowA = workflows.find(w => w.project_id === projectA.id)!;
    const workflowB = workflows.find(w => w.project_id === projectB.id)!;
    const overviewA = await handlers.getIdentityLabOverview({ project_id: projectA.id });
    expect(overviewA.items.map(item => item.workflow_ref.id)).toContain(workflowA.id);
    expect(overviewA.items.map(item => item.workflow_ref.id)).not.toContain(workflowB.id);
    const overviewB = await handlers.getIdentityLabOverview({ project_id: projectB.id });
    expect(overviewB.items.map(item => item.workflow_ref.id)).toContain(workflowB.id);
    expect(overviewB.items.map(item => item.workflow_ref.id)).not.toContain(workflowA.id);
  });

  test("resolves stale managed identity targets with historical run context", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Rotated identity flow");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    await handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        identity_id: "bi_current",
        display_name: "Current identity",
      },
    });
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at,
        settings_snapshot_json, outputs_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        "run-old-identity",
        workflow.id,
        "manual",
        "success",
        "2026-05-27T07:00:00.000Z",
        "2026-05-27T07:01:00.000Z",
        JSON.stringify({
          browser_launch: { identity_id: "bi_old", display_name: "Old identity" },
        }),
        JSON.stringify({
          browser_identity: {
            identity_id: "bi_old",
            display_name: "Old identity",
            fingerprint_seed_hash: "old-seed",
          },
        }),
        database.ownerId,
      ]
    );

    const overview = await handlers.getIdentityLabOverview({
      selected_target: {
        type: "managed",
        workflow_id: workflow.id,
        identity_id: "bi_old",
      },
    });

    expect(overview.selected).toMatchObject({
      kind: "historical",
      workflow_ref: { id: workflow.id, name: "Rotated identity flow" },
      run_id: "run-old-identity",
      observed_fields: expect.arrayContaining([
        { key: "identity_id", value: "bi_old" },
        { key: "fingerprint_seed_hash", value: "old-seed" },
      ]),
    });
  });

  test("resolves historical identities older than the newest 200 workflow runs", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Long identity archive");
    const insertRun = async (
      id: string,
      workflowId: string,
      status: string,
      startedAt: string,
      finishedAt: string,
      settingsSnapshotJson: string,
      outputsJson: string
    ) => {
      await database.execute(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at,
          settings_snapshot_json, outputs_json, owner_id
        ) VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7, $8)`,
        [id, workflowId, status, startedAt, finishedAt, settingsSnapshotJson, outputsJson, database.ownerId]
      );
    };

    await insertRun(
      "run-archived-identity",
      workflow.id,
      "success",
      "2026-01-01T07:00:00.000Z",
      "2026-01-01T07:01:00.000Z",
      JSON.stringify({ browser_launch: { identity_id: "bi_archived" } }),
      JSON.stringify({ browser_identity: { identity_id: "bi_archived" } }),
    );
    for (let index = 0; index < 200; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 0)).toISOString();
      const finishedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 30)).toISOString();
      await insertRun(
        `run-new-identity-${index}`,
        workflow.id,
        "success",
        startedAt,
        finishedAt,
        JSON.stringify({ browser_launch: { identity_id: "bi_current" } }),
        JSON.stringify({ browser_identity: { identity_id: "bi_current" } }),
      );
    }

    const overview = await handlers.getIdentityLabOverview({
      selected_target: {
        type: "historical",
        workflow_id: workflow.id,
        identity_id: "bi_archived",
      },
    });

    expect(overview.selected).toMatchObject({
      kind: "historical",
      run_id: "run-archived-identity",
      observed_fields: expect.arrayContaining([{ key: "identity_id", value: "bi_archived" }]),
    });
  });

  test("derives historical identity workflow context from the matched run", async () => {
    const { handlers, database } = await createTestHandlers();
    const historicalWorkflow = await handlers.createWorkflow("Historical identity source");
    const otherWorkflow = await handlers.createWorkflow("Unrelated current workflow");
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at,
        settings_snapshot_json, outputs_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        "run-cross-workflow-history",
        historicalWorkflow.id,
        "manual",
        "success",
        "2026-05-27T07:00:00.000Z",
        "2026-05-27T07:01:00.000Z",
        JSON.stringify({ browser_launch: { identity_id: "bi_cross_history" } }),
        JSON.stringify({ browser_identity: { identity_id: "bi_cross_history" } }),
        database.ownerId,
      ]
    );

    const overview = await handlers.getIdentityLabOverview({
      selected_target: {
        type: "historical",
        workflow_id: otherWorkflow.id,
        identity_id: "bi_cross_history",
        run_id: "run-cross-workflow-history",
      },
    });

    expect(overview.selected).toMatchObject({
      kind: "historical",
      workflow_ref: { id: historicalWorkflow.id, name: "Historical identity source" },
      run_id: "run-cross-workflow-history",
    });
  });

  test("derives deterministic CloakBrowser seeds and probes collisions", () => {
    const identityId = "bi_11111111111111111111111111111111";
    const firstSeed = deriveFingerprintSeedFromIdentityId(identityId);

    expect(firstSeed).toMatch(/^\d{5}$/);
    expect(deriveFingerprintSeedFromIdentityId(identityId)).toBe(firstSeed);
    expect(deriveFingerprintSeedFromIdentityId(identityId, new Set([firstSeed])))
      .not.toBe(firstSeed);
    expect(deriveFingerprintSeedFromIdentityId(identityId, new Set([firstSeed])))
      .toMatch(/^\d{5}$/);
  });

  test("never deletes browser profile data when a workflow is deleted", async () => {
    const { handlers, appPaths } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Delete me");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    const profilePath = path.join(
      appPaths.browserProfilesDir,
      settings.browser_launch.profile_dir,
    );
    await fs.mkdir(profilePath, { recursive: true });
    await fs.writeFile(path.join(profilePath, "storage.txt"), "state");

    await handlers.deleteWorkflow(workflow.id, { deleteBrowserProfile: true });

    expect(await handlers.getWorkflow(workflow.id)).toBeNull();
    // Verify browser profile directory on disk is preserved because it belongs to the project
    await expect(fs.stat(profilePath)).resolves.toBeTruthy();
  });


  test("reports CloakBrowser diagnostics and profile storage without secrets", async () => {
    const { handlers, appPaths, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Diagnostics flow");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    await handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        display_name: "QA US Login",
        proxy_enabled: true,
        proxy_server: "http://proxy.test:8080",
        proxy_password: "secret-proxy-password",
      },
    });
    const profileDir = (await handlers.getWorkflowSettings(workflow.id)).browser_launch.profile_dir;
    await fs.mkdir(path.join(appPaths.browserProfilesDir, profileDir), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, profileDir, "storage.txt"), "state");
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at, outputs_json, owner_id
      ) VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7)`,
      [
        "run-diagnostics",
        workflow.id,
        "success",
        "2026-05-15T00:00:00.000Z",
        "2026-05-15T00:00:02.000Z",
        JSON.stringify({ browser_identity: { identity_id: "bi_qa" } }),
        database.ownerId,
      ]
    );

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.wrapper_version).toMatch(/^\d+\.\d+\.\d+/);
    expect(diagnostics.binary.version).toMatch(/^\d+/);
    expect(diagnostics.binary.platform).toBeTruthy();
    expect(typeof diagnostics.binary.installed).toBe("boolean");
    expect(diagnostics.profile_root).toBe(appPaths.browserProfilesDir);
    expect(diagnostics.geoip_available).toBe(true);
    expect(diagnostics.font_checklist).toMatchObject({
      status: "not_configured",
      reason: "No workflow has a fingerprint fonts directory configured",
      directories: [],
    });
    expect(diagnostics.last_smoke_result).toEqual({
      status: "not_recorded",
      reason: "Smoke tests are recorded by the npm run test:smoke command output",
    });
    expect(diagnostics.profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          profile_dir: profileDir,
          display_name: "QA US Login",
          approximate_size_bytes: expect.any(Number),
          active_session: false,
        }),
      ]),
    );
    expect(diagnostics.profiles[0]?.last_run_at).toBe("2026-05-15T00:00:02.000Z");
    expect(JSON.stringify(diagnostics)).not.toContain("secret-proxy-password");
  });

  test("reports configured fingerprint font directory hash and expected family coverage", async () => {
    const { handlers } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Font diagnostics");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "font-diagnostics-"));
    tempRoots.push(fontsDir);
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    await fs.writeFile(path.join(fontsDir, "NotoSans-Regular.otf"), "noto");
    await fs.writeFile(path.join(fontsDir, "CourierNew.ttf"), "courier");
    await handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        fingerprint_fonts_dir: fontsDir,
      },
    });

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.font_checklist.status).toBe("ok");
    expect(diagnostics.font_checklist.directories).toEqual([
      expect.objectContaining({
        path: fontsDir,
        status: "ok",
        file_count: 3,
        total_size_bytes: 16,
        normalized_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expected_families_present: expect.arrayContaining(["arial", "courier", "noto"]),
        missing_expected_families: [],
        workflow_ids: [workflow.id],
      }),
    ]);
  });

  test("reports missing and shared fingerprint font directories as actionable diagnostics", async () => {
    const { handlers, database } = await createTestHandlers();
    const projectHandlers = handlers as typeof handlers & ProjectWorkflowTestHandlers;
    const owner = await handlers.createWorkflow("Font owner");
    const shared = await handlers.createWorkflow("Font shared");
    const missing = await handlers.createWorkflow("Font missing");
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "shared-fonts-"));
    tempRoots.push(fontsDir);
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    await fs.writeFile(path.join(fontsDir, "NotoSans-Regular.otf"), "noto");
    await fs.writeFile(path.join(fontsDir, "CourierNew.ttf"), "courier");
    const ownerSettings = await handlers.getWorkflowSettings(owner.id);
    const sharedProfile = await projectHandlers.createBrowserProfile(owner.project_id ?? "", {
      name: "Shared font profile",
    });
    const missingProfile = await projectHandlers.createBrowserProfile(owner.project_id ?? "", {
      name: "Missing font profile",
    });
    await projectHandlers.setWorkflowBrowserProfile(shared.id, sharedProfile.id);
    await projectHandlers.setWorkflowBrowserProfile(missing.id, missingProfile.id);
    await handlers.saveWorkflowSettings(owner.id, {
      ...ownerSettings,
      browser_launch: {
        ...ownerSettings.browser_launch,
        fingerprint_fonts_dir: fontsDir,
      },
    });
    await projectHandlers.updateBrowserProfile(sharedProfile.id, {
      browser_launch: {
        ...sharedProfile.browser_launch,
        fingerprint_fonts_dir: fontsDir,
      },
    });
    await database.execute(
      "UPDATE browser_profiles SET browser_launch_json = $1 WHERE id = $2",
      [
        JSON.stringify({
          ...missingProfile.browser_launch,
          fingerprint_fonts_dir: path.join(os.tmpdir(), "missing-font-bundle"),
        }),
        missingProfile.id,
      ]
    );
    await database.execute(
      "UPDATE browser_profiles SET browser_launch_json = $1 WHERE id = $2",
      [
        JSON.stringify({
          ...missingProfile.browser_launch,
          fingerprint_fonts_dir: path.join(os.tmpdir(), "missing-font-bundle"),
        }),
        missingProfile.id,
      ]
    );

    const diagnostics = await handlers.getCloakBrowserDiagnostics();

    expect(diagnostics.font_checklist.status).toBe("error");
    expect(diagnostics.font_checklist.reason).toContain("missing");
    expect(diagnostics.font_checklist.directories).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: fontsDir,
          status: "warning",
          workflow_ids: expect.arrayContaining([owner.id, shared.id]),
          reason: expect.stringContaining("shared"),
        }),
        expect.objectContaining({
          status: "missing",
          reason: expect.stringContaining("not readable"),
          workflow_ids: [missing.id],
        }),
      ]),
    );
  });

  test("caps browser profile size traversal during diagnostics", async () => {
    const previousLimit = process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES;
    process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES = "1";
    try {
      const { handlers, appPaths } = await createTestHandlers();
      const workflow = await handlers.createWorkflow("Large profile diagnostics");
      const profileDir = (await handlers.getWorkflowSettings(workflow.id)).browser_launch.profile_dir;
      const profilePath = path.join(appPaths.browserProfilesDir, profileDir);
      await fs.mkdir(profilePath, { recursive: true });
      await fs.writeFile(path.join(profilePath, "a.bin"), "a".repeat(100));
      await fs.writeFile(path.join(profilePath, "b.bin"), "b".repeat(100));

      const diagnostics = await handlers.getCloakBrowserDiagnostics();
      const profile = diagnostics.profiles.find((candidate) => candidate.profile_dir === profileDir);

      expect(profile?.approximate_size_bytes).toBeLessThan(200);
    } finally {
      if (previousLimit === undefined) {
        delete process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES;
      } else {
        process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES = previousLimit;
      }
    }
  });

  test("cleans up only orphaned inactive CloakBrowser profiles", async () => {
    const activeRunner = {
      run: vi.fn(),
      getRetainedSessionState: vi.fn(() => ({
        available: true,
        workflow_id: "active-workflow",
        profile_name: "active-profile",
        reason: null,
      })),
    };
    const { handlers, appPaths } = await createTestHandlers({ runner: activeRunner });
    const workflow = await handlers.createWorkflow("Persistent profile");
    const profileDir = (await handlers.getWorkflowSettings(workflow.id)).browser_launch.profile_dir;
    await fs.mkdir(path.join(appPaths.browserProfilesDir, profileDir), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, profileDir, "state.txt"), "state");
    await fs.mkdir(path.join(appPaths.browserProfilesDir, "orphan-profile"), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, "orphan-profile", "cache.bin"), "cache");
    await fs.mkdir(path.join(appPaths.browserProfilesDir, "active-profile"), { recursive: true });
    await fs.writeFile(path.join(appPaths.browserProfilesDir, "active-profile", "lock"), "lock");

    const result = await handlers.cleanupOrphanedBrowserProfiles();

    expect(result.deleted_profiles).toEqual(["orphan-profile"]);
    expect(result.reclaimed_bytes).toBeGreaterThan(0);
    expect(result.skipped_profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ profile_dir: profileDir, workflow_id: workflow.id }),
        expect.objectContaining({ profile_dir: "active-profile", active_session: true }),
      ]),
    );
    await expect(fs.stat(path.join(appPaths.browserProfilesDir, "orphan-profile"))).rejects.toThrow();
    await expect(fs.stat(path.join(appPaths.browserProfilesDir, profileDir))).resolves.toBeTruthy();
    await expect(fs.stat(path.join(appPaths.browserProfilesDir, "active-profile"))).resolves.toBeTruthy();
  });

  test("prevents changing or deleting an actively retained browser identity profile", async () => {
    const runner = {
      run: vi.fn(),
      getRetainedSessionState: vi.fn(() => ({
        available: true,
        workflow_id: "workflow-1",
        profile_name: "bi_workflow-1",
        reason: null,
      })),
    };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = await handlers.createWorkflow("Active identity");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    runner.getRetainedSessionState.mockReturnValue({
      available: true,
      workflow_id: workflow.id,
      profile_name: settings.browser_launch.profile_dir,
      reason: null,
    });

    await expect(handlers.saveWorkflowSettings(workflow.id, {
        ...settings,
        browser_launch: {
          ...settings.browser_launch,
          identity_id: "bi_rotated",
          profile_dir: "bi_rotated",
          fingerprint_seed: "99999",
          profile_name: "bi_rotated",
        },
      }),
    ).rejects.toThrow("Close the retained browser session before changing or deleting its identity profile");

    await expect(handlers.deleteWorkflow(workflow.id)).rejects.toThrow(
      "Close the retained browser session before changing or deleting its identity profile",
    );
  });

  test("rejects backend identity rotation while a retained browser session owns the profile", async () => {
    const runner = {
      run: vi.fn(),
      getRetainedSessionState: vi.fn(),
      getRetainedSessionStates: vi.fn(() => []),
      hasReusableRetainedSession: vi.fn(() => true),
    };
    const { handlers } = await createTestHandlers({ runner });
    const workflow = await handlers.createWorkflow("Active reset");
    const settings = await handlers.getWorkflowSettings(workflow.id);
    runner.getRetainedSessionState.mockReturnValue({
      available: true,
      workflow_id: workflow.id,
      profile_name: settings.browser_launch.profile_dir,
      reason: null,
    });

    await expect(handlers.resetWorkflowBrowserIdentity(workflow.id)).rejects.toThrow(
      "Close the retained browser session before resetting this browser identity",
    );
  });

  test("dry-run validates action configs through backend validation", async () => {
    const { handlers } = await createTestHandlers();

    expect(() =>
      handlers.dryRunValidateConfig({
        type: "navigate",
        config: { url: " " },
      })
    ).toThrow("URL is required");

    expect(() =>
      handlers.dryRunValidateConfig({
        type: "set_json_variables",
        config: { json: "[1,2,3]" },
      })
    ).toThrow("JSON variables must be an object");
  });

  test("records blocked manual launches and exposes the durable operations overview", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Checkout flow");
    await handlers.saveWorkflowGraph(workflow.id, {
      version: 2,
      nodes: [],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    });

    await expect(handlers.runWorkflow(workflow.id)).rejects.toMatchObject({
      message: "Graph must contain exactly one start node",
    });

    const attentionRows = await database.query(
      "SELECT event_type, source, workflow_id, severity, summary FROM operational_attention_events"
    ) as Array<Record<string, string>>;
    expect(attentionRows).toEqual([
      expect.objectContaining({
        event_type: "launch_blocked",
        source: "manual",
        workflow_id: workflow.id,
        severity: "failure",
        summary: "Graph must contain exactly one start node",
      }),
    ]);

    const overview = await handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });
    expect(overview.metrics.attention_today).toBe(1);
    expect(overview.metrics.active_runs).toBe(0);
    expect(overview.attention.items).toEqual([
      expect.objectContaining({
        source_kind: "launch_blocked",
        title: "Launch blocked",
        workflow: { id: workflow.id, name: "Checkout flow" },
        navigation_target: { type: "workflow", workflow_id: workflow.id },
      }),
    ]);
    expect(overview.activity).toHaveLength(24);
    expect(overview.activity.some((bucket) => bucket.blocked === 1)).toBe(true);
  });

  test("rejects operations overview ranges that are too broad for hourly buckets", async () => {
    const { handlers } = await createTestHandlers();

    let thrown: unknown;
    try {
      await handlers.getOperationsOverview({
        day_start_utc: "2026-01-01T00:00:00.000Z",
        day_end_utc: "2026-02-01T00:00:00.000Z",
        timezone_label: "UTC",
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toMatchObject({
      message: "Operations overview range cannot exceed 48 hours",
      field: "day_end_utc",
    });
  });

  test("aggregates persisted runs schedule attention evidence and schedules", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-27T12:00:00.000Z"));
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Evidence flow");
    await handlers.saveWorkflowGraph(workflow.id, runnableGraph());
    const schedule = await handlers.createSchedule({
      workflow_id: workflow.id,
      name: "Daily evidence",
      enabled: true,
      kind: { type: "once_at", timestamp: "2026-05-27T20:00:00.000Z" },
    });
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at, outputs_json, error_json, owner_id
      ) VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7, $8)`,
      [
        "run-success",
        workflow.id,
        "success",
        "2026-05-27T09:00:00.000Z",
        "2026-05-27T09:02:00.000Z",
        JSON.stringify({
          __evidence: [
            {
              run_id: "run-success",
              node_id: "shot",
              artifact_kind: "screenshot",
              path: "runs/run-success/screenshots/001-shot.png",
              created_at: "2026-05-27T09:01:00.000Z",
            },
          ],
        }),
        null,
        database.ownerId,
      ]
    );
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at, error_json, owner_id
      ) VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7)`,
      [
        "run-failed",
        workflow.id,
        "failed",
        "2026-05-27T10:00:00.000Z",
        "2026-05-27T10:03:00.000Z",
        JSON.stringify({ reason: "Assertion failed", step_id: "assert" }),
        database.ownerId,
      ]
    );
    await database.execute(
      `INSERT INTO run_steps (
        id, run_id, node_id, step_number, action_type, status, started_at, finished_at, error_json, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
      [
        "step-1",
        "run-failed",
        "assert",
        1,
        "assert_text",
        "failed",
        "2026-05-27T10:00:00.000Z",
        "2026-05-27T10:03:00.000Z",
        JSON.stringify({ reason: "Assertion failed" }),
        database.ownerId,
      ]
    );
    await database.execute(
      `INSERT INTO workflow_schedule_events (
        id, schedule_id, workflow_id, event_type, run_id, scheduled_for, created_at, reason, owner_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        "schedule-event-1",
        schedule.id,
        workflow.id,
        "failed_to_start",
        null,
        "2026-05-27T08:00:00.000Z",
        "2026-05-27T08:00:01.000Z",
        "Workflow validation failed",
        database.ownerId,
      ]
    );

    const overview = await handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });

    expect(overview.metrics).toMatchObject({
      succeeded_today: 1,
      attention_today: 2,
      upcoming_schedules: 1,
    });
    expect(overview.attention.items.map((item) => item.source_kind)).toEqual([
      "run_failed",
      "schedule_event",
    ]);
    expect(overview.attention.items[0]).toMatchObject({
      run_id: "run-failed",
      navigation_target: { type: "workflow", workflow_id: workflow.id },
    });
    expect(overview.recent_evidence.items).toEqual([
      expect.objectContaining({
        artifact_kind: "screenshot",
        relative_path_or_label: "runs/run-success/screenshots/001-shot.png",
        run_id: "run-success",
        navigation_targets: expect.objectContaining({
          workflow: { type: "workflow", workflow_id: workflow.id },
        }),
      }),
    ]);
    expect(overview.upcoming_schedules.items).toEqual([
      expect.objectContaining({
        schedule_id: schedule.id,
        workflow_id: workflow.id,
        schedule_name: "Daily evidence",
      }),
    ]);
  });

  test("surfaces recent evidence beyond newer output rows without evidence", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Overview evidence archive");

    const insertRun = async (
      id: string,
      workflowId: string,
      status: string,
      startedAt: string,
      finishedAt: string,
      outputsJson: string
    ) => {
      await database.execute(
        `INSERT INTO runs (
          id, workflow_id, source, status, started_at, finished_at, outputs_json, owner_id
        ) VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7)`,
        [id, workflowId, status, startedAt, finishedAt, outputsJson, database.ownerId]
      );
    };

    await insertRun(
      "run-evidence-archive",
      workflow.id,
      "success",
      "2026-05-26T08:00:00.000Z",
      "2026-05-26T08:01:00.000Z",
      JSON.stringify({
        __evidence: [
          {
            artifact_kind: "screenshot",
            path: "runs/run-evidence-archive/screenshots/archive.png",
            created_at: "2026-05-26T08:00:30.000Z",
          },
        ],
      })
    );
    for (let index = 0; index < 100; index += 1) {
      const startedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 0)).toISOString();
      const finishedAt = new Date(Date.UTC(2026, 4, 27, 0, index, 30)).toISOString();
      await insertRun(
        `run-output-only-${index}`,
        workflow.id,
        "success",
        startedAt,
        finishedAt,
        JSON.stringify({})
      );
    }

    const overview = await handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });

    expect(overview.recent_evidence.items).toEqual([
      expect.objectContaining({
        artifact_kind: "screenshot",
        relative_path_or_label: "runs/run-evidence-archive/screenshots/archive.png",
        run_id: "run-evidence-archive",
      }),
    ]);
  });

  test("skips overview evidence metadata with Windows absolute paths", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Overview unsafe evidence");
    await database.execute(
      `INSERT INTO runs (
        id, workflow_id, source, status, started_at, finished_at, outputs_json, owner_id
      ) VALUES ($1, $2, 'manual', $3, $4, $5, $6, $7)`,
      [
        "run-unsafe-evidence",
        workflow.id,
        "success",
        "2026-05-27T08:00:00.000Z",
        "2026-05-27T08:01:00.000Z",
        JSON.stringify({
          __evidence: [
            {
              artifact_kind: "screenshot",
              path: "C:\\Users\\operator\\secret.png",
              created_at: "2026-05-27T08:00:30.000Z",
            },
            {
              artifact_kind: "download",
              path: "\\\\server\\share\\secret.csv",
              created_at: "2026-05-27T08:00:40.000Z",
            },
            {
              artifact_kind: "screenshot",
              path: "C:Users\\operator\\secret.png",
              created_at: "2026-05-27T08:00:50.000Z",
            },
          ],
        }),
        database.ownerId,
      ]
    );

    const overview = await handlers.getOperationsOverview({
      day_start_utc: "2026-05-27T00:00:00.000Z",
      day_end_utc: "2026-05-28T00:00:00.000Z",
      timezone_label: "UTC",
    });

    expect(overview.recent_evidence.items).toEqual([]);
    expect(overview.data_warnings.evidence_items_skipped).toBe(3);
  });

  test("resolves a null browser_profile_id in getWorkflowSettings to the project default browser profile", async () => {
    const { handlers, database } = await createTestHandlers();
    const workflow = await handlers.createWorkflow("Profile fallback test");
    
    // Create a default project profile with a specific profile_dir
    const profileId = "profile-project-default";
    await database.execute(
      `INSERT INTO browser_profiles (
        id, project_id, name, description, is_default, browser_launch_json, environment_json, created_at, updated_at, owner_id
      ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9)`,
      [
        profileId,
        workflow.project_id,
        "Default Profile",
        "",
        JSON.stringify({ session_mode: "persistent_profile", profile_dir: "project-default-dir" }),
        JSON.stringify({ variables: [] }),
        new Date().toISOString(),
        new Date().toISOString(),
        database.ownerId,
      ]
    );

    // Explicitly set browser_profile_id to null and update settings to use a different profile_dir
    await database.execute(
      "UPDATE workflows SET browser_profile_id = NULL WHERE id = $1 AND owner_id = $2",
      [workflow.id, database.ownerId]
    );

    const settings = await handlers.getWorkflowSettings(workflow.id);
    await handlers.saveWorkflowSettings(workflow.id, {
      ...settings,
      browser_launch: {
        ...settings.browser_launch,
        profile_dir: "workflow-specific-dir",
      },
    });

    // Now, get the settings again.
    // If the backend resolves null browser_profile_id to the default profile,
    // it should return settings with profile_dir = "project-default-dir" (merged from the default profile).
    // If it doesn't resolve, it will return "workflow-specific-dir".
    const refreshed = await handlers.getWorkflowSettings(workflow.id);
    expect(refreshed.browser_launch.profile_dir).toBe("project-default-dir");
  });
});

