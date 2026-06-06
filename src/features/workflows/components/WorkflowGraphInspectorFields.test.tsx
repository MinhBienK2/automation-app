import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { GraphNode, SubflowSummary } from "../../../types/workflow";
import { NodeConfigFields } from "./WorkflowGraphInspectorFields";

describe("NodeConfigFields", () => {
  test("edits Call Subflow target and input mapping", () => {
    const onChange = vi.fn();
    const node: GraphNode = {
      id: "node-call-subflow",
      node_type: "call_subflow",
      label: "Login",
      position: { x: 0, y: 0 },
      config: {
        subflow_id: "subflow-login",
        input_mapping: [{ input_name: "email", value: "{{user.email}}" }],
        output_prefix: "login",
      },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    };

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
    const node: GraphNode = {
      id: "node-call-subflow",
      node_type: "call_subflow",
      label: "Login",
      position: { x: 0, y: 0 },
      config: {
        subflow_id: "subflow-login",
        input_mapping: [],
        output_prefix: null,
      },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
    };
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
