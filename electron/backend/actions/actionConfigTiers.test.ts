// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig, GraphNode } from "../../../src/types/workflow";
import { parseActionConfigShape } from "./schemas/index";
import { validateActionConfig } from "./validation";
import { actionDefinitions, getActionDefinition } from "./registry";

/**
 * Action Config validation has two tiers of one interface, and they are
 * deliberately asymmetric. These tests pin the asymmetry so that a future reader
 * finding the two functions does not "fix" the disagreement in either direction:
 *
 * - Making the shape tier as strict as the completeness tier would quarantine
 *   every unconfigured node on graph load, destroying work in progress.
 * - Making the completeness tier as loose as the shape tier would let
 *   unrunnable configs reach the runner.
 */

function node(config: unknown): GraphNode {
  return {
    id: "node-1",
    node_type: "action",
    label: "Fixture",
    position: { x: 0, y: 0 },
    config: config as GraphNode["config"],
    ports: [],
    group_id: null,
  };
}

describe("action config validation tiers", () => {
  test("the shape tier accepts a freshly dropped node that the completeness tier reports", () => {
    // This is what `defaultActionConfig("click")` produces, so it is what gets
    // persisted whenever a graph is saved mid-edit.
    const draft = { type: "click", config: { target: null } } as unknown as ActionConfig;

    expect(parseActionConfigShape(node(draft)).ok).toBe(true);
    expect(validateActionConfig(draft)).toEqual({
      field: "xpath",
      message: "Element target is required",
    });
  });

  test("the completeness tier is strictly stricter — it never accepts what the shape tier rejects", () => {
    const malformed = { type: "click", config: { xpath: 42 } } as unknown as ActionConfig;

    const shape = parseActionConfigShape(node(malformed));
    expect(shape.ok).toBe(false);
    expect(validateActionConfig(malformed)).not.toBeNull();
  });

  test("both tiers reject an unknown action type", () => {
    const unknown = { type: "not_a_real_action", config: {} } as unknown as ActionConfig;

    expect(parseActionConfigShape(node(unknown))).toMatchObject({
      ok: false,
      reason: "no_schema",
    });
    expect(validateActionConfig(unknown)).toMatchObject({ field: "type" });
  });

  test("a complete config passes both tiers", () => {
    const complete = {
      type: "click",
      config: { xpath: "//button[@id='submit']" },
    } as unknown as ActionConfig;

    expect(parseActionConfigShape(node(complete)).ok).toBe(true);
    expect(validateActionConfig(complete)).toBeNull();
  });

  test("every registered action type carries its shape schema on its definition", () => {
    const missing = actionDefinitions
      .filter((definition) => definition.type !== "quarantined")
      .filter((definition) => !definition.configSchema)
      .map((definition) => definition.type);

    expect(missing).toEqual([]);
    expect(getActionDefinition("click")?.configSchema).toBeDefined();
  });
});
