import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { workflowCommandCallMock, mockWorkflowBridgeCommands, resetWorkflowBridge } from "../../../tests/mocks/electron";
import { sleepStep } from "../../../tests/mocks/workflowFixtures";
import { workflowDetailScenario } from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
import type { GraphNodeType, GraphPort } from "../../../types/workflow";
import { nodePorts } from "../lib/workflowGraph";

const workflowGraphEditorSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/WorkflowGraphEditor.tsx"),
  "utf8",
);
const workflowGraphCanvasPartsSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/WorkflowGraphCanvasParts.tsx"),
  "utf8",
);
const workflowGraphInspectorSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/WorkflowGraphInspector.tsx"),
  "utf8",
);
const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const graphNodeTypeCoverage: Record<GraphNodeType, true> = {
  start: true,
  action: true,
  if: true,
  switch: true,
  merge: true,
  router: true,
  repeat_times: true,
  repeat_for_each: true,
  while: true,
  repeat_until: true,
  retry: true,
  try_catch: true,
  fallback: true,
  break_loop: true,
  continue_loop: true,
  stop_workflow: true,
  set_variable: true,
  set_json_variables: true,
  transform_variable: true,
  assert_output: true,
  domain_allowlist: true,
  end_success: true,
  end_failure: true,
};
const graphNodeTypes = Object.keys(graphNodeTypeCoverage) as GraphNodeType[];

describe("Workflow graph editor integration", () => {
  beforeEach(() => {
    resetWorkflowBridge();
    window.localStorage.setItem(
      "workflow-manager:settings:v1",
      JSON.stringify({ graphAutosaveEnabled: false }),
    );
    vi.restoreAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(42);
  });

  async function confirmLaunchRun() {
    await userEvent.click(screen.getByRole("button", { name: "Launch Run" }));
    const dialog = await screen.findByRole("dialog", { name: "Launch Run" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Launch Run" }));
  }

  async function openWorkflowDetails() {
    await userEvent.click(await screen.findByRole("button", { name: "Workflows" }));
    const row = await screen.findByRole("row", { name: /Login flow/i });
    await userEvent.click(within(row).getByRole("button", {
      name: "Open Graph Login flow",
    }));
  }

  test("adds selects deletes and saves logic nodes through the grouped React Flow workspace", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();

    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    expect(within(editor).getByLabelText("Workflow graph canvas")).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Graph canvas node start" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Graph canvas node step-1" }))
      .toBeInTheDocument();
    expect(within(editor).getByLabelText("Start Out port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Start Out port")).toHaveClass(
      "connectable",
      "connectablestart",
      "connectionindicator",
    );
    expect(within(editor).queryByRole("button", { name: "Connect Nodes" }))
      .not.toBeInTheDocument();
    expect(within(editor).getByRole("toolbar", { name: "Graph tools" })).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Add Logic" })).toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Add If" })).not.toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    const logicPalette = await screen.findByRole("dialog", { name: "Choose a logic node" });
    expect(within(logicPalette).getByRole("button", { name: "Branching" })).toBeInTheDocument();
    await userEvent.type(within(logicPalette).getByLabelText("Search logic nodes"), "if");
    await userEvent.click(logicPalette.querySelector('[data-value="if"]') as HTMLElement);
    expect(within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }))
      .toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }));
    expect(within(editor).getByRole("heading", { name: "If" })).toBeInTheDocument();
    expect(within(editor).getByRole("region", { name: "Node connections" })).toBeInTheDocument();
    expect(within(editor).queryByText("input: in")).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Move Left" })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Move Right" })).not.toBeInTheDocument();
    expect(within(editor).getByLabelText("If True port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("If False port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("If Done port")).toBeInTheDocument();
    expect(within(editor).getByText("True branch is optional; missing link will no-op."))
      .toBeInTheDocument();
    expect(within(editor).getByText("Done continuation is optional; workflow ends successfully here."))
      .toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Delete Node" }));
    expect(within(editor).queryByRole("button", { name: "Graph canvas node node-if-42" }))
      .not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "save_workflow_graph",
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            version: 2,
          }),
        }),
      );
    });
  });

  test("uses select-first canvas dragging with temporary spacebar panning", () => {
    expect(workflowGraphEditorSource).toContain("connectionDragThreshold={0}");
    expect(workflowGraphEditorSource).toContain("connectionRadius={32}");
    expect(workflowGraphEditorSource).toContain("nodesConnectable");
    expect(workflowGraphEditorSource).toContain("SelectionMode.Partial");
    expect(workflowGraphEditorSource).toContain("selectionOnDrag={!isPanMode}");
    expect(workflowGraphEditorSource).toContain("panOnDrag={isPanMode}");
    expect(workflowGraphEditorSource).toContain("graph-canvas-pan-mode");
    expect(workflowGraphEditorSource).toContain("event.code === \"Space\"");
    expect(workflowGraphCanvasPartsSource).toContain("isConnectable={isConnectable}");
    expect(workflowGraphCanvasPartsSource).toContain("useUpdateNodeInternals");
    expect(workflowGraphCanvasPartsSource).toContain("updateNodeInternals(id)");
    expect(workflowGraphCanvasPartsSource).toContain("onPortPointerDown");
    expect(workflowGraphCanvasPartsSource).toContain("onPortPointerUp");
    expect(workflowGraphEditorSource).toContain("onEdgeClick");
    expect(workflowGraphEditorSource).toContain("const workflowNodeTypes = useMemo");
    expect(workflowGraphEditorSource).toContain("nodeTypes={workflowNodeTypes}");
    expect(workflowGraphEditorSource).toContain(
      "[completePortConnection, selectNodeFromEvent, startPortConnection]",
    );
    expect(workflowGraphEditorSource).toContain("nodes={reactFlowNodes}");
    expect(workflowGraphEditorSource).toContain("onlyRenderVisibleElements");
    expect(workflowGraphEditorSource).toContain("showGraphMiniMap");
    expect(workflowGraphEditorSource).toContain(
      "mergeReactFlowNodeRuntimeState(flowGraph.nodes, currentNodes)",
    );
    expect(workflowGraphEditorSource).toContain(
      "applyNodeChanges<WorkflowFlowNode>(changes, currentNodes)",
    );
    expect(workflowGraphEditorSource).not.toMatch(
      /setReactFlowNodes\(\([^)]*\)\s*=>\s*\{[\s\S]*?syncFlowGraph/,
    );
    expect(workflowGraphEditorSource).not.toMatch(
      /setReactFlowEdges\(\([^)]*\)\s*=>\s*\{[\s\S]*?syncFlowGraph/,
    );
    expect(appSource).toContain("const changeWorkflowGraph = useCallback");
    expect(workflowGraphEditorSource).not.toContain("GraphEdgeOverlay");
    expect(workflowGraphEditorSource).not.toContain("ViewportPortal");
    expect(workflowGraphEditorSource).not.toContain("graph-connection-preview");
    expect(workflowGraphCanvasPartsSource).not.toContain("previewEdgePath");
    expect(workflowGraphCanvasPartsSource).not.toContain("graph-edge-arrow");
  });

  test("explains every graph canvas port with hover tooltip text", async () => {
    const canvasParts = await import("./WorkflowGraphCanvasParts") as {
      graphPortTooltip?: (nodeType: GraphNodeType, port: GraphPort) => string;
    };
    expect(canvasParts.graphPortTooltip).toBeTypeOf("function");

    for (const nodeType of graphNodeTypes) {
      for (const port of nodePorts(nodeType)) {
        const tooltip = canvasParts.graphPortTooltip?.(nodeType, port);
        expect(tooltip, `${nodeType}.${port.id}`).toEqual(
          expect.stringContaining(port.label),
        );
        expect(tooltip, `${nodeType}.${port.id}`).toEqual(
          expect.stringMatching(/Nối|Kéo|Nhận|Chạy|Kết thúc/),
        );
      }
    }

    expect(
      canvasParts.graphPortTooltip?.("merge", { id: "in", label: "In", direction: "input" }),
    ).toContain("nhiều nhánh");
    expect(
      canvasParts.graphPortTooltip?.("try_catch", { id: "finally", label: "Finally", direction: "output" }),
    ).toContain("luôn chạy");
  });

  test("renders port tooltip metadata on React Flow handles", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    const startPort = within(editor).getByLabelText("Start Out port");
    expect(startPort).toHaveAttribute("data-tooltip", expect.stringContaining("Out"));
    expect(startPort).not.toHaveAttribute("title");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );

    expect(within(editor).getByLabelText("If True port")).toHaveAttribute(
      "data-tooltip",
      expect.stringContaining("condition đúng"),
    );
    expect(within(editor).getByLabelText("If Done port")).toHaveAttribute(
      "data-tooltip",
      expect.stringContaining("flow chính"),
    );
  });

  test("calculates toolbar node positions from the current visible canvas center", async () => {
    expect(
      workflowGraphEditorSource.match(
        /getVisibleNodeInsertionPosition\(\s*currentGraph\.nodes\.length,/g,
      ),
    ).toHaveLength(3);
    expect(workflowGraphEditorSource).not.toContain(
      "x: 120 + currentGraph.nodes.length * 48",
    );

    const graphEditorModule = await import("./WorkflowGraphEditor");
    expect(graphEditorModule).toHaveProperty("getVisibleNodeInsertionPosition");

    const getVisibleNodeInsertionPosition = graphEditorModule[
      "getVisibleNodeInsertionPosition"
    ] as (
      nodeCount: number,
      reactFlowInstance: {
        screenToFlowPosition: (
          position: { x: number; y: number },
          options?: { snapToGrid?: boolean },
        ) => { x: number; y: number };
      } | null,
      canvasElement: { getBoundingClientRect: () => DOMRect },
    ) => { x: number; y: number };
    const screenToFlowPosition = vi.fn(({ x, y }: { x: number; y: number }) => ({
      x: x + 1000,
      y: y + 2000,
    }));
    const canvasElement = {
      getBoundingClientRect: () =>
        ({
          left: 40,
          top: 80,
          width: 800,
          height: 600,
        }) as DOMRect,
    };

    expect(
      getVisibleNodeInsertionPosition(3, { screenToFlowPosition }, canvasElement),
    ).toEqual({ x: 1432, y: 2420 });
    expect(screenToFlowPosition).toHaveBeenCalledWith(
      { x: 440, y: 380 },
      { snapToGrid: false },
    );
  });

  test("preserves multiple incoming links only for Merge inputs", async () => {
    const graphEditorModule = await import("./WorkflowGraphEditor");
    const replacePortEdge = graphEditorModule["replacePortEdge"] as typeof import("./WorkflowGraphEditor").replacePortEdge;
    const sourceNode = (id: string) => ({
      id,
      type: "workflow" as const,
      position: { x: 0, y: 0 },
      data: {
        label: id,
        nodeType: "action" as const,
        ports: nodePorts("action"),
        status: "idle" as const,
        hasIssue: false,
      },
    });
    const mergeNode = {
      id: "merge",
      type: "workflow" as const,
      position: { x: 0, y: 0 },
      data: {
        label: "Merge",
        nodeType: "merge" as const,
        ports: nodePorts("merge"),
        status: "idle" as const,
        hasIssue: false,
      },
    };
    const actionTarget = {
      ...sourceNode("target"),
      data: { ...sourceNode("target").data, label: "Target" },
    };
    const existingEdge = {
      id: "edge-a-out-merge-in",
      source: "a",
      sourceHandle: "out",
      target: "merge",
      targetHandle: "in",
      data: { hasIssue: false, status: "idle" as const, kind: "main" as const },
    };
    const nextMergeEdge = {
      id: "edge-b-out-merge-in",
      source: "b",
      sourceHandle: "out",
      target: "merge",
      targetHandle: "in",
      data: { hasIssue: false, status: "idle" as const, kind: "main" as const },
    };
    const nextNormalEdge = {
      ...nextMergeEdge,
      id: "edge-b-out-target-in",
      target: "target",
    };

    expect(
      replacePortEdge(
        [existingEdge],
        nextMergeEdge,
        [sourceNode("a"), sourceNode("b"), mergeNode],
      ).map((edge) => edge.id),
    ).toEqual(["edge-a-out-merge-in", "edge-b-out-merge-in"]);
    expect(
      replacePortEdge(
        [{ ...existingEdge, id: "edge-a-out-target-in", target: "target" }],
        nextNormalEdge,
        [sourceNode("a"), sourceNode("b"), actionTarget],
      ).map((edge) => edge.id),
    ).toEqual(["edge-b-out-target-in"]);
  });

  test("adds the workflow default link wait to newly connected graph edges", () => {
    expect(workflowGraphEditorSource).toContain("defaultEdgeDelay");
    expect(workflowGraphEditorSource).toContain("cloneGraphEdgeDelay(defaultEdgeDelay)");
    expect(appSource).toContain("workflowSettings?.graph_defaults?.default_edge_delay");
    expect(appSource).toContain("defaultEdgeDelay={");
  });

  test("exposes link wait editing from the selected edge inspector", () => {
    expect(workflowGraphInspectorSource).toContain("Link wait");
    expect(workflowGraphInspectorSource).toContain("Fixed duration ms");
    expect(workflowGraphInspectorSource).toContain("Random min ms");
    expect(workflowGraphEditorSource).toContain("function updateEdge");
    expect(workflowGraphEditorSource).toContain("onUpdateEdge={updateEdge}");
  });

  test("opens graph shortcuts from the toolbar", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Shortcuts" }));

    const dialog = await screen.findByRole("dialog", { name: "Graph Shortcuts" });
    expect(within(dialog).getByText("Drag empty canvas")).toBeInTheDocument();
    expect(within(dialog).getByText("Box select nodes and links")).toBeInTheDocument();
    expect(within(dialog).getByText("Hold Space + drag")).toBeInTheDocument();
    expect(within(dialog).getByText("Pan the graph view")).toBeInTheDocument();
  });

  test("offers separate variable authoring nodes from Add Variable", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Variable" }));

    const palette = await screen.findByRole("dialog", { name: "Choose a variable node" });
    expect(within(palette).getByRole("button", { name: /Set Variables/ })).toBeInTheDocument();
    expect(within(palette).getByRole("button", { name: /Set JSON Variables/ })).toBeInTheDocument();
  });

  test("shows graph-internal details for action-node control configs", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: {
        version: 1,
        nodes: [
          {
            id: "start",
            node_type: "start",
            label: "Start",
            position: { x: 0, y: 0 },
            config: null,
            ports: nodePorts("start"),
          },
          {
            id: "internal-loop",
            node_type: "action",
            label: "Internal While",
            position: { x: 240, y: 0 },
            config: {
              type: "while_loop",
              config: {
                condition: { kind: "output_equals", name: "ready", value: "yes" },
                max_attempts: 2,
                steps: [],
              },
            },
            ports: nodePorts("action"),
          },
        ],
        edges: [
          {
            id: "start-internal",
            source_node_id: "start",
            source_port: "out",
            target_node_id: "internal-loop",
            target_port: "in",
          },
        ],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node internal-loop" }));

    expect(within(editor).getByText("Graph-internal action")).toBeInTheDocument();
    expect(within(editor).getByText("While Loop")).toBeInTheDocument();
    expect(within(editor).getByText(/Replace this action-node payload with a supported user action/))
      .toBeInTheDocument();
    expect(within(editor).getByText(/\"type\": \"while_loop\"/)).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Delete Node" })).toBeInTheDocument();
  });

  test("connects nodes through the app-level port fallback when native drag is unavailable", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    fireEvent.pointerDown(within(editor).getByLabelText("Start Out port"));
    fireEvent.pointerUp(within(editor).getByLabelText("Navigate In port"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            edges: expect.arrayContaining([
              expect.objectContaining({
                source_node_id: "start",
                source_port: "out",
                target_node_id: "node-action-42",
                target_port: "in",
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("replaces existing source and target port links instead of adding parallel edges", async () => {
    let now = 41;
    vi.mocked(Date.now).mockImplementation(() => {
      now += 1;
      return now;
    });
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );
    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="wait"]') as HTMLElement,
    );

    fireEvent.pointerDown(within(editor).getByLabelText("Start Out port"));
    fireEvent.pointerUp(within(editor).getByLabelText("Navigate In port"));
    fireEvent.pointerDown(within(editor).getByLabelText("Start Out port"));
    fireEvent.pointerUp(within(editor).getByLabelText("Wait In port"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      const graph = (saveCall?.[1] as {
        graph: {
          nodes: Array<{ id: string; config: { type?: string } | null }>;
          edges: unknown[];
        };
      } | undefined)?.graph;
      const waitNode = graph?.nodes.find((node) => node.config?.type === "wait");
      const edges = graph?.edges;
      expect(edges).toEqual([
        expect.objectContaining({
          source_node_id: "start",
          source_port: "out",
          target_node_id: waitNode?.id,
          target_port: "in",
        }),
      ]);
    });
  });

  test("cancels a pending port connection when released on empty canvas", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const canvas = within(editor).getByLabelText("Workflow graph canvas");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    fireEvent.pointerDown(within(editor).getByLabelText("Start Out port"));
    fireEvent.pointerUp(canvas);
    fireEvent.pointerUp(within(editor).getByLabelText("Navigate In port"));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            edges: expect.not.arrayContaining([
              expect.objectContaining({
                source_node_id: "start",
                target_node_id: "node-action-42",
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("wires React Flow edge selection to selected-link deletion", () => {
    expect(workflowGraphEditorSource).toContain("onEdgeClick={handleEdgeClick}");
    expect(workflowGraphEditorSource).toContain(
      "setSelection({ nodeIds: [], edgeIds: [edge.id] })",
    );
    expect(workflowGraphEditorSource).toContain("onEdgeContextMenu");
    expect(workflowGraphEditorSource).toContain("LinkContextMenu");
    expect(workflowGraphInspectorSource).toContain('aria-label="Selected link"');
    expect(workflowGraphInspectorSource).toContain("Delete selected link");
    expect(workflowGraphInspectorSource).toContain("onDeleteSelectedEdge");
    expect(workflowGraphInspectorSource).not.toContain("graph-edge-summary");
  });

  test("clears selected links when a node is clicked", () => {
    expect(workflowGraphEditorSource).toContain(
      "onNodeClick={(event, node) => selectNodeFromEvent(event, node.id)}",
    );
    expect(workflowGraphEditorSource).toContain(
      "setSelection({ nodeIds: [nodeId], edgeIds: [] })",
    );
  });

  test("edits logic node config through structured inspector fields", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );
    await userEvent.clear(within(editor).getByLabelText("Output name"));
    await userEvent.type(within(editor).getByLabelText("Output name"), "logged_in");
    await userEvent.clear(within(editor).getByLabelText("Value"));
    await userEvent.type(within(editor).getByLabelText("Value"), "false");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="repeat_times"]') as HTMLElement,
    );
    await userEvent.clear(within(editor).getByLabelText("Times"));
    await userEvent.type(within(editor).getByLabelText("Times"), "3");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall).toBeTruthy();
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                node_type: "if",
                config: {
                  condition: {
                    kind: "output_equals",
                    name: "logged_in",
                    value: "false",
                  },
                },
              }),
              expect.objectContaining({
                node_type: "repeat_times",
                config: { times: 3 },
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("edits action node config through the graph inspector", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="wait"]') as HTMLElement,
    );
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node node-action-42" }));
    await userEvent.clear(within(editor).getByLabelText("Duration ms"));
    await userEvent.type(within(editor).getByLabelText("Duration ms"), "2500");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                node_type: "action",
                config: {
                  type: "wait",
                  config: expect.objectContaining({
                    condition: "duration",
                    duration_ms: 2500,
                  }),
                },
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("opens detailed action help from the graph inspector", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="wait"]') as HTMLElement,
    );
    await userEvent.click(within(editor).getByRole("button", { name: "Open Wait help" }));

    const help = await screen.findByRole("dialog", { name: "Wait Help" });
    expect(within(help).getByText("Action này làm gì")).toBeInTheDocument();
    expect(within(help).getByText("Cấu hình tối thiểu")).toBeInTheDocument();
    expect(within(help).getByText("Ví dụ workflow")).toBeInTheDocument();
    expect(within(help).getAllByText("Condition").length).toBeGreaterThan(0);
    expect(within(help).getAllByText("Duration ms").length).toBeGreaterThan(0);
  });

  test("opens detailed logic node help from the graph inspector and context menu", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );
    await userEvent.click(within(editor).getByRole("button", { name: "Open If help" }));

    let help = await screen.findByRole("dialog", { name: "If Help" });
    expect(within(help).getByText("Node này làm gì")).toBeInTheDocument();
    expect(within(help).getByText("Port và luồng chạy")).toBeInTheDocument();
    expect(within(help).getByText("Ví dụ workflow")).toBeInTheDocument();
    expect(within(help).getAllByText("Condition").length).toBeGreaterThan(0);
    expect(within(help).getAllByText("True port").length).toBeGreaterThan(0);
    expect(within(help).getAllByText("Done port").length).toBeGreaterThan(0);

    await userEvent.click(within(help).getByRole("button", { name: "Close dialog" }));
    fireEvent.contextMenu(within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }));
    await userEvent.click(await within(editor).findByRole("menuitem", { name: "Help" }));

    help = await screen.findByRole("dialog", { name: "If Help" });
    expect(within(help).getByText("Chạy khi condition sai; thiếu link sẽ no-op."))
      .toBeInTheDocument();
  });

  test("adds an action node by choosing an action type from the palette", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    const palette = await screen.findByRole("dialog", { name: "Choose an action type" });
    expect(palette.querySelector('[data-value="navigate"]')).toBeInTheDocument();
    expect(palette.querySelector('[data-value="click"]')).toBeInTheDocument();
    expect(within(palette).queryByRole("button", { name: "Logic" })).not.toBeInTheDocument();
    expect(palette.querySelector('[data-value="if_condition"]')).not.toBeInTheDocument();
    expect(palette.querySelector('[data-value="repeat_times"]')).not.toBeInTheDocument();
    expect(palette.querySelector('[data-value="retry_block"]')).not.toBeInTheDocument();
    expect(palette.querySelector('[data-value="stop_workflow"]')).not.toBeInTheDocument();

    await userEvent.click(palette.querySelector('[data-value="click"]') as HTMLElement);
    expect(await within(editor).findByRole("heading", { name: "Click" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                label: "Click",
                node_type: "action",
                config: expect.objectContaining({
                  type: "click",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("simplifies graph toolbar palettes and shows Fill Field for input text", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const toolbar = within(editor).getByRole("toolbar", { name: "Graph tools" });

    expect(within(toolbar).queryByRole("button", { name: "Add Output" }))
      .not.toBeInTheDocument();
    expect(within(toolbar).queryByRole("button", { name: "Fit" })).not.toBeInTheDocument();

    await userEvent.click(within(toolbar).getByRole("button", { name: "Add Variable" }));
    const variablePalette = await screen.findByRole("dialog", { name: "Choose a variable node" });
    expect(variablePalette.querySelector('[data-value="set_variable"]')).toBeInTheDocument();
    expect(variablePalette.querySelector('[data-value="transform_variable"]'))
      .not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(within(toolbar).getByRole("button", { name: "Add End" }));
    const endPalette = await screen.findByRole("dialog", { name: "Choose an end node" });
    expect(endPalette.querySelector('[data-value="end_success"]')).toBeInTheDocument();
    expect(endPalette.querySelector('[data-value="end_failure"]')).toBeInTheDocument();
    expect(endPalette.querySelector('[data-value="stop_workflow"]')).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(within(toolbar).getByRole("button", { name: "Add Action" }));
    const actionPalette = await screen.findByRole("dialog", { name: "Choose an action type" });
    expect(actionPalette.querySelector('[data-value="input_text"]')).toHaveTextContent(
      "Fill Field",
    );
    expect(within(actionPalette).queryByText("Input Text")).not.toBeInTheDocument();
    await userEvent.click(actionPalette.querySelector('[data-value="input_text"]') as HTMLElement);
    expect(within(editor).getByRole("heading", { name: "Fill Field" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                label: "Fill Field",
                config: expect.objectContaining({
                  type: "input_text",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("changes action node type from the graph inspector", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="wait"]') as HTMLElement,
    );
    await userEvent.click(
      within(editor).getByRole("button", { name: "Graph canvas node node-action-42" }),
    );
    await userEvent.click(within(editor).getByRole("combobox", { name: "Action type" }));
    await userEvent.type(within(editor).getByLabelText("Search action types"), "click");
    await userEvent.click(within(editor).getByRole("option", { name: "Click" }));
    expect(within(editor).getByRole("heading", { name: "Click" })).toBeInTheDocument();
    await userEvent.type(within(editor).getByLabelText("Target locator"), "//button");
    await userEvent.selectOptions(within(editor).getByLabelText("Target locator type"), "xpath");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCalls = workflowCommandCallMock.mock.calls.filter(
        ([command]) => command === "save_workflow_graph",
      );
      const saveCall = saveCalls[saveCalls.length - 1];
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                node_type: "action",
                config: expect.objectContaining({
                  type: "click",
                  config: expect.objectContaining({
                    target: expect.objectContaining({
                      locators: [
                        expect.objectContaining({
                          kind: "xpath",
                          value: "//button",
                        }),
                      ],
                    }),
                  }),
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("focuses action type search when opened and closes the dropdown on outside click", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("combobox", { name: "Action type" }));
    const search = within(editor).getByLabelText("Search action types");
    expect(search).toHaveFocus();

    await userEvent.click(within(editor).getByLabelText("Workflow graph canvas"));
    expect(within(editor).queryByLabelText("Search action types")).not.toBeInTheDocument();
  });

  test("persists close browser options from end nodes", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add End" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an end node" }))
        .querySelector('[data-value="end_failure"]') as HTMLElement,
    );
    await userEvent.click(
      within(editor).getByRole("switch", { name: "Close browser after workflow ends" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                node_type: "end_failure",
                config: expect.objectContaining({
                  close_browser: true,
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("defaults structured target locators to XPath", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="click"]') as HTMLElement,
    );
    await userEvent.click(
      within(editor).getByRole("button", { name: "Graph canvas node node-action-42" }),
    );

    expect(within(editor).getByLabelText("Target locator type")).toHaveValue("xpath");
  });

  test("inserts variables discovered from graph variable nodes into template fields", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Variable" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a variable node" }))
        .querySelector('[data-value="set_variable"]') as HTMLElement,
    );
    await userEvent.clear(within(editor).getByLabelText("Variable 1 name"));
    await userEvent.type(within(editor).getByLabelText("Variable 1 name"), "session.token");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="input_text"]') as HTMLElement,
    );
    await userEvent.click(within(editor).getByRole("button", { name: "Insert variable for Text" }));
    await userEvent.click(
      within(editor).getByRole("option", { name: "session.token Set Variables" }),
    );

    expect(within(editor).getByLabelText("Text")).toHaveValue("{{session.token}}");
    expect(
      within(within(editor).getByLabelText("Text token preview")).getByText("{{session.token}}"),
    ).toHaveClass("template-token-highlight");
  });

  test("shows icon graph tools for history and viewport modes", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const toolbar = within(editor).getByRole("toolbar", { name: "Graph tools" });

    [
      "Undo",
      "Redo",
      "Select canvas mode",
      "Pan canvas mode",
      "Fit graph view",
      "Auto arrange graph",
      "Arrange selection",
    ].forEach(
      (name) => {
        expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
      },
    );
    expect(within(toolbar).getByRole("button", { name: "Arrange selection" }))
      .toBeDisabled();

    await userEvent.click(within(toolbar).getByRole("button", { name: "Pan canvas mode" }));
    expect(within(toolbar).getByRole("button", { name: "Pan canvas mode" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(editor).getByLabelText("Workflow graph canvas"))
      .toHaveClass("graph-canvas-pan-mode");
  });

  test("groups toolbar controls and shows graph health when nothing is selected", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const toolbar = within(editor).getByRole("toolbar", { name: "Graph tools" });

    [
      "History tools",
      "Mode tools",
      "View and layout tools",
      "Add nodes",
      "Graph help",
    ].forEach((label) => {
      expect(within(toolbar).getByLabelText(label)).toBeInTheDocument();
    });

    await userEvent.click(
      within(editor).getByRole("button", { name: "Graph canvas node start" }),
    );
    expect(within(editor).getByText("Start node is protected.")).toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Delete Node" })).toBeDisabled();

    await userEvent.keyboard("{Escape}");
    const health = within(editor).getByRole("region", { name: "Graph health" });
    expect(within(health).getByText("3 nodes")).toBeInTheDocument();
    expect(within(health).getByText("2 links")).toBeInTheDocument();
    expect(within(health).getByText("0 unconfigured")).toBeInTheDocument();
    expect(within(health).getByRole("button", { name: "Add Action" })).toBeInTheDocument();
    expect(within(health).getByRole("button", { name: "Add Logic" })).toBeInTheDocument();
    expect(within(health).getByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(within(health).getByRole("button", { name: "Fit view" })).toBeInTheDocument();
    expect(within(health).getByRole("button", { name: "Auto arrange" })).toBeInTheDocument();
  });

  test("keeps palette search focused, bounded, and stable across categories", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));

    const palette = await screen.findByRole("dialog", { name: "Choose an action type" });
    const search = within(palette).getByLabelText("Search actions");
    expect(search).toHaveFocus();

    await userEvent.type(search, "zzzz");
    expect(within(palette).getByText("No matching actions."))
      .toBeInTheDocument();
    expect(within(palette).getByText("Clear search or choose another category."))
      .toBeInTheDocument();

    await userEvent.click(within(palette).getByRole("button", { name: "Common" }));
    expect(within(palette).getByLabelText("Search actions")).toHaveValue("zzzz");

    await userEvent.clear(within(palette).getByLabelText("Search actions"));
    await userEvent.type(within(palette).getByLabelText("Search actions"), "click");
    expect(palette.querySelector('[data-value="click"]')).toBeInTheDocument();
  });

  test("auto arranges graph nodes from the toolbar and saves the new positions", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: {
        version: 2,
        nodes: [
          {
            id: "start",
            node_type: "start",
            label: "Start",
            position: { x: 520, y: 180 },
            config: {},
            ports: nodePorts("start"),
            group_id: null,
          },
          {
            id: "node-a",
            node_type: "action",
            label: "A",
            position: { x: 40, y: 320 },
            config: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
            ports: nodePorts("action"),
            group_id: null,
          },
          {
            id: "node-b",
            node_type: "action",
            label: "B",
            position: { x: -160, y: -40 },
            config: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
            ports: nodePorts("action"),
            group_id: null,
          },
        ],
        edges: [
          {
            id: "edge-start-a",
            source_node_id: "start",
            source_port: "out",
            target_node_id: "node-a",
            target_port: "in",
            label: "next",
            condition: null,
          },
          {
            id: "edge-a-b",
            source_node_id: "node-a",
            source_port: "out",
            target_node_id: "node-b",
            target_port: "in",
            label: "next",
            condition: null,
          },
        ],
        viewport: { x: -80, y: 40, zoom: 0.75 },
      },
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const toolbar = within(editor).getByRole("toolbar", { name: "Graph tools" });

    await userEvent.click(within(toolbar).getByRole("button", { name: "Auto arrange graph" }));
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "start", position: { x: 0, y: 0 } }),
              expect.objectContaining({ id: "node-a", position: { x: 260, y: 0 } }),
              expect.objectContaining({ id: "node-b", position: { x: 520, y: 0 } }),
            ]),
          }),
        }),
      );
    });
  });

  test("keeps toolbar pan mode active after temporary spacebar panning ends", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const toolbar = within(editor).getByRole("toolbar", { name: "Graph tools" });
    const canvas = within(editor).getByLabelText("Workflow graph canvas");

    await userEvent.click(within(toolbar).getByRole("button", { name: "Pan canvas mode" }));
    expect(canvas).toHaveClass("graph-canvas-pan-mode");

    await userEvent.keyboard("[Space]");

    expect(within(toolbar).getByRole("button", { name: "Pan canvas mode" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(canvas).toHaveClass("graph-canvas-pan-mode");
  });

  test("validates and runs graph without the old runtime panels", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      validate_workflow_graph: [
        {
          level: "error",
          node_id: "node-if-42",
          edge_id: null,
          message: "If node needs a false branch",
        },
      ],
      save_workflow_graph: undefined,
      run_workflow: {
        status: "running",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: "node-if-42",
        current_step_number: 2,
        completed_step_ids: ["start"],
        outputs: {
          title: "Dashboard",
        },
        error: null,
      },
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "validate_workflow_graph",
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "node-if-42" }),
            ]),
          }),
        }),
      );
    });

    expect(within(editor).getByText("error: If node needs a false branch"))
      .toBeInTheDocument();
    expect(within(editor).queryByRole("region", { name: "Graph validation" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("region", { name: "Graph run timeline" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("region", { name: "Output inspector" }))
      .not.toBeInTheDocument();

    await confirmLaunchRun();

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "save_workflow_graph",
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "node-if-42" }),
            ]),
          }),
        }),
      );
      expect(workflowCommandCallMock).toHaveBeenCalledWith("run_workflow", {
        workflowId: "workflow-1",
      });
    });

    expect(within(editor).queryByText("Current: node-if-42")).not.toBeInTheDocument();
    expect(within(editor).queryByText("Dashboard")).not.toBeInTheDocument();
  });

  test("simplifies the logic palette while keeping hidden graph nodes compatible", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: {
        version: 1,
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
            id: "hidden-domain",
            node_type: "domain_allowlist",
            label: "Domain Allowlist",
            position: { x: 220, y: 0 },
            config: { domains: ["example.com"] },
            ports: nodePorts("domain_allowlist"),
            group_id: null,
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).getByRole("button", { name: "Graph canvas node hidden-domain" }))
      .toBeInTheDocument();
    expect(within(editor).getByLabelText("Allowed domains")).toHaveValue("example.com");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    const logicPalette = await screen.findByRole("dialog", { name: "Choose a logic node" });
    expect(within(logicPalette).queryByRole("button", { name: "Flow Control" }))
      .not.toBeInTheDocument();
    expect(within(logicPalette).queryByRole("button", { name: "Safety" }))
      .not.toBeInTheDocument();
    ["merge", "router", "switch", "while", "repeat_until", "break_loop", "continue_loop", "retry"].forEach(
      (value) => {
        expect(logicPalette.querySelector(`[data-value="${value}"]`)).toBeInTheDocument();
      },
    );
    ["try_catch", "fallback", "stop_workflow", "domain_allowlist"].forEach(
      (value) => {
        expect(logicPalette.querySelector(`[data-value="${value}"]`)).not.toBeInTheDocument();
      },
    );
    await userEvent.click(logicPalette.querySelector('[data-value="while"]') as HTMLElement);
    expect(within(editor).getByLabelText("Loop max attempts")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Loop timeout ms")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="merge"]') as HTMLElement,
    );
    expect(within(editor).getByRole("heading", { name: "Merge" })).toBeInTheDocument();
    expect(within(editor).getByLabelText("Merge In port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Merge Out port")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="router"]') as HTMLElement,
    );
    expect(within(editor).getByRole("heading", { name: "Router" })).toBeInTheDocument();
    expect(within(editor).getByLabelText("Router case label")).toHaveValue("Case 1");
    fireEvent.change(within(editor).getByLabelText("Router case label"), {
      target: { value: "Challenge" },
    });
    await userEvent.click(within(editor).getByRole("button", { name: "Add router case" }));
    expect(within(editor).getAllByLabelText("Router case label")).toHaveLength(2);
    await userEvent.click(within(editor).getByRole("button", { name: "Move router case Challenge down" }));
    expect(within(editor).getByLabelText("Router Challenge port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Router Case 2 port")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="switch"]') as HTMLElement,
    );
    expect(within(editor).getByRole("heading", { name: "Switch" })).toBeInTheDocument();
    await userEvent.type(within(editor).getByLabelText("Switch expression"), "login_state");
    fireEvent.change(within(editor).getByLabelText("Switch cases"), {
      target: { value: "logged_in\nlocked" },
    });
    expect(within(editor).getByLabelText("Switch Case 1 port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Switch Done port")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add End" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an end node" }))
        .querySelector('[data-value="end_failure"]') as HTMLElement,
    );
    expect(within(editor).getByLabelText("Failure reason")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                node_type: "merge",
              }),
              expect.objectContaining({
                node_type: "router",
                config: expect.objectContaining({
                  mode: "first_match",
                  cases: [
                    expect.objectContaining({ id: "2", label: "Case 2" }),
                    expect.objectContaining({ id: "1", label: "Challenge" }),
                  ],
                }),
                ports: expect.arrayContaining([
                  expect.objectContaining({ id: "case_1", label: "Challenge" }),
                  expect.objectContaining({ id: "case_2", label: "Case 2" }),
                ]),
              }),
              expect.objectContaining({
                node_type: "switch",
                config: {
                  expression: "login_state",
                  cases: ["logged_in", "locked"],
                },
              }),
              expect.objectContaining({
                node_type: "end_failure",
                config: expect.objectContaining({
                  reason: "Graph reached failure end",
                }),
              }),
              expect.objectContaining({
                node_type: "domain_allowlist",
                config: {
                  domains: ["example.com"],
                },
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("shows node context actions on the canvas without the custom edge overlay", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).queryByLabelText("Visible edge Start to Wait for page"))
      .not.toBeInTheDocument();
    expect(within(editor).queryByLabelText("Drag node step-1")).not.toBeInTheDocument();
    const nodeBody = within(editor).getByRole("button", { name: "Graph canvas node step-1" });
    expect(nodeBody).toHaveClass("graph-node-button");
    expect(nodeBody).toHaveClass("nodrag");
    const dragSurface = editor.querySelector(".graph-node-drag-surface");
    expect(dragSurface).toBeInTheDocument();
    expect(dragSurface).not.toHaveClass("nodrag");

    fireEvent.contextMenu(nodeBody);
    const menu = await within(editor).findByRole("menu", { name: "Node actions" });
    ["Duplicate", "Help", "Delete"].forEach((name) => {
      expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    });
    ["Edit", "Rename", "Focus"].forEach((name) => {
      expect(within(menu).queryByRole("menuitem", { name })).not.toBeInTheDocument();
    });
  });

  test("opens new workflows with a selected draft New node", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).getByRole("button", { name: "Graph canvas node new-node" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("heading", { name: "New node" })).toBeInTheDocument();
    expect(within(editor).getByRole("combobox", { name: "Action type" }))
      .toHaveTextContent("Choose action type");
    expect(within(editor).queryByText("start -> new-node")).not.toBeInTheDocument();
  });

  test("adds and configures a toolbar New node draft", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "New node" }));
    expect(within(editor).getByRole("heading", { name: "New node" })).toBeInTheDocument();
    await userEvent.click(within(editor).getByRole("combobox", { name: "Action type" }));
    await userEvent.type(within(editor).getByLabelText("Search action types"), "open tab");
    await userEvent.click(within(editor).getByRole("option", { name: "Open New Tab" }));
    expect(within(editor).getByRole("heading", { name: "Open New Tab" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                label: "Open New Tab",
                node_type: "action",
                config: expect.objectContaining({
                  type: "open_new_tab",
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("shows a multi-selection summary with bulk graph actions", async () => {
    vi.mocked(Date.now).mockReturnValue(42);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "New node" }));
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Graph canvas node node-action-42" }), {
      shiftKey: true,
    });

    expect(within(editor).getByRole("region", { name: "Graph selection summary" }))
      .toHaveTextContent("2 nodes selected");
    await userEvent.click(within(editor).getByRole("button", { name: "Duplicate selection" }));

    expect(within(editor).getByRole("button", { name: "Graph canvas node step-1-copy" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Graph canvas node node-action-42-copy" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("region", { name: "Graph selection summary" }))
      .toHaveTextContent("2 nodes selected");
  });

  test("handles graph keyboard shortcuts without firing inside config fields", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node new-node" }));

    await userEvent.keyboard("{Control>}d{/Control}");
    expect(within(editor).getByRole("button", { name: "Graph canvas node new-node-copy" }))
      .toBeInTheDocument();

    await userEvent.keyboard("{Control>}z{/Control}");
    expect(within(editor).queryByRole("button", { name: "Graph canvas node new-node-copy" }))
      .not.toBeInTheDocument();

    await userEvent.keyboard("{Control>}y{/Control}");
    expect(within(editor).getByRole("button", { name: "Graph canvas node new-node-copy" }))
      .toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node new-node" }));
    await userEvent.click(within(editor).getByRole("combobox", { name: "Action type" }));
    await userEvent.click(within(editor).getByRole("option", { name: "Wait" }));
    await userEvent.click(within(editor).getByLabelText("Duration ms"));
    await userEvent.keyboard("{Control>}d{/Control}");

    expect(within(editor).queryByRole("button", { name: "Graph canvas node new-node-copy-2" }))
      .not.toBeInTheDocument();
  });

  test("keeps clipboard shortcuts scoped to an active graph editor", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    const pageCopy = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(pageCopy);
    expect(pageCopy.defaultPrevented).toBe(false);

    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node new-node" }));
    const graphCopy = new KeyboardEvent("keydown", {
      key: "c",
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    });
    window.dispatchEvent(graphCopy);
    expect(graphCopy.defaultPrevented).toBe(true);
  });
});
