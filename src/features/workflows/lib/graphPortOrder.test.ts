import { describe, expect, test } from "vitest";
import type { GraphNode, GraphNodeType } from "../../../types/workflow";
import { createDefaultGraphNode } from "./workflowGraph";
import { orderedOutputPortIds } from "./graphPortOrder";

function node(nodeType: GraphNodeType): GraphNode {
  return createDefaultGraphNode(nodeType, { x: 0, y: 0 });
}

describe("orderedOutputPortIds", () => {
  test("orders branching node ports by their semantic order, not port declaration order", () => {
    expect(orderedOutputPortIds(node("if"))).toEqual(["true", "false", "done"]);
    expect(orderedOutputPortIds(node("try_catch"))).toEqual([
      "try",
      "success",
      "error",
      "finally",
      "done",
    ]);
    expect(orderedOutputPortIds(node("retry"))).toEqual(["try", "failed", "success"]);
    expect(orderedOutputPortIds(node("repeat_until"))).toEqual(["loop", "timeout", "done"]);
  });

  test("returns the single output port for plain and variable node types", () => {
    expect(orderedOutputPortIds(node("action"))).toEqual(["out"]);
    expect(orderedOutputPortIds(node("set_variable"))).toEqual(["out"]);
    expect(orderedOutputPortIds(node("check_conditions"))).toEqual(["out"]);
    expect(orderedOutputPortIds(node("calculate_value"))).toEqual(["out"]);
    expect(orderedOutputPortIds(node("transform_variable"))).toEqual(["out"]);
  });

  test("returns no ports for terminal node types", () => {
    expect(orderedOutputPortIds(node("end_success"))).toEqual([]);
    expect(orderedOutputPortIds(node("end_failure"))).toEqual([]);
  });

  test("orders switch case ports numerically ahead of default and done", () => {
    const switchNode = node("switch");
    switchNode.ports = [
      { id: "in", label: "In", direction: "input" },
      { id: "done", label: "Done", direction: "output" },
      { id: "case_10", label: "Case 10", direction: "output" },
      { id: "case_2", label: "Case 2", direction: "output" },
      { id: "default", label: "Default", direction: "output" },
    ];

    expect(orderedOutputPortIds(switchNode)).toEqual([
      "case_2",
      "case_10",
      "default",
      "done",
    ]);
  });

  test("orders router case ports by their configured case order", () => {
    const routerNode = node("router");
    routerNode.config = { cases: [{ id: "beta" }, { id: "alpha" }] };
    routerNode.ports = [
      { id: "in", label: "In", direction: "input" },
      { id: "case_alpha", label: "Alpha", direction: "output" },
      { id: "case_beta", label: "Beta", direction: "output" },
      { id: "default", label: "Default", direction: "output" },
      { id: "done", label: "Done", direction: "output" },
    ];

    expect(orderedOutputPortIds(routerNode)).toEqual([
      "case_beta",
      "case_alpha",
      "default",
      "done",
    ]);
  });

  test("appends unrecognised output ports after the preferred ones", () => {
    const ifNode = node("if");
    ifNode.ports = [
      ...ifNode.ports,
      { id: "surprise", label: "Surprise", direction: "output" },
    ];

    expect(orderedOutputPortIds(ifNode)).toEqual(["true", "false", "done", "surprise"]);
  });
});
