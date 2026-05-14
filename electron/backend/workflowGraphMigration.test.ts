// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { WorkflowGraph } from "../../src/types/workflow";
import { migrateWorkflowGraph } from "./workflowGraphMigration";

describe("workflow graph migration", () => {
  test("upgrades legacy element selectors into canonical structured targets", () => {
    const graph: WorkflowGraph = {
      version: 1,
      nodes: [
        graphNode("click-submit", {
          type: "click",
          config: {
            xpath: "//*[@id='submit']",
            iframe_xpath: "//iframe[@title='Checkout']",
            wait_until: "clickable",
            timeout_ms: 5000,
            mode: "force_dom",
            retry_interval_ms: 250,
            post_click_wait_ms: 1000,
            position: "offset",
            offset_x: 8,
            offset_y: 10,
          },
        }),
        graphNode("fill-email", {
          type: "input_text",
          config: {
            xpath: "//*[@name='email']",
            text: "qa@example.test",
            clear_before_input: true,
            typing_mode: "type",
            delay_ms: 75,
            timeout_ms: 4000,
          },
        }),
        graphNode("drag-card", {
          type: "drag_and_drop",
          config: {
            source_xpath: "//*[@data-card='a']",
            target_xpath: "//*[@data-column='done']",
            iframe_xpath: "//iframe[@title='Board']",
            wait_until: "visible",
          },
        }),
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const migrated = migrateWorkflowGraph(graph);

    expect(migrated.version).toBe(2);
    expect(migrated.nodes[0]?.config).toEqual({
      type: "click",
      config: {
        target: {
          locators: [{ kind: "xpath", value: "//*[@id='submit']" }],
          iframe: {
            locators: [{ kind: "xpath", value: "//iframe[@title='Checkout']" }],
          },
        },
      },
    });
    expect(migrated.nodes[1]?.config).toEqual({
      type: "input_text",
      config: {
        target: {
          locators: [{ kind: "xpath", value: "//*[@name='email']" }],
        },
        text: "qa@example.test",
        clear_before_input: true,
      },
    });
    expect(migrated.nodes[2]?.config).toEqual({
      type: "drag_and_drop",
      config: {
        source_target: {
          locators: [{ kind: "xpath", value: "//*[@data-card='a']" }],
          iframe: {
            locators: [{ kind: "xpath", value: "//iframe[@title='Board']" }],
          },
        },
        target_target: {
          locators: [{ kind: "xpath", value: "//*[@data-column='done']" }],
          iframe: {
            locators: [{ kind: "xpath", value: "//iframe[@title='Board']" }],
          },
        },
      },
    });
    expect(migrated.migration_notes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "nodes.click-submit.config.xpath", action: "converted" }),
        expect.objectContaining({ path: "nodes.click-submit.config.timeout_ms", action: "dropped" }),
        expect.objectContaining({ path: "nodes.fill-email.config.typing_mode", action: "dropped" }),
        expect.objectContaining({ path: "nodes.drag-card.config.source_xpath", action: "converted" }),
      ]),
    );
  });

  test("migrates legacy wait and condition selectors without preserving obsolete timing knobs", () => {
    const graph: WorkflowGraph = {
      version: 1,
      nodes: [
        graphNode("wait-ready", {
          type: "wait",
          config: {
            condition: "element_visible",
            xpath: "//*[@data-testid='ready']",
            timeout_ms: 3000,
          },
        }),
        {
          id: "branch",
          node_type: "if",
          label: "Branch",
          position: { x: 0, y: 0 },
          config: {
            condition: {
              kind: "element_visible",
              xpath: "//*[@data-testid='flag']",
            },
          },
          ports: [],
        },
      ],
      edges: [
        {
          id: "edge-branch",
          source_node_id: "branch",
          source_port: "true",
          target_node_id: "wait-ready",
          target_port: "in",
          condition: {
            kind: "element_visible",
            xpath: "//*[@data-testid='edge']",
          },
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };

    const migrated = migrateWorkflowGraph(graph);

    expect(migrated.nodes[0]?.config).toEqual({
      type: "wait",
      config: {
        condition: "element_visible",
        target: {
          locators: [{ kind: "xpath", value: "//*[@data-testid='ready']" }],
        },
      },
    });
    expect(migrated.nodes[1]?.config).toEqual({
      condition: {
        kind: "element_visible",
        target: {
          locators: [{ kind: "xpath", value: "//*[@data-testid='flag']" }],
        },
      },
    });
    expect(migrated.edges[0]?.condition).toEqual({
      kind: "element_visible",
      target: {
        locators: [{ kind: "xpath", value: "//*[@data-testid='edge']" }],
      },
    });
  });
});

function graphNode(id: string, config: unknown): WorkflowGraph["nodes"][number] {
  return {
    id,
    node_type: "action",
    label: id,
    position: { x: 0, y: 0 },
    config,
    ports: [],
  };
}
