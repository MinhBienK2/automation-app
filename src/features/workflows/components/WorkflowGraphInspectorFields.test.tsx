import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { GraphNode } from "../../../types/workflow";
import { nodePorts } from "../lib/workflowGraph";
import { NodeConfigFields } from "./WorkflowGraphInspectorFields";

function graphNode(node: Partial<GraphNode> & Pick<GraphNode, "node_type">): GraphNode {
  return {
    id: node.id ?? `${node.node_type}-1`,
    node_type: node.node_type,
    label: node.label ?? node.node_type,
    position: node.position ?? { x: 0, y: 0 },
    config: node.config ?? {},
    ports: node.ports ?? nodePorts(node.node_type),
    group_id: node.group_id ?? null,
  };
}

describe("WorkflowGraphInspectorFields", () => {
  test("groups condition and loop guard fields for loop logic nodes", () => {
    render(
      <NodeConfigFields
        node={graphNode({
          node_type: "while",
          config: {
            condition: { kind: "url_contains", value: "/watch" },
            max_attempts: 5,
            timeout_ms: 12000,
          },
        })}
        onChange={vi.fn()}
      />,
    );

    const conditionGroup = screen.getByRole("group", { name: "Condition" });
    const loopGuardGroup = screen.getByRole("group", { name: "Loop guard" });

    expect(within(conditionGroup).getByLabelText("Condition kind")).toHaveValue("url_contains");
    expect(within(loopGuardGroup).getByLabelText("Loop max attempts")).toHaveValue(5);
    expect(within(loopGuardGroup).getByLabelText("Loop timeout ms")).toHaveValue(12000);
  });

  test("groups router decision cases separately from the default route", () => {
    render(
      <NodeConfigFields
        node={graphNode({
          node_type: "router",
          config: {
            mode: "first_match",
            cases: [
              {
                id: "ready",
                label: "Ready",
                condition: { kind: "output_equals", name: "state", value: "ready" },
              },
            ],
            default_label: "Fallback",
          },
        })}
        onChange={vi.fn()}
      />,
    );

    const casesGroup = screen.getByRole("group", { name: "Router cases" });
    const defaultRouteGroup = screen.getByRole("group", { name: "Default route" });

    expect(within(casesGroup).getByRole("group", { name: "Router decision table" }))
      .toBeInTheDocument();
    expect(within(defaultRouteGroup).getByLabelText("Default label")).toHaveValue("Fallback");
  });

  test("groups random choice output separately from weighted choices", () => {
    render(
      <NodeConfigFields
        node={graphNode({
          node_type: "random_choice",
          config: {
            output_name: "chosen_path",
            choices: [
              { id: "a", label: "A", weight: 3 },
              { id: "b", label: "B", weight: 1 },
            ],
          },
        })}
        onChange={vi.fn()}
      />,
    );

    const outputGroup = screen.getByRole("group", { name: "Choice output" });
    const choicesGroup = screen.getByRole("group", { name: "Weighted choices" });

    expect(within(outputGroup).getByLabelText("Output name")).toHaveValue("chosen_path");
    expect(within(choicesGroup).getByRole("group", { name: "Random choice table" }))
      .toBeInTheDocument();
  });
});
