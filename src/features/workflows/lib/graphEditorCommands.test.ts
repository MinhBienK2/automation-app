import { describe, expect, test } from "vitest";
import type { WorkflowGraph } from "../../../types/workflow";
import {
  copyGraphSelection,
  deleteGraphSelection,
  duplicateGraphSelection,
  pasteGraphClipboard,
  pushGraphHistory,
  redoGraphHistory,
  undoGraphHistory,
} from "./graphEditorCommands";

const graph: WorkflowGraph = {
  version: 1,
  nodes: [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: [{ id: "out", label: "Out", direction: "output" }],
      group_id: null,
    },
    {
      id: "a",
      node_type: "action",
      label: "A",
      position: { x: 200, y: 0 },
      config: { type: "wait", config: { condition: "duration", duration_ms: 1000 } },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: "group-1",
    },
    {
      id: "b",
      node_type: "action",
      label: "B",
      position: { x: 400, y: 0 },
      config: { type: "click", config: { xpath: "//button" } },
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: "group-1",
    },
    {
      id: "outside",
      node_type: "action",
      label: "Outside",
      position: { x: 600, y: 0 },
      config: null,
      ports: [
        { id: "in", label: "In", direction: "input" },
        { id: "out", label: "Out", direction: "output" },
      ],
      group_id: null,
    },
  ],
  edges: [
    {
      id: "edge-start-a",
      source_node_id: "start",
      source_port: "out",
      target_node_id: "a",
      target_port: "in",
      label: "next",
      condition: null,
    },
    {
      id: "edge-a-b",
      source_node_id: "a",
      source_port: "out",
      target_node_id: "b",
      target_port: "in",
      label: "next",
      condition: null,
    },
    {
      id: "edge-b-outside",
      source_node_id: "b",
      source_port: "out",
      target_node_id: "outside",
      target_port: "in",
      label: "next",
      condition: null,
    },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

describe("graph editor commands", () => {
  test("deletes selected non-start nodes and attached edges while keeping start", () => {
    const result = deleteGraphSelection(graph, {
      nodeIds: ["start", "a"],
      edgeIds: ["edge-b-outside"],
    });

    expect(result.graph.nodes.map((node) => node.id)).toEqual([
      "start",
      "b",
      "outside",
    ]);
    expect(result.graph.edges.map((edge) => edge.id)).toEqual([]);
    expect(result.selection).toEqual({ nodeIds: [], edgeIds: [] });
  });

  test("duplicates selected nodes with internal edges only and ignores start", () => {
    const result = duplicateGraphSelection(
      graph,
      { nodeIds: ["start", "a", "b"], edgeIds: [] },
      {
        offset: { x: 40, y: 50 },
        createNodeId: (node) => `${node.id}-copy`,
      },
    );

    expect(result.graph.nodes.map((node) => node.id)).toEqual([
      "start",
      "a",
      "b",
      "outside",
      "a-copy",
      "b-copy",
    ]);
    expect(result.graph.nodes.find((node) => node.id === "a-copy")).toEqual(
      expect.objectContaining({
        label: "A Copy",
        config: graph.nodes.find((node) => node.id === "a")?.config,
        group_id: "group-1",
        position: { x: 240, y: 50 },
      }),
    );
    expect(result.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-a-copy-out-b-copy-in",
          source_node_id: "a-copy",
          target_node_id: "b-copy",
        }),
      ]),
    );
    expect(result.graph.edges.map((edge) => edge.id)).not.toContain(
      "edge-b-copy-out-outside-in",
    );
    expect(result.selection.nodeIds).toEqual(["a-copy", "b-copy"]);
  });

  test("copies and pastes selected graph fragments with fresh ids", () => {
    const clipboard = copyGraphSelection(graph, {
      nodeIds: ["a", "b"],
      edgeIds: [],
    });

    expect(clipboard?.edges.map((edge) => edge.id)).toEqual(["edge-a-b"]);

    const result = pasteGraphClipboard(graph, clipboard, {
      offset: { x: 80, y: 20 },
      createNodeId: (node) => `pasted-${node.id}`,
    });

    expect(result.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "pasted-a",
          label: "A",
          position: { x: 280, y: 20 },
        }),
        expect.objectContaining({
          id: "pasted-b",
          label: "B",
          position: { x: 480, y: 20 },
        }),
      ]),
    );
    expect(result.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "edge-pasted-a-out-pasted-b-in",
          source_node_id: "pasted-a",
          target_node_id: "pasted-b",
        }),
      ]),
    );
    expect(result.selection).toEqual({
      nodeIds: ["pasted-a", "pasted-b"],
      edgeIds: ["edge-pasted-a-out-pasted-b-in"],
    });
  });

  test("undoes redoes and bounds graph history snapshots", () => {
    const second = { ...graph, nodes: graph.nodes.slice(0, 3) };
    const third = { ...second, edges: second.edges.slice(0, 2) };
    const history = pushGraphHistory(
      pushGraphHistory({ past: [], present: graph, future: [], limit: 1 }, second),
      third,
    );

    expect(history.past).toHaveLength(1);
    expect(history.past[0]).toBe(second);

    const undone = undoGraphHistory(history);
    expect(undone.present).toBe(second);
    expect(undone.future).toEqual([third]);

    const redone = redoGraphHistory(undone);
    expect(redone.present).toBe(third);
    expect(redone.past).toEqual([second]);
  });
});
