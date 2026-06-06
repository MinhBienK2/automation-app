import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { GraphNode, SubflowSummary } from "../../../types/workflow";
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

  test("edits Call Subflow target and input mapping", () => {
    const onChange = vi.fn();
    const node = graphNode({
      id: "node-call-subflow",
      node_type: "call_subflow",
      label: "Login",
      config: {
        subflow_id: "subflow-login",
        input_mapping: [{ input_name: "email", value: "{{user.email}}" }],
        output_prefix: "login",
      },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    });

    render(<NodeConfigFields node={node} onChange={onChange} />);

    expect(screen.getByLabelText("Subflow id")).toHaveValue("subflow-login");
    expect(screen.getByLabelText("Input mapping")).toHaveValue("email={{user.email}}");
    expect(screen.getByLabelText("Output prefix")).toHaveValue("login");

    fireEvent.change(screen.getByLabelText("Subflow id"), {
      target: { value: "subflow-checkout" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ subflow_id: "subflow-checkout" }),
      }),
    );

    fireEvent.change(screen.getByLabelText("Input mapping"), {
      target: { value: "email={{user.email}}\npassword={{user.password}}" },
    });
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          input_mapping: [
            { input_name: "email", value: "{{user.email}}" },
            { input_name: "password", value: "{{user.password}}" },
          ],
        }),
      }),
    );
  });

  test("selects a same-project subflow by name for Call Subflow nodes", () => {
    const onChange = vi.fn();
    const node = graphNode({
      id: "node-call-subflow",
      node_type: "call_subflow",
      label: "Login",
      config: {
        subflow_id: "subflow-login",
        input_mapping: [],
        output_prefix: null,
      },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    });
    const subflows: SubflowSummary[] = [
      {
        id: "subflow-login",
        project_id: "project-1",
        name: "Login",
        description: "",
        tags: [],
        used_by_count: 2,
        created_at: "1",
        updated_at: "1",
      },
      {
        id: "subflow-checkout",
        project_id: "project-1",
        name: "Checkout Shared Path",
        description: "",
        tags: [],
        used_by_count: 0,
        created_at: "1",
        updated_at: "1",
      },
    ];

    render(
      <NodeConfigFields
        node={node}
        onChange={onChange}
        subflowOptions={subflows}
      />,
    );

    const selector = screen.getByLabelText("Subflow");
    expect(selector).toHaveDisplayValue("Login");
    expect(screen.getByText("Used by 2 workflows")).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: "subflow-checkout" } });

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({ subflow_id: "subflow-checkout" }),
      }),
    );
  });
});
