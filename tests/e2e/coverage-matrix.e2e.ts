import { test, expect } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";
import {
  actionCoverage,
  behaviorFieldVariants,
  behaviorScenarios,
  capabilityGaps,
  capabilityTraceability,
  graphNodeCoverage,
  hiddenActionCoverage,
  workflowJourneyCoverage,
  type BehaviorCapabilityStatus,
  type BehaviorScenario,
  type BehaviorFieldVariant,
  type CapabilityTraceabilityEntry,
  type CoverageEntry,
} from "./support/coverageMatrix";
import * as coverageArtifacts from "./support/coverageMatrix";
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
  "merge",
  "router",
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

const requiredBehaviorDomains = [
  "browser_context",
  "content_capture",
  "data_flow",
  "decisions_and_recovery",
  "dynamic_behavior",
  "element_interaction",
  "form_completion",
  "keyboard_dialog",
  "network_behavior",
  "package_batch_audit",
  "page_navigation",
  "run_outcome",
  "session_continuity",
  "workflow_authoring",
];

const requiredBehaviorChangingFields = [
  "ElementTarget",
  "assert_element.state",
  "assert_text.match_mode",
  "repeat_for_each.source",
  "router_and_merge",
  "run_policy.browser_retention",
  "scroll.mode",
  "select_option.match_by",
  "stop_workflow.status",
  "wait.condition",
  "wait_for_response.status",
];

const requiredBehaviorVariantValues: Record<string, string[]> = {
  ElementTarget: [
    "locator.kind=attribute",
    "locator.kind=css",
    "locator.kind=label",
    "locator.kind=placeholder",
    "locator.kind=role",
    "locator.kind=test_id",
    "locator.kind=text",
    "locator.kind=xpath",
    "constraints.contains_text",
    "constraints.enabled",
    "constraints.index",
    "constraints.visible",
    "target.iframe",
    "legacy.iframe_xpath",
  ],
  "assert_element.state": ["attached", "visible", "hidden", "enabled", "disabled"],
  "assert_text.match_mode": ["contains", "equals", "failure"],
  "repeat_for_each.source": ["array_variable", "literal_items"],
  router_and_merge: ["router.mode=first_match", "router.case.priority", "router.default", "merge.in multi-edge"],
  "run_policy.browser_retention": ["retain", "close"],
  "scroll.mode": ["page", "into_view", "until_visible"],
  "select_option.match_by": ["label", "value"],
  "stop_workflow.status": ["success", "failure", "close_browser"],
  "wait.condition": [
    "duration",
    "element_visible",
    "element_hidden",
    "element_attached",
    "element_detached",
    "text_visible",
    "url_contains",
    "page_load",
    "element_enabled",
    "element_disabled",
  ],
  "wait_for_response.status": ["status-filtered", "unfiltered"],
};

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

  test("classifies behavior scenarios and capability field variants", () => {
    const artifacts = coverageArtifacts as {
      behaviorScenarios?: unknown;
      capabilityGaps?: unknown;
      capabilityTraceability?: unknown;
      behaviorFieldVariants?: unknown;
    };

    expect(Array.isArray(artifacts.behaviorScenarios), "behavior scenarios must be exported")
      .toBe(true);
    expect(Array.isArray(artifacts.capabilityGaps), "capability gaps must be exported")
      .toBe(true);
    expect(
      Array.isArray(artifacts.capabilityTraceability),
      "capability traceability entries must be exported",
    ).toBe(true);
    expect(
      Array.isArray(artifacts.behaviorFieldVariants),
      "behavior-changing field variants must be exported",
    ).toBe(true);
  });

  test("keeps behavior scenarios, gaps, and traceability internally consistent", () => {
    expect(new Set(behaviorScenarios.map((scenario) => scenario.id)).size)
      .toBe(behaviorScenarios.length);
    expect(new Set(capabilityGaps.map((gap) => gap.gap_id)).size)
      .toBe(capabilityGaps.length);

    expect([...new Set(behaviorScenarios.map((scenario) => scenario.domain))].sort())
      .toEqual(requiredBehaviorDomains);

    const scenarioIds = new Set(behaviorScenarios.map((scenario) => scenario.id));
    const gapIds = new Set(capabilityGaps.map((gap) => gap.gap_id));

    for (const scenario of behaviorScenarios) {
      expectScenarioComplete(scenario, gapIds);
    }

    for (const gap of capabilityGaps) {
      expect(scenarioIds.has(gap.scenario_id), `gap ${gap.gap_id} references a known scenario`)
        .toBe(true);
      expect(gap.decision_status).toBe("proposed");
    }

    for (const entry of capabilityTraceability) {
      expectTraceabilityEntryComplete(entry, scenarioIds, gapIds);
    }

    for (const variant of behaviorFieldVariants) {
      expectTraceabilityEntryComplete(variant, scenarioIds, gapIds);
      expect(variant.variants, `${variant.capability} must list behavior-changing variants`)
        .not.toHaveLength(0);
      expect(
        variant.variants.sort(),
        `${variant.capability} must classify every required behavior-changing variant`,
      ).toEqual(requiredBehaviorVariantValues[variant.capability].sort());
    }

    expect(behaviorFieldVariants.map((variant) => variant.capability).sort())
      .toEqual(requiredBehaviorChangingFields);
  });
});

function expectScenarioComplete(scenario: BehaviorScenario, gapIds: Set<string>) {
  expect(scenario.user_intent, `${scenario.id} must describe user intent`).toBeTruthy();
  expect(scenario.preconditions, `${scenario.id} must document preconditions`).not.toHaveLength(0);
  expect(scenario.workflow_authoring, `${scenario.id} must document workflow authoring`).not.toHaveLength(0);
  expect(scenario.browser_behavior, `${scenario.id} must document browser behavior`).not.toHaveLength(0);
  expect(scenario.actions_and_fields, `${scenario.id} must map actions and fields`).not.toHaveLength(0);
  expect(scenario.expected_outcomes, `${scenario.id} must define observable outcomes`).not.toHaveLength(0);
  expect(["covered", "gap", "not_applicable"]).toContain(scenario.capability_status);

  if (scenario.capability_status === "covered") {
    expect(scenario.evidence.files, `${scenario.id} covered scenario must reference test files`)
      .not.toHaveLength(0);
    for (const file of scenario.evidence.files ?? []) {
      expectFileExists(file, `scenario ${scenario.id}`);
    }
  }

  if (scenario.capability_status === "gap") {
    expect(scenario.evidence.gap_ids, `${scenario.id} gap scenario must reference gap ids`)
      .not.toHaveLength(0);
    for (const gapId of scenario.evidence.gap_ids ?? []) {
      expect(gapIds.has(gapId), `${scenario.id} references missing gap ${gapId}`).toBe(true);
    }
  }
}

function expectTraceabilityEntryComplete(
  entry: CapabilityTraceabilityEntry | BehaviorFieldVariant,
  scenarioIds: Set<string>,
  gapIds: Set<string>,
) {
  expect(entry.capability).toBeTruthy();
  expect(entry.scenario_ids, `${entry.capability} must reference behavior scenarios`).not.toHaveLength(0);
  expect(["covered", "gap", "not_applicable"] satisfies BehaviorCapabilityStatus[])
    .toContain(entry.status);

  for (const scenarioId of entry.scenario_ids) {
    expect(scenarioIds.has(scenarioId), `${entry.capability} references missing scenario ${scenarioId}`)
      .toBe(true);
  }

  if (entry.status === "covered") {
    expect(entry.evidence_files, `${entry.capability} covered entry must reference test files`)
      .not.toHaveLength(0);
    for (const file of entry.evidence_files ?? []) {
      expectFileExists(file, `capability ${entry.capability}`);
    }
  }

  if (entry.status === "gap") {
    expect(entry.gap_ids, `${entry.capability} gap entry must reference gap ids`)
      .not.toHaveLength(0);
    for (const gapId of entry.gap_ids ?? []) {
      expect(gapIds.has(gapId), `${entry.capability} references missing gap ${gapId}`).toBe(true);
    }
  }
}

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

function expectFileExists(file: string, label: string) {
  expect(
    fs.existsSync(path.join(process.cwd(), file)),
    `${label} references missing file ${file}`,
  ).toBe(true);
}
