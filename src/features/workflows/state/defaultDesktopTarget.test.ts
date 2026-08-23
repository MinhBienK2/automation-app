import { describe, expect, test } from "vitest";
import { defaultDesktopTargetFor } from "./defaultDesktopTarget";
import type { DesktopTarget } from "../../../types/workflow";

/**
 * Which application a new desktop workflow is pointed at by default.
 *
 * The list handed to this hook is loaded per project, but it is loaded
 * *asynchronously* — between selecting a project and its targets arriving, the
 * list still holds the previous project's applications. Defaulting to one of
 * those creates a workflow that drives an application belonging to a different
 * project, and the operator sees a plausible name and no reason to look twice.
 */

function target(over: Partial<DesktopTarget>): DesktopTarget {
  return {
    id: "target-1",
    project_id: "project-a",
    name: "Ledger",
    launch: { kind: "app_id", value: "ledger" },
    ...over,
  } as DesktopTarget;
}

describe("defaultDesktopTargetFor", () => {
  test("prefers the project's default target", () => {
    const targets = [
      target({ id: "first" }),
      target({ id: "marked", is_default: true }),
    ];

    expect(defaultDesktopTargetFor(targets, "project-a")?.id).toBe("marked");
  });

  test("falls back to the first target the project owns", () => {
    expect(defaultDesktopTargetFor([target({ id: "only" })], "project-a")?.id).toBe("only");
  });

  test("never picks a target belonging to another project", () => {
    const stale = [target({ id: "other", project_id: "project-b", is_default: true })];

    expect(defaultDesktopTargetFor(stale, "project-a")).toBeNull();
  });

  test("with no project selected there is nothing to default to", () => {
    expect(defaultDesktopTargetFor([target({})], null)).toBeNull();
  });
});
