import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { invokeMock, mockTauriCommands, resetTauriInvoke } from "../../../tests/mocks/tauri";
import { sleepStep } from "../../../tests/mocks/workflowFixtures";
import { workflowDetailScenario } from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
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

describe("Workflow graph editor integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
    window.localStorage.setItem(
      "workflow-manager:settings:v1",
      JSON.stringify({ graphAutosaveEnabled: false }),
    );
    vi.restoreAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(42);
  });

  test("adds selects deletes and saves logic nodes through the grouped React Flow workspace", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

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
      expect(invokeMock).toHaveBeenCalledWith(
        "save_workflow_graph",
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            version: 1,
          }),
        }),
      );
    });
  });

  test("reserves left mouse dragging for handle connections instead of pane panning", () => {
    expect(workflowGraphEditorSource).toContain("connectionDragThreshold={0}");
    expect(workflowGraphEditorSource).toContain("connectionRadius={32}");
    expect(workflowGraphEditorSource).toContain("nodesConnectable");
    expect(workflowGraphEditorSource).toContain("panOnDrag");
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

  test("connects nodes through the app-level port fallback when native drag is unavailable", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
    expect(within(help).getByText("Condition")).toBeInTheDocument();
    expect(within(help).getByText("Timeout ms")).toBeInTheDocument();
  });

  test("opens detailed logic node help from the graph inspector and context menu", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
    expect(within(help).getByText("Condition")).toBeInTheDocument();
    expect(within(help).getByText("True port")).toBeInTheDocument();
    expect(within(help).getByText("Done port")).toBeInTheDocument();

    await userEvent.click(within(help).getByRole("button", { name: "Close dialog" }));
    fireEvent.contextMenu(within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }));
    await userEvent.click(await within(editor).findByRole("menuitem", { name: "Help" }));

    help = await screen.findByRole("dialog", { name: "If Help" });
    expect(within(help).getByText("Chạy khi condition sai; thiếu link sẽ no-op."))
      .toBeInTheDocument();
  });

  test("adds an action node by choosing an action type from the palette", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
    await userEvent.type(within(editor).getByLabelText("XPath"), "//button");
    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = invokeMock.mock.calls.find(
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
                  type: "click",
                  config: {
                    xpath: "//button",
                    iframe_xpath: null,
                    mode: null,
                    button: null,
                    click_count: null,
                    scroll_into_view: null,
                    block: null,
                    inline: null,
                    position: null,
                    offset_x: null,
                    offset_y: null,
                    wait_until: null,
                    timeout_ms: null,
                    retry_interval_ms: null,
                    post_click_wait_ms: null,
                  },
                },
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("validates and runs graph without the old runtime panels", async () => {
    mockTauriCommands({
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );
    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
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

    await userEvent.click(screen.getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(invokeMock).toHaveBeenCalledWith(
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
      expect(invokeMock).toHaveBeenCalledWith("run_workflow", {
        workflowId: "workflow-1",
      });
    });

    expect(within(editor).queryByText("Current: node-if-42")).not.toBeInTheDocument();
    expect(within(editor).queryByText("Dashboard")).not.toBeInTheDocument();
  });

  test("simplifies the logic palette while keeping hidden graph nodes compatible", async () => {
    mockTauriCommands({
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

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
    ["switch", "while", "repeat_until", "break_loop", "continue_loop", "retry"].forEach(
      (value) => {
        expect(logicPalette.querySelector(`[data-value="${value}"]`)).toBeInTheDocument();
      },
    );
    ["try_catch", "fallback", "stop_workflow", "manual_approval", "rate_limit", "domain_allowlist"].forEach(
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
      const saveCall = invokeMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
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
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).queryByLabelText("Visible edge Start to Wait for page"))
      .not.toBeInTheDocument();
    expect(within(editor).getByLabelText("Drag node step-1")).toBeInTheDocument();

    fireEvent.contextMenu(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    const menu = await within(editor).findByRole("menu", { name: "Node actions" });
    ["Duplicate", "Help", "Delete"].forEach((name) => {
      expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    });
    ["Edit", "Rename", "Focus"].forEach((name) => {
      expect(within(menu).queryByRole("menuitem", { name })).not.toBeInTheDocument();
    });
  });

  test("opens new workflows with a selected draft New node", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).getByRole("button", { name: "Graph canvas node new-node" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("heading", { name: "New node" })).toBeInTheDocument();
    expect(within(editor).getByRole("combobox", { name: "Action type" }))
      .toHaveTextContent("Choose action type");
    expect(within(editor).queryByText("start -> new-node")).not.toBeInTheDocument();
  });

  test("adds and configures a toolbar New node draft", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "New node" }));
    expect(within(editor).getByRole("heading", { name: "New node" })).toBeInTheDocument();
    await userEvent.click(within(editor).getByRole("combobox", { name: "Action type" }));
    await userEvent.type(within(editor).getByLabelText("Search action types"), "open tab");
    await userEvent.click(within(editor).getByRole("option", { name: "Open New Tab" }));
    expect(within(editor).getByRole("heading", { name: "Open New Tab" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = invokeMock.mock.calls.find(
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
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
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
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

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
});
