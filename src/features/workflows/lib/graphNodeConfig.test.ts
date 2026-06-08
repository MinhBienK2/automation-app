import { describe, expect, test } from "vitest";
import {
  defaultCondition,
  nextRandomChoiceId,
  nextRouterCaseId,
  randomChoiceConfig,
  randomChoicePortsForChoices,
  routerConfig,
  routerPortsForCases,
  switchPortsForCases,
} from "./graphNodeConfig";

describe("graph node config helpers", () => {
  test("builds stable ports for switch, router, and random choice nodes", () => {
    expect(switchPortsForCases(["A", "B"]).map((port) => port.id)).toEqual([
      "in",
      "case_1",
      "case_2",
      "default",
      "done",
    ]);
    expect(
      routerPortsForCases([
        { id: "ready", label: "Ready", condition: defaultCondition() },
      ]).map((port) => port.id),
    ).toEqual(["in", "case_ready", "default", "done"]);
    expect(
      randomChoicePortsForChoices([
        { id: "one", label: "One", weight: 1 },
      ]).map((port) => port.id),
    ).toEqual(["in", "choice_one", "done"]);
  });

  test("normalizes router and random choice configs", () => {
    expect(routerConfig({})).toMatchObject({
      mode: "first_match",
      cases: [{ id: "1", label: "Case 1", condition: defaultCondition() }],
      default_label: "Default",
    });
    expect(randomChoiceConfig({})).toMatchObject({
      choices: [
        { id: "1", label: "Choice 1", weight: 1 },
        { id: "2", label: "Choice 2", weight: 1 },
      ],
      output_name: "random_choice",
    });
  });

  test("creates incremental ids from numeric ids", () => {
    expect(nextRouterCaseId([{ id: "2", label: "Two", condition: defaultCondition() }]))
      .toBe("3");
    expect(nextRandomChoiceId([{ id: "4", label: "Four", weight: 1 }])).toBe("5");
  });
});
