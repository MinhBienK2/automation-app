import { test, expect } from "./support/electronFixture";
import { createAndRunGraph } from "./support/workflows";
import {
  loadStagingConfig,
  smokeUrlForTarget,
  stagingEnabled,
  type StagingTarget,
} from "./support/stagingConfig";
import type { WorkflowGraph } from "../../src/types/workflow";

test.describe("authorized staging owned-target E2E", () => {
  test.skip(
    !stagingEnabled(),
    "Set E2E_STAGING=1 with E2E_STAGING_TARGETS_FILE and E2E_STAGING_ACCOUNTS_FILE to run staging E2E.",
  );

  test("runs smoke workflows only against allowlisted staging targets", async ({
    appWindow,
  }, testInfo) => {
    const config = loadStagingConfig();
    testInfo.annotations.push({
      type: "staging accounts",
      description: config.accounts.map((account) => account.label).join(", "),
    });

    for (const target of config.targets) {
      const smokeUrl = smokeUrlForTarget(target);
      testInfo.annotations.push({
        type: "staging target",
        description: `${target.key}: ${smokeUrl}`,
      });

      const { state } = await createAndRunGraph(
        appWindow,
        `STAGING ${target.key}`,
        stagingSmokeGraph(target, smokeUrl),
      );

      expect(state.outputs[`staging_title_${target.key}`]).toBeTruthy();
      expect(String(state.outputs[`staging_screenshot_${target.key}`])).toMatch(
        /^runs\/.+\/screenshots\/\d+-staging-screenshot-.+\.png$/,
      );
    }
  });
});

function stagingSmokeGraph(target: StagingTarget, smokeUrl: string): WorkflowGraph {
  const expectedText = target.smoke?.expectedText?.trim();
  const screenshotName = `${target.key.replace(/[^a-z0-9_-]+/gi, "-")}.png`;
  const nodes: WorkflowGraph["nodes"] = [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: null,
      ports: [{ id: "out", label: "Out", direction: "output" }],
    },
    {
      id: "navigate-staging",
      node_type: "action",
      label: "Navigate Staging",
      position: { x: 220, y: 0 },
      config: { type: "navigate", config: { url: smokeUrl } },
      ports: actionPorts(),
    },
    {
      id: "assert-staging-domain",
      node_type: "domain_allowlist",
      label: "Assert Staging Domain",
      position: { x: 440, y: 0 },
      config: { domains: target.allowedDomains },
      ports: actionPorts(),
    },
    ...(expectedText
      ? [
          {
            id: "wait-staging-text",
            node_type: "action" as const,
            label: "Wait Staging Text",
            position: { x: 660, y: 0 },
            config: { type: "wait" as const, config: { condition: "text_visible" as const, text: expectedText } },
            ports: actionPorts(),
          },
        ]
      : []),
    {
      id: "capture-staging-title",
      node_type: "action",
      label: "Capture Staging Title",
      position: { x: expectedText ? 880 : 660, y: 0 },
      config: {
        type: "execute_js",
        config: {
          script: "return document.title || window.location.href;",
          output_name: `staging_title_${target.key}`,
        },
      },
      ports: actionPorts(),
    },
    {
      id: "staging-screenshot",
      node_type: "action",
      label: "Staging Screenshot",
      position: { x: expectedText ? 1100 : 880, y: 0 },
      config: {
        type: "take_screenshot",
        config: {
          path: screenshotName,
          output_name: `staging_screenshot_${target.key}`,
          full_page: false,
        },
      },
      ports: actionPorts(),
    },
  ];

  return {
    version: 2,
    nodes,
    edges: nodes.slice(1).map((node, index) => ({
      id: `edge-${nodes[index].id}-${node.id}`,
      source_node_id: nodes[index].id,
      source_port: "out",
      target_node_id: node.id,
      target_port: "in",
    })),
    viewport: { x: 0, y: 0, zoom: 1 },
    migration_notes: [],
  };
}

function actionPorts() {
  return [
    { id: "in", label: "In", direction: "input" as const },
    { id: "out", label: "Out", direction: "output" as const },
  ];
}
