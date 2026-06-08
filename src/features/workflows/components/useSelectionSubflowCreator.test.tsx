import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRef } from "react";
import { describe, expect, test, vi } from "vitest";
import type { WorkflowGraph } from "../../../types/workflow";
import type { GraphSelection } from "../lib/graphEditorCommands";
import { nodePorts } from "../lib/workflowGraph";
import { useSelectionSubflowCreator } from "./useSelectionSubflowCreator";

const graph: WorkflowGraph = {
  version: 2,
  nodes: [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: nodePorts("start"),
      group_id: null,
    },
    {
      id: "step-1",
      node_type: "action",
      label: "Wait for page",
      position: { x: 220, y: 0 },
      config: null,
      ports: nodePorts("action"),
      group_id: null,
    },
  ],
  edges: [
    {
      id: "edge-start-step-1",
      source_node_id: "start",
      source_port: "out",
      target_node_id: "step-1",
      target_port: "in",
      label: "next",
      condition: null,
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const selection: GraphSelection = { nodeIds: ["step-1"], edgeIds: [] };

describe("useSelectionSubflowCreator", () => {
  test("validates the subflow name before creating a selected-node subflow", async () => {
    const onCreateSubflowFromSelection = vi.fn();

    function Harness() {
      const graphRef = useRef(graph);
      const selectionRef = useRef(selection);
      const creator = useSelectionSubflowCreator({
        graphKind: "workflow",
        graphRef,
        selectionRef,
        onCreateSubflowFromSelection,
        onCommitGraphChange: vi.fn(),
      });
      return (
        <>
          <button type="button" onClick={creator.openSelectionSubflowDialog}>
            Open
          </button>
          <span>{creator.isSelectionSubflowDialogOpen ? "open" : "closed"}</span>
          {creator.selectionSubflowError ? (
            <p role="alert">{creator.selectionSubflowError}</p>
          ) : null}
          <button
            type="button"
            onClick={() => void creator.createSubflowFromSelection("create_only")}
          >
            Create
          </button>
        </>
      );
    }

    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("open")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByRole("alert")).toHaveTextContent("Subflow name is required.");
    expect(onCreateSubflowFromSelection).not.toHaveBeenCalled();
  });

  test("creates a selected-node subflow and closes the dialog after success", async () => {
    const onCreateSubflowFromSelection = vi.fn().mockResolvedValue({
      id: "subflow-selected",
      name: "Login block",
    });

    function Harness() {
      const graphRef = useRef(graph);
      const selectionRef = useRef(selection);
      const creator = useSelectionSubflowCreator({
        graphKind: "workflow",
        graphRef,
        selectionRef,
        onCreateSubflowFromSelection,
        onCommitGraphChange: vi.fn(),
      });
      return (
        <>
          <button type="button" onClick={creator.openSelectionSubflowDialog}>
            Open
          </button>
          <span>{creator.isSelectionSubflowDialogOpen ? "open" : "closed"}</span>
          <input
            aria-label="Subflow name"
            value={creator.selectionSubflowName}
            onChange={(event) => creator.setSelectionSubflowName(event.currentTarget.value)}
          />
          <button
            type="button"
            onClick={() => void creator.createSubflowFromSelection("create_only")}
          >
            Create
          </button>
        </>
      );
    }

    render(<Harness />);
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.type(screen.getByLabelText("Subflow name"), "Login block");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => {
      expect(onCreateSubflowFromSelection).toHaveBeenCalledWith({
        name: "Login block",
        graph: expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ id: "start", node_type: "start" }),
            expect.objectContaining({ id: "step-1", label: "Wait for page" }),
          ]),
        }),
      });
      expect(screen.getByText("closed")).toBeInTheDocument();
    });
  });
});
