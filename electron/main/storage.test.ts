// @vitest-environment node
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { createDraftGraph } from "./graph";
import { createStorageService, type StorageService } from "./storage";

let appDataDir = "";
let storage: StorageService;

beforeEach(() => {
  appDataDir = mkdtempSync(path.join(tmpdir(), "cloak-storage-"));
  storage = createStorageService({ appDataDir });
  storage.initialize();
});

afterEach(() => {
  storage.close();
  rmSync(appDataDir, { recursive: true, force: true });
});

describe("Electron storage service", () => {
  test("initializes the rebuild schema and default workspace from empty app data", () => {
    const diagnostics = storage.getDiagnostics();

    expect(diagnostics.databasePath).toBe(path.join(appDataDir, "workspace.db"));
    expect(diagnostics.schemaVersion).toBe(1);
    expect(diagnostics.tables).toEqual(
      expect.arrayContaining([
        "workspaces",
        "workflows",
        "workflow_graph_versions",
        "run_profiles",
        "identity_profiles",
        "environments",
        "runs",
        "run_events",
        "artifacts",
        "evidence_records",
      ]),
    );
    expect(storage.getWorkspace().id).toBe("local");
  });

  test("creates a workflow with an active draft graph and hides soft-deleted rows", () => {
    const workflow = storage.createWorkflow({
      name: "Owned staging smoke",
      description: "Regression flow for owned staging",
      tags: ["staging", "p0"],
    });

    expect(workflow.name).toBe("Owned staging smoke");
    expect(storage.listWorkflows()).toHaveLength(1);

    const graph = storage.loadActiveGraph(workflow.id);
    expect(graph?.nodes.map((node) => node.type)).toEqual(["start", "action"]);
    expect(graph?.nodes[1]?.config).toBeNull();

    storage.softDeleteWorkflow(workflow.id);

    expect(storage.listWorkflows()).toEqual([]);
  });

  test("keeps exactly one active graph version per workflow", () => {
    const workflow = storage.createWorkflow({ name: "Graph version test" });
    const replacement = createDraftGraph("replacement");

    storage.saveActiveGraph(workflow.id, replacement, "user_save");

    expect(storage.loadActiveGraph(workflow.id)?.nodes[0]?.id).toBe("replacement-start");
    expect(storage.listGraphVersions(workflow.id).filter((version) => version.active)).toHaveLength(1);
  });

  test("renames and duplicates workflows without mutating the source graph", () => {
    const workflow = storage.createWorkflow({ name: "Original" });
    const replacement = createDraftGraph("copy-source");
    storage.saveActiveGraph(workflow.id, replacement, "user_save");

    const renamed = storage.updateWorkflow(workflow.id, { name: "Renamed" });
    const duplicate = storage.duplicateWorkflow(workflow.id, "Copy of Renamed");

    expect(renamed.id).toBe(workflow.id);
    expect(renamed.name).toBe("Renamed");
    expect(duplicate.id).not.toBe(workflow.id);
    expect(duplicate.name).toBe("Copy of Renamed");
    expect(storage.loadActiveGraph(duplicate.id)).toEqual(storage.loadActiveGraph(workflow.id));
  });

  test("persists workflow settings snapshots for the renderer compatibility facade", () => {
    const workflow = storage.createWorkflow({ name: "Settings test" });
    const settings = {
      workflow_id: workflow.id,
      version: 1,
      general: { name: workflow.name },
      browser: { headless: true },
    };

    storage.saveWorkflowSettings(workflow.id, settings);

    expect(storage.loadWorkflowSettings(workflow.id)).toEqual(settings);
  });

  test("appends monotonic run events and registers file-backed artifacts", () => {
    const workflow = storage.createWorkflow({ name: "Run storage test" });
    const graph = storage.loadActiveGraph(workflow.id);
    expect(graph).not.toBeNull();

    const run = storage.createRun({
      workflowId: workflow.id,
      graphVersionId: storage.getActiveGraphVersion(workflow.id).id,
      runProfileSnapshot: { timeoutMs: 30_000 },
      identityProfileSnapshot: { id: "id_default", name: "Default" },
      environmentSnapshot: { initialVariables: {} },
      operatorLabel: "local",
    });

    const first = storage.appendRunEvent(run.id, {
      type: "run.started",
      severity: "info",
      payload: { workflowId: workflow.id },
    });
    const second = storage.appendRunEvent(run.id, {
      type: "run.completed",
      severity: "info",
      payload: { status: "completed" },
    });
    const artifact = storage.registerArtifact({
      runId: run.id,
      eventId: second.id,
      type: "screenshot",
      relativePath: `runs/${run.id}/screenshots/final.png`,
      mimeType: "image/png",
      sizeBytes: 42,
      checksum: "sha256-test",
      sanitized: true,
    });

    expect([first.sequence, second.sequence]).toEqual([1, 2]);
    expect(storage.listRunEvents(run.id).map((event) => event.type)).toEqual([
      "run.started",
      "run.completed",
    ]);
    expect(storage.listArtifacts(run.id)).toEqual([artifact]);
  });

  test("persists identity profiles and validates coherence before use", () => {
    const profile = storage.createIdentityProfile({
      name: "Owned mobile profile",
      description: "Mobile identity for owned staging probes",
      browserEngine: "cloakbrowser",
      persistentProfilePath: "owned-mobile-01",
      deviceIdentity: {
        deviceClass: "mobile",
        viewport: { width: 390, height: 844 },
        mobile: true,
        touch: true,
        userAgent: "Mozilla/5.0 Mobile",
      },
      locale: {
        locale: "en-US",
        timezone: "America/New_York",
        languages: ["en-US", "en"],
      },
      proxyReference: {
        label: "owned-us-east",
        region: "US",
        secretRef: "secret://proxy/us-east",
      },
      headedPolicy: "allow_headless",
      preflightPolicy: {
        enabled: true,
        probeUrl: "https://owned.example.test/fingerprint",
        allowedOrigins: ["https://owned.example.test"],
      },
    });

    expect(storage.listIdentityProfiles()).toEqual([expect.objectContaining({ id: profile.id })]);
    expect(storage.getIdentityProfile(profile.id)).toMatchObject({
      name: "Owned mobile profile",
      persistentProfilePath: "owned-mobile-01",
      proxyReference: expect.objectContaining({ secretRef: "secret://proxy/us-east" }),
    });

    const updated = storage.updateIdentityProfile(profile.id, {
      name: "Owned mobile profile v2",
      description: "Updated",
    });

    expect(updated.name).toBe("Owned mobile profile v2");
    expect(storage.validateIdentityProfile(updated)).toEqual([]);

    expect(
      storage.validateIdentityProfile({
        ...updated,
        persistentProfilePath: "../unsafe",
        deviceIdentity: {
          ...updated.deviceIdentity,
          deviceClass: "mobile",
          viewport: { width: 1440, height: 900 },
          mobile: true,
          touch: false,
        },
        proxyReference: {
          label: "raw-secret",
          password: "must-not-store",
        },
      }),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ code: "unsafe_profile_path" }),
        expect.objectContaining({ code: "mobile_viewport_mismatch" }),
        expect.objectContaining({ code: "mobile_touch_mismatch" }),
        expect.objectContaining({ code: "raw_proxy_secret" }),
      ]),
    );

    storage.deleteIdentityProfile(profile.id);

    expect(storage.listIdentityProfiles()).toEqual([]);
  });
});
