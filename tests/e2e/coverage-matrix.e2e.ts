import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  actionCoverage,
  graphNodeCoverage,
  hiddenActionCoverage,
  workflowJourneyCoverage,
  type CoverageEntry,
} from "./support/coverageMatrix";
import {
  actionCapabilities,
  allActionTypes,
  isActionVisibleInPrimaryPalette,
} from "../../src/lib/actionCapabilities";
import type { ActionType, GraphNodeType } from "../../src/types/workflow";

const allGraphNodeTypes: GraphNodeType[] = [
  "start",
  "end_success",
  "end_failure",
  "action",
  "if",
  "switch",
  "repeat_times",
  "repeat_for_each",
  "repeat_until",
  "while",
  "retry",
  "try_catch",
  "fallback",
  "break_loop",
  "continue_loop",
  "stop_workflow",
  "set_variable",
  "set_json_variables",
  "transform_variable",
  "assert_output",
  "domain_allowlist",
];

test.describe("desktop E2E coverage matrix", () => {
  test("covers every visible implemented action with local desktop E2E", () => {
    const visibleImplementedActions = allActionTypes.filter(
      (actionType) =>
        isActionVisibleInPrimaryPalette(actionType),
    );

    expectMissingCoverage(
      visibleImplementedActions,
      actionCoverage,
      "visible implemented action",
    );
  });

  test("documents non-visible action coverage decisions", () => {
    const hiddenActions = allActionTypes.filter(
      (actionType) => !isActionVisibleInPrimaryPalette(actionType),
    );

    expectMissingCoverage(hiddenActions, hiddenActionCoverage, "hidden action");
  });

  test("covers every graph node type with E2E or explicit backend coverage", () => {
    expectMissingCoverage(allGraphNodeTypes, graphNodeCoverage, "graph node");
  });

  test("covers complete workflow user journeys beyond runner-only action execution", () => {
    expect(Object.keys(workflowJourneyCoverage).sort()).toEqual([
      "batch_execution",
      "evidence_persistence",
      "graph_authoring",
      "import_export",
      "settings_before_run",
      "staging_owned_target",
      "workflow_crud",
      "workflow_run_failure",
      "workflow_run_success",
      "workflow_stop",
    ]);

    for (const [journey, entry] of Object.entries(workflowJourneyCoverage)) {
      expect(entry.files, `${journey} must name at least one E2E or lower-level evidence file`)
        .not.toHaveLength(0);
      expect(entry.depth, `${journey} must document coverage depth`).toBeTruthy();
      expectFilesExist(entry, journey);
    }
  });
});

function expectMissingCoverage<T extends ActionType | GraphNodeType | string>(
  expectedItems: T[],
  coverage: Partial<Record<T, CoverageEntry>>,
  label: string,
) {
  const missing = expectedItems.filter((item) => !coverage[item]);
  expect(missing, `Missing ${label} E2E coverage: ${missing.join(", ")}`).toEqual([]);

  for (const item of expectedItems) {
    const entry = coverage[item];
    expect(entry?.files, `${label} ${item} must name evidence files`).not.toHaveLength(0);
    expect(entry?.depth, `${label} ${item} must document coverage depth`).toBeTruthy();
    expectFilesExist(entry, `${label} ${item}`);
  }
}

function expectFilesExist(entry: CoverageEntry | undefined, label: string) {
  for (const file of entry?.files ?? []) {
    expect(
      fs.existsSync(path.join(process.cwd(), file)),
      `${label} references missing coverage file ${file}`,
    ).toBe(true);
  }
}
