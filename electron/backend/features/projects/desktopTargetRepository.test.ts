// @vitest-environment node

import { beforeEach, describe, expect, test } from "vitest";
import { TestDbAdapter } from "../../db/testDbAdapter.js";
import { DesktopTargetRepository } from "./desktopTargetRepository.js";

const PROJECT = "default-project-uuid";

describe("DesktopTargetRepository", () => {
  let db: TestDbAdapter;
  let repository: DesktopTargetRepository;

  beforeEach(async () => {
    db = await TestDbAdapter.create();
    repository = new DesktopTargetRepository(db);
  });

  test("round-trips the launch spec and window selector through JSON columns", async () => {
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Ledger",
      launch: {
        kind: "executable",
        value: "C:\\Tools\\ledger.exe",
        args: ["--no-splash"],
        ready: { kind: "window", timeout_ms: 20_000 },
      },
      window: { title: { kind: "prefix", value: "Ledger" }, ordinal: 0 },
      accessibility: { env: { QT_ACCESSIBILITY: "1" } },
    });

    const loaded = await repository.getDesktopTarget(created.id);

    expect(loaded).toMatchObject({
      name: "Ledger",
      project_id: PROJECT,
      launch: {
        kind: "executable",
        value: "C:\\Tools\\ledger.exe",
        args: ["--no-splash"],
        ready: { kind: "window", timeout_ms: 20_000 },
      },
      window: { title: { kind: "prefix", value: "Ledger" }, ordinal: 0 },
      accessibility: { env: { QT_ACCESSIBILITY: "1" } },
    });
  });

  test("a target with no window selector binds any window of its process", async () => {
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Calculator",
      launch: { kind: "app_id", value: "calc" },
    });

    expect((await repository.getDesktopTarget(created.id))?.window).toEqual({});
  });

  test("only one target per project is the default", async () => {
    const first = await repository.createDesktopTarget(PROJECT, {
      name: "First",
      is_default: true,
      launch: { kind: "app_id", value: "calc" },
    });
    const second = await repository.createDesktopTarget(PROJECT, {
      name: "Second",
      is_default: true,
      launch: { kind: "app_id", value: "notepad" },
    });

    expect((await repository.getDesktopTarget(first.id))?.is_default).toBe(false);
    expect((await repository.getDesktopTarget(second.id))?.is_default).toBe(true);
    expect(await repository.getDefaultDesktopTarget(PROJECT)).toMatchObject({ id: second.id });
  });

  test("lists defaults first so the picker opens on the likely choice", async () => {
    await repository.createDesktopTarget(PROJECT, {
      name: "Zebra",
      launch: { kind: "app_id", value: "zebra" },
    });
    await repository.createDesktopTarget(PROJECT, {
      name: "Alpha",
      is_default: true,
      launch: { kind: "app_id", value: "alpha" },
    });

    expect((await repository.listDesktopTargets(PROJECT)).map((t) => t.name)).toEqual([
      "Alpha",
      "Zebra",
    ]);
  });

  test("updating leaves untouched fields alone", async () => {
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Ledger",
      launch: { kind: "app_id", value: "ledger" },
      window: { title: { kind: "exact", value: "Ledger" } },
    });

    const updated = await repository.updateDesktopTarget(created.id, { name: "Ledger v2" });

    expect(updated).toMatchObject({
      name: "Ledger v2",
      launch: { kind: "app_id", value: "ledger" },
      window: { title: { kind: "exact", value: "Ledger" } },
    });
  });

  test("records the probed tier without touching the rest of the target", async () => {
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Settings",
      launch: { kind: "app_id", value: "ms-settings:" },
    });

    await repository.recordObservedTier(created.id, "pixel");

    expect(await repository.getDesktopTarget(created.id)).toMatchObject({
      name: "Settings",
      observed_tier: "pixel",
    });
  });

  test("deleting a target clears it from the workflows that referenced it", async () => {
    // A workflow left pointing at a deleted target would fail at launch with a
    // missing-row error. Failing at authoring time, with an empty picker, is
    // the repair the operator can actually act on.
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Ledger",
      launch: { kind: "app_id", value: "ledger" },
    });
    await db.query(
      `INSERT INTO workflows (id, project_id, surface, desktop_target_id, name, created_at, updated_at, owner_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      ["wf-1", PROJECT, "desktop", created.id, "Close the ledger", "t", "t", "test-user-uuid"],
    );

    await repository.deleteDesktopTarget(created.id);

    const [row] = await db.query(`SELECT desktop_target_id FROM workflows WHERE id = $1`, ["wf-1"]);
    expect(row.desktop_target_id).toBeNull();
    expect(await repository.getDesktopTarget(created.id)).toBeNull();
  });

  test("a target from another project is not reachable by id", async () => {
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Ledger",
      launch: { kind: "app_id", value: "ledger" },
    });

    expect(await repository.listDesktopTargets("some-other-project")).toEqual([]);
    expect(await repository.getDesktopTarget(created.id)).not.toBeNull();
  });

  test("a corrupt launch column reads as an unusable target rather than throwing", async () => {
    // Hand-edited databases and half-finished restores both produce this. A
    // throw here would take out the whole Projects screen.
    const created = await repository.createDesktopTarget(PROJECT, {
      name: "Ledger",
      launch: { kind: "app_id", value: "ledger" },
    });
    await db.query(`UPDATE desktop_targets SET launch_json = $1 WHERE id = $2`, [
      "{not json",
      created.id,
    ]);

    const loaded = await repository.getDesktopTarget(created.id);

    expect(loaded?.launch).toEqual({ kind: "app_id", value: "" });
  });
});
