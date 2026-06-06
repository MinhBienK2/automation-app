import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { GraphNode } from "../../../types/workflow";
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
});
