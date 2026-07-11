import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

  test("element-visible graph conditions can target a Find Element ref", async () => {
    const onChange = vi.fn();
    const node = graphNode({
      node_type: "while",
      config: {
        condition: {
          kind: "element_visible",
          xpath: "//*[@id='legacy-panel']",
          target_ref: "current_panel",
        },
        max_attempts: 5,
      },
    });

    function Harness() {
      const [currentNode, setCurrentNode] = useState(node);
      return (
        <NodeConfigFields
          node={currentNode}
          onChange={(nextNode) => {
            setCurrentNode(nextNode);
            onChange(nextNode);
          }}
        />
      );
    }

    render(<Harness />);

    const conditionGroup = screen.getByRole("group", { name: "Condition" });
    const elementSource = within(conditionGroup).getByRole("group", { name: "Element source" });

    expect(within(conditionGroup).getByLabelText("Condition kind")).toHaveValue("element_visible");
    expect(within(elementSource).getByRole("button", { name: "Use Find Element ref" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(conditionGroup).getByLabelText("Target ref")).toHaveValue("current_panel");
    expect(within(conditionGroup).queryByLabelText("XPath")).not.toBeInTheDocument();

    await userEvent.click(within(elementSource).getByRole("button", { name: "Use XPath" }));

    expect(within(conditionGroup).getByLabelText("XPath")).toHaveValue("//*[@id='legacy-panel']");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          condition: expect.objectContaining({
            target_ref: null,
            xpath: "//*[@id='legacy-panel']",
          }),
        }),
      }),
    );
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
                condition: { kind: "variable_is_true", name: "state" },
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

  test("check_conditions script mode uses template textarea with variable picker for script field", () => {
    const onChange = vi.fn();
    render(
      <NodeConfigFields
        node={graphNode({
          node_type: "check_conditions",
          config: {
            output_name: "is_valid",
            mode: "script",
            script: "outputs.counter > 5",
          },
        })}
        onChange={onChange}
        variableOptions={[
          { name: "counter", source: "Variables" },
          { name: "status", source: "Variables" },
        ]}
      />,
    );

    const scriptGroup = screen.getByRole("group", { name: "Script Settings" });
    const textarea = within(scriptGroup).getByRole("textbox");
    expect(textarea).toHaveValue("outputs.counter > 5");

    expect(within(scriptGroup).getByRole("button", { name: "Insert variable for JavaScript Expression" }))
      .toBeInTheDocument();
  });

  test("calculate_value uses template textarea with variable picker for expression field", () => {
    const onChange = vi.fn();
    render(
      <NodeConfigFields
        node={graphNode({
          node_type: "calculate_value",
          config: {
            output_name: "result",
            expression: "outputs.counter + 10",
          },
        })}
        onChange={onChange}
        variableOptions={[
          { name: "counter", source: "Variables" },
        ]}
      />,
    );

    const scriptGroup = screen.getByRole("group", { name: "Expression Settings" });
    const textarea = within(scriptGroup).getByRole("textbox");
    expect(textarea).toHaveValue("outputs.counter + 10");

    expect(within(scriptGroup).getByRole("button", { name: "Insert variable for JavaScript / Math Expression" }))
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

  test("renders list operation config fields correctly", () => {
    const onChange = vi.fn();
    
    // Test execute_list_script
    const executeScriptNode = graphNode({
      node_type: "execute_list_script",
      config: {
        source: "my_list",
        script: "return list.filter(item => item !== null);",
        output_name: "filtered_result",
      },
    });
    const { rerender } = render(<NodeConfigFields node={executeScriptNode} onChange={onChange} />);

    const scriptGroup = screen.getByRole("group", { name: "Run Script on List Settings" });
    expect(within(scriptGroup).getByLabelText("Source list variable name")).toHaveValue("my_list");
    expect(within(scriptGroup).getByLabelText("JavaScript Script (source bound to 'list')")).toHaveValue("return list.filter(item => item !== null);");
    expect(within(scriptGroup).getByLabelText("Result output variable name")).toHaveValue("filtered_result");

    // Test map_list_property
    const mapNode = graphNode({
      node_type: "map_list_property",
      config: {
        source: "my_list",
        property_key: "name",
        output_name: "mapped_names",
      },
    });
    rerender(<NodeConfigFields node={mapNode} onChange={onChange} />);
    const mapGroup = screen.getByRole("group", { name: "Extract Property from List Settings" });
    expect(within(mapGroup).getByLabelText("Source list variable name")).toHaveValue("my_list");
    expect(within(mapGroup).getByLabelText("Property key / path")).toHaveValue("name");
    expect(within(mapGroup).getByLabelText("Result output variable name")).toHaveValue("mapped_names");

    // Test sort_reverse_list
    const sortNode = graphNode({
      node_type: "sort_reverse_list",
      config: {
        source: "my_list",
        action: "sort_asc",
        sort_key: "age",
        output_name: "sorted_list",
      },
    });
    rerender(<NodeConfigFields node={sortNode} onChange={onChange} />);
    const sortGroup = screen.getByRole("group", { name: "Sort or Reverse List Settings" });
    expect(within(sortGroup).getByLabelText("Source list variable name")).toHaveValue("my_list");
    expect(within(sortGroup).getByLabelText("Action")).toHaveValue("sort_asc");
    expect(within(sortGroup).getByLabelText("Sort key (optional, for list of objects)")).toHaveValue("age");
    expect(within(sortGroup).getByLabelText("Result output variable name")).toHaveValue("sorted_list");

    // Test check_list_empty
    const emptyNode = graphNode({
      node_type: "check_list_empty",
      config: {
        source: "my_list",
        output_name: "is_empty",
      },
    });
    rerender(<NodeConfigFields node={emptyNode} onChange={onChange} />);
    const emptyGroup = screen.getByRole("group", { name: "Check List Empty Settings" });
    expect(within(emptyGroup).getByLabelText("Source list variable name")).toHaveValue("my_list");
    expect(within(emptyGroup).getByLabelText("Result output variable name")).toHaveValue("is_empty");

    // Test check_list_contains
    const containsNode = graphNode({
      node_type: "check_list_contains",
      config: {
        source: "my_list",
        value_type: "text",
        value: "apple",
        output_name: "contains_item",
      },
    });
    rerender(<NodeConfigFields node={containsNode} onChange={onChange} />);
    const containsGroup = screen.getByRole("group", { name: "Check List Contains Settings" });
    expect(within(containsGroup).getByLabelText("Source list variable name")).toHaveValue("my_list");
    expect(within(containsGroup).getByLabelText("Value type")).toHaveValue("text");
    expect(within(containsGroup).getByLabelText("Value to check")).toHaveValue("apple");
    expect(within(containsGroup).getByLabelText("Result output variable name")).toHaveValue("contains_item");
  });
});
