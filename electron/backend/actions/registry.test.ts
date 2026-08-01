// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  actionDefinitions,
  getActionDefinition,
  isKnownActionType,
  unsupportedActionTypeMessage,
} from "./registry";

describe("backend action registry", () => {
  test("registers every serialized action type with execution ownership metadata", () => {
    // The registry no longer restates every action type here. `ActionRegistryCoverage`
    // in registry.ts proves at compile time that every `ActionType` has a
    // definition, and names the missing type when one does not. The hand-typed
    // array this replaced went stale silently every time an action type was
    // added, which is exactly the failure it was meant to catch.
    const types = actionDefinitions.map((definition) => definition.type);

    expect(new Set(types).size).toBe(types.length);
    expect(types).toContain("navigate");
    expect(types).toContain("quarantined");
    expect(getActionDefinition("execute_js")).toMatchObject({
      type: "execute_js",
      owner: "advanced",
      auditRisk: "high",
    });
    expect(getActionDefinition("if_condition")).toMatchObject({
      type: "if_condition",
      owner: "graph_internal",
      hiddenFromPalette: true,
    });
  });

  test("provides one unknown-action gate for compiler and runner defense", () => {
    expect(isKnownActionType("navigate")).toBe(true);
    expect(isKnownActionType("legacy_action")).toBe(false);
    expect(getActionDefinition("legacy_action")).toBeUndefined();
    expect(unsupportedActionTypeMessage("legacy_action")).toBe(
      "Unsupported action type: legacy_action",
    );
    expect(unsupportedActionTypeMessage("")).toBe("Unsupported action type: unknown");
  });
});
