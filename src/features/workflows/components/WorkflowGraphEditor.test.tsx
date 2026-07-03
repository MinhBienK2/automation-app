import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { workflowCommandCallMock, mockWorkflowBridgeCommands, resetWorkflowBridge } from "../../../tests/mocks/electron";
import { sleepStep, workflow } from "../../../tests/mocks/workflowFixtures";
import { workflowDetailScenario } from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
import type {
  GraphNodeType,
  GraphPort,
  SubflowSummary,
  WorkflowGraph,
} from "../../../types/workflow";
import { randomChoicePortsForChoices } from "../lib/graphNodeConfig";
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
const workflowGraphShortcutsSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/useWorkflowGraphShortcuts.ts"),
  "utf8",
);
const workflowGraphToolbarSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/WorkflowGraphToolbar.tsx"),
  "utf8",
);
const removedSelectionLayoutLabel = ["Arrange", "selection"].join(" ");
const removedSelectionLayoutDisabledProp = ["isArrange", "SelectionDisabled"].join("");
const removedSelectionLayoutCallbackProp = ["onArrange", "Selection"].join("");
const removedSelectionLayoutFunction = ["function arrange", "Selection"].join("");
const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
const graphNodeTypeCoverage: Record<GraphNodeType, true> = {
  start: true,
  action: true,
  call_subflow: true,
  if: true,
  switch: true,
  merge: true,
  router: true,
  random_choice: true,
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
  check_conditions: true,
  calculate_value: true,
  transform_variable: true,
  update_number_variable: true,
  update_text_variable: true,
  update_flag_variable: true,
  update_list_variable: true,
  update_object_variable: true,
  assert_output: true,
  domain_allowlist: true,
  get_current_url: true,
  end_success: true,
  end_failure: true,
  quarantined: true,
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

  async function launchRun() {
    await userEvent.click(screen.getByRole("button", { name: "Run" }));
  }

  async function openWorkflowDetails() {
    // Navigate to Projects screen (shows grid by default)
    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    // Select the first project from the grid
    const grid = await screen.findByRole("list", { name: /projects/i });
    const projectCard = within(grid).getAllByRole("button")[0];
    await userEvent.click(projectCard);
    // Now the project detail view should be visible
    const projectDetail = await screen.findByRole("region", { name: "Project detail" });
    const collections = await within(projectDetail).findByRole("navigation", {
      name: "Project sections",
    });
    await within(collections).findByRole("button", { name: "Workflows" });
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
  }

  function loginSubflowSummary(): SubflowSummary {
    return {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: [],
      used_by_count: 1,
      created_at: "2026-05-27T00:00:00.000Z",
      updated_at: "2026-05-27T00:00:00.000Z",
    };
  }

  function callSubflowGraph(): WorkflowGraph {
    return {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: null,
          ports: nodePorts("start"),
          group_id: null,
        },
        {
          id: "call-login",
          node_type: "call_subflow",
          label: "Login Subflow",
          position: { x: 220, y: 0 },
          config: {
            subflow_id: "subflow-login",
            input_mapping: [],
            output_prefix: null,
          },
          ports: nodePorts("call_subflow"),
          group_id: null,
        },
      ],
      edges: [
        {
          id: "edge-start-call-login",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "call-login",
          target_port: "in",
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
  }

  function randomChoiceGraph(choiceCount: number): WorkflowGraph {
    const choices = Array.from({ length: choiceCount }, (_, index) => ({
      id: String(index + 1),
      label: `Choice ${index + 1}`,
      weight: 1,
    }));

    return {
      version: 2,
      nodes: [
        {
          id: "start",
          node_type: "start",
          label: "Start",
          position: { x: 0, y: 0 },
          config: null,
          ports: nodePorts("start"),
          group_id: null,
        },
        {
          id: "random-many",
          node_type: "random_choice",
          label: "Random Choice",
          position: { x: 220, y: 0 },
          config: {
            choices,
            output_name: "random_choice",
          },
          ports: randomChoicePortsForChoices(choices),
          group_id: null,
        },
      ],
      edges: [
        {
          id: "edge-start-random-many",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "random-many",
          target_port: "in",
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
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
    expect(within(editor).queryByRole("region", { name: "Node connections" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByText("input: in")).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Move Left" })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Move Right" })).not.toBeInTheDocument();
    expect(within(editor).getByLabelText("If True port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("If False port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("If Done port")).toBeInTheDocument();
    expect(within(editor).queryByRole("region", { name: "Port guidance" }))
      .not.toBeInTheDocument();

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

  test("opens the graph inspector as a right drawer only after selecting graph content", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(
      within(editor).queryByRole("complementary", {
        name: "Graph inspector drawer",
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(
      within(editor).getByRole("button", { name: "Graph canvas node step-1" }),
    );

    const inspectorDrawer = within(editor).getByRole("complementary", {
      name: "Graph inspector drawer",
    });
    expect(within(inspectorDrawer).getByRole("heading", { name: "Wait for page" }))
      .toBeInTheDocument();

    await userEvent.click(
      within(inspectorDrawer).getByRole("button", { name: "Close inspector" }),
    );

    expect(
      within(editor).queryByRole("complementary", {
        name: "Graph inspector drawer",
      }),
    ).not.toBeInTheDocument();
  });

  test("adds a configured subflow node from a dedicated subflow picker", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      list_subflows: [
        {
          id: "subflow-login",
          project_id: "project-1",
          name: "Login",
          description: "Reusable login path",
          tags: [],
          used_by_count: 2,
          created_at: "2026-05-27T00:00:00.000Z",
          updated_at: "2026-05-27T00:00:00.000Z",
        },
      ],
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Subflow" }));
    const subflowPicker = await screen.findByRole("dialog", { name: "Choose a subflow" });
    expect(within(subflowPicker).getByLabelText("Search subflows")).toBeInTheDocument();
    expect(subflowPicker.querySelector(".subflow-mode-grid")).toBeInTheDocument();
    expect(
      within(subflowPicker).getByRole("button", { name: /Call subflow/ }),
    ).toHaveClass("subflow-mode-card-active");
    expect(subflowPicker.querySelector(".subflow-picker-search-row")).toBeInTheDocument();
    expect(subflowPicker.querySelector(".subflow-picker-count")).toHaveTextContent("1 match");
    expect(
      within(subflowPicker).getByRole("button", { name: /Login/ }).querySelector(
        ".subflow-picker-result-action",
      ),
    ).toHaveTextContent("Add call node");
    await userEvent.click(within(subflowPicker).getByRole("button", { name: /Login/ }));

    const subflowNodeButton = within(editor).getByRole("button", {
      name: "Graph canvas node node-call_subflow-42",
    });
    expect(subflowNodeButton).toHaveTextContent("Login");
    expect(subflowNodeButton.closest(".graph-node")).toHaveClass("graph-node-subflow");

    const inspectorDrawer = within(editor).getByRole("complementary", {
      name: "Graph inspector drawer",
    });
    expect(within(inspectorDrawer).getByRole("heading", { name: "Login" }))
      .toBeInTheDocument();
    expect(within(inspectorDrawer).getByLabelText("Subflow")).toHaveDisplayValue("Login");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "save_workflow_graph",
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-call_subflow-42",
                node_type: "call_subflow",
                label: "Login",
                config: expect.objectContaining({
                  subflow_id: "subflow-login",
                  input_mapping: [],
                  output_prefix: null,
                }),
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("inserts real subflow nodes from the Add Subflow picker", async () => {
    const subflowGraph: WorkflowGraph = {
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
          id: "login-open",
          node_type: "action",
          label: "Open Login",
          position: { x: 220, y: 20 },
          config: { type: "navigate", config: { url: "https://login.test" } },
          ports: nodePorts("action"),
          group_id: null,
        },
        {
          id: "login-fill",
          node_type: "action",
          label: "Fill Login",
          position: { x: 440, y: 80 },
          config: { type: "input_text", config: { text: "qa@example.test" } },
          ports: nodePorts("action"),
          group_id: null,
        },
      ],
      edges: [
        {
          id: "edge-start-login-open",
          source_node_id: "start",
          source_port: "out",
          target_node_id: "login-open",
          target_port: "in",
          label: "next",
          condition: null,
        },
        {
          id: "edge-login-open-login-fill",
          source_node_id: "login-open",
          source_port: "out",
          target_node_id: "login-fill",
          target_port: "in",
          label: "next",
          condition: null,
        },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      list_subflows: [
        {
          id: "subflow-login",
          project_id: "project-1",
          name: "Login",
          description: "Reusable login path",
          tags: [],
          used_by_count: 2,
          created_at: "2026-05-27T00:00:00.000Z",
          updated_at: "2026-05-27T00:00:00.000Z",
        },
      ],
      get_subflow_graph: subflowGraph,
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Subflow" }));
    const subflowPicker = await screen.findByRole("dialog", { name: "Choose a subflow" });
    await userEvent.click(within(subflowPicker).getByRole("button", { name: /Insert nodes/ }));
    await userEvent.click(within(subflowPicker).getByRole("button", { name: /Login/ }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("get_subflow_graph", {
        subflowId: "subflow-login",
      });
    });

    expect(
      within(editor).getByRole("button", { name: "Graph canvas node login-open" }),
    ).toHaveTextContent("Open Login");
    expect(
      within(editor).getByRole("button", { name: "Graph canvas node login-fill" }),
    ).toHaveTextContent("Fill Login");

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      const saveCall = workflowCommandCallMock.mock.calls.find(
        ([command]) => command === "save_workflow_graph",
      );
      expect(saveCall?.[1]).toEqual(
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "login-open",
                node_type: "action",
                label: "Open Login",
              }),
              expect.objectContaining({
                id: "login-fill",
                node_type: "action",
                label: "Fill Login",
              }),
            ]),
            edges: expect.arrayContaining([
              expect.objectContaining({
                source_node_id: "login-open",
                target_node_id: "login-fill",
              }),
            ]),
          }),
        }),
      );
      const savedGraph = saveCall?.[1]?.graph as WorkflowGraph | undefined;
      expect(savedGraph?.nodes.some((node) => node.node_type === "call_subflow"))
        .toBe(false);
    });
  });

  test("opens the called subflow detail from the inspector and returns to workflow detail", async () => {
    const subflow = loginSubflowSummary();
    const subflowGraph = workflowDetailScenario([sleepStep]).get_workflow_graph as WorkflowGraph;
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: callSubflowGraph(),
      list_subflows: [subflow],
      get_subflow: { ...subflow, graph: subflowGraph },
      get_subflow_graph: subflowGraph,
      get_subflow_usage: [
        {
          workflow_id: "workflow-1",
          workflow_name: "Login flow",
        },
      ],
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(
      within(editor).getByRole("button", { name: "Graph canvas node call-login" }),
    );

    const inspectorDrawer = within(editor).getByRole("complementary", {
      name: "Graph inspector drawer",
    });
    await userEvent.click(
      within(inspectorDrawer).getByRole("button", {
        name: "Open subflow Login Subflow",
      }),
    );

    expect(await screen.findByRole("heading", { name: "Login Subflow" })).toBeInTheDocument();
    expect(workflowCommandCallMock).toHaveBeenCalledWith("get_subflow", {
      subflowId: "subflow-login",
    });
    await userEvent.click(screen.getByRole("button", { name: "Back to Workflow" }));

    const workflowHeader = await screen.findByRole("region", {
      name: "Workflow detail header",
    });
    expect(within(workflowHeader).getByText("Login flow")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  test("opens the called subflow detail from the node context menu", async () => {
    const subflow = loginSubflowSummary();
    const subflowGraph = workflowDetailScenario([sleepStep]).get_workflow_graph as WorkflowGraph;
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: callSubflowGraph(),
      list_subflows: [subflow],
      get_subflow: { ...subflow, graph: subflowGraph },
      get_subflow_graph: subflowGraph,
      get_subflow_usage: [],
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    fireEvent.contextMenu(
      within(editor).getByRole("button", { name: "Graph canvas node call-login" }),
    );

    const menu = await within(editor).findByRole("menu", { name: "Node actions" });
    await userEvent.click(
      within(menu).getByRole("menuitem", { name: "Open subflow Login Subflow" }),
    );

    expect(await screen.findByRole("heading", { name: "Login Subflow" })).toBeInTheDocument();
    expect(workflowCommandCallMock).toHaveBeenCalledWith("get_subflow", {
      subflowId: "subflow-login",
    });
  });

  test("marks action logic and subflow nodes with visible category badges", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep]),
      list_subflows: [
        {
          id: "subflow-login",
          project_id: "project-1",
          name: "Login",
          description: "Reusable login path",
          tags: [],
          used_by_count: 0,
          created_at: "2026-05-27T00:00:00.000Z",
          updated_at: "2026-05-27T00:00:00.000Z",
        },
      ],
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    const actionNode = within(editor)
      .getByRole("button", { name: "Graph canvas node step-1" })
      .closest(".graph-node");
    expect(actionNode).toHaveClass("graph-node-action");
    expect(within(actionNode as HTMLElement).getByText("Action")).toHaveClass(
      "graph-node-type-badge",
    );

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );
    const logicNode = within(editor)
      .getByRole("button", { name: "Graph canvas node node-if-42" })
      .closest(".graph-node");
    expect(logicNode).toHaveClass("graph-node-logic");
    expect(within(logicNode as HTMLElement).getByText("Logic")).toHaveClass(
      "graph-node-type-badge",
    );

    await userEvent.click(within(editor).getByRole("button", { name: "Add Subflow" }));
    await userEvent.click(
      within(await screen.findByRole("dialog", { name: "Choose a subflow" }))
        .getByRole("button", { name: /Login/ }),
    );
    const subflowNode = within(editor)
      .getByRole("button", { name: "Graph canvas node node-call_subflow-42" })
      .closest(".graph-node");
    expect(subflowNode).toHaveClass("graph-node-subflow");
    expect(within(subflowNode as HTMLElement).getByText("Subflow")).toHaveClass(
      "graph-node-type-badge",
    );
  });

  test("uses select-first canvas dragging with temporary spacebar panning", () => {
    expect(workflowGraphEditorSource).toContain("connectionDragThreshold={0}");
    expect(workflowGraphEditorSource).toContain("connectionRadius={32}");
    expect(workflowGraphEditorSource).toContain("nodesConnectable");
    expect(workflowGraphEditorSource).toContain("SelectionMode.Partial");
    expect(workflowGraphEditorSource).toContain("selectionOnDrag={!isPanMode}");
    expect(workflowGraphEditorSource).toContain("panOnDrag={isPanMode}");
    expect(workflowGraphEditorSource).toContain("graph-canvas-pan-mode");
    expect(workflowGraphShortcutsSource).toContain("event.code === \"Space\"");
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

  test("expands graph nodes with many ports so branch handles stay separated", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_workflow_graph: randomChoiceGraph(6),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    const randomChoiceButton = within(editor).getByRole("button", {
      name: "Graph canvas node random-many",
    });
    const randomChoiceNode = randomChoiceButton.closest(".graph-node");

    expect(randomChoiceNode).toHaveStyle({ height: "196px", minHeight: "196px" });
    expect(within(editor).getByLabelText("Random Choice Choice 6 port"))
      .toBeInTheDocument();
    expect(within(editor).getByLabelText("Random Choice Done port"))
      .toBeInTheDocument();
  });

  test("calculates toolbar node positions from the current visible canvas center", async () => {
    expect(
      workflowGraphEditorSource.match(
        /getVisibleNodeInsertionPosition\(\s*currentGraph\.nodes\.length,/g,
      ),
    ).toHaveLength(5);
    expect(workflowGraphEditorSource).not.toContain(
      "x: 120 + currentGraph.nodes.length * 48",
    );

    const { getVisibleNodeInsertionPosition } = await import(
      "../lib/nodeInsertionPosition"
    );
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
    ).toEqual({ x: 1432, y: 2411 });
    expect(screenToFlowPosition).toHaveBeenCalledWith(
      { x: 440, y: 380 },
      { snapToGrid: false },
    );
  });

  test("preserves multiple incoming links only for Merge inputs", async () => {
    const { replacePortEdge } = await import("../lib/graphEditorEdges");
    const sourceNode = (id: string) => ({
      id,
      type: "workflow" as const,
      position: { x: 0, y: 0 },
      data: {
        label: id,
        kindLabel: "Action",
        metaLabel: null,
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
        kindLabel: "Merge",
        metaLabel: null,
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
                condition: { kind: "variable_is_true", name: "ready" },
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
    expect(within(editor).getByRole("heading", { name: "While Loop", level: 3 }))
      .toBeInTheDocument();
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
    await userEvent.clear(within(editor).getByLabelText("Variable name"));
    await userEvent.type(within(editor).getByLabelText("Variable name"), "logged_in");

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
                    kind: "variable_is_true",
                    name: "logged_in",
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

  test("renames action and logic nodes from the graph inspector", async () => {
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
    await userEvent.clear(within(editor).getByLabelText("Node name"));
    await userEvent.type(within(editor).getByLabelText("Node name"), "Login wait");
    expect(within(editor).getByRole("heading", { name: "Login wait" })).toBeInTheDocument();
    expect(
      within(editor).getByRole("button", { name: "Graph canvas node node-action-42" }),
    ).toHaveTextContent("Login waitWait · 1s");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="if"]') as HTMLElement,
    );
    await userEvent.clear(within(editor).getByLabelText("Node name"));
    await userEvent.type(within(editor).getByLabelText("Node name"), "Check login state");
    expect(within(editor).getByRole("heading", { name: "Check login state" })).toBeInTheDocument();
    expect(
      within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }),
    ).toHaveTextContent("Check login stateIf");

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
                label: "Login wait",
              }),
              expect.objectContaining({
                id: "node-if-42",
                node_type: "if",
                label: "Check login state",
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
    expect(within(help).getByText("Port và luồng chạy")).toBeInTheDocument();
    expect(within(help).getByText("In")).toBeInTheDocument();
    expect(within(help).getByText("Out")).toBeInTheDocument();
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

    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node new-node" }));
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

    fireEvent.pointerDown(within(editor).getByLabelText("Set Variables Out port"));
    fireEvent.pointerUp(within(editor).getByLabelText("Fill Field In port"));

    await userEvent.click(within(editor).getByRole("button", { name: "Insert variable for Text" }));
    await userEvent.click(
      screen.getByRole("option", { name: "session.token Set Variables" }),
    );

    expect(within(editor).getByLabelText("Text")).toHaveValue("{{session.token}}");
    const tokens = screen.getAllByText("{{session.token}}");
    const spanToken = tokens.find((el) => el.tagName === "SPAN");
    expect(spanToken).toHaveClass("template-token-highlight");
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
    ].forEach(
      (name) => {
        expect(within(toolbar).getByRole("button", { name })).toBeInTheDocument();
      },
    );
    expect(within(toolbar).queryByRole("button", { name: removedSelectionLayoutLabel }))
      .not.toBeInTheDocument();
    const summary = within(toolbar).getByLabelText("Graph summary");
    expect(summary).toBeInTheDocument();
    expect(summary).toHaveTextContent(/nodes \/ .* edges/);
    expect(workflowGraphToolbarSource).not.toContain(removedSelectionLayoutLabel);
    expect(workflowGraphToolbarSource).not.toContain(removedSelectionLayoutDisabledProp);
    expect(workflowGraphToolbarSource).not.toContain(removedSelectionLayoutCallbackProp);
    expect(workflowGraphEditorSource).not.toContain(removedSelectionLayoutFunction);

    await userEvent.click(within(toolbar).getByRole("button", { name: "Pan canvas mode" }));
    expect(within(toolbar).getByRole("button", { name: "Pan canvas mode" }))
      .toHaveAttribute("aria-pressed", "true");
    expect(within(editor).getByLabelText("Workflow graph canvas"))
      .toHaveClass("graph-canvas-pan-mode");
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

    await launchRun();

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
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node hidden-domain" }));
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
    fireEvent.change(within(editor).getAllByLabelText("Case value")[0], {
      target: { value: "logged_in" },
    });
    await userEvent.click(within(editor).getByRole("button", { name: "Add switch case" }));
    fireEvent.change(within(editor).getAllByLabelText("Case value")[1], {
      target: { value: "locked" },
    });
    expect(within(editor).getByLabelText("Switch logged_in port")).toBeInTheDocument();
    expect(within(editor).getByLabelText("Switch locked port")).toBeInTheDocument();
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
                config: expect.objectContaining({
                  expression: "login_state",
                  cases: [
                    expect.objectContaining({ id: "1", value: "logged_in" }),
                    expect.objectContaining({ id: "2", value: "locked" }),
                  ],
                }),
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

  test("opens new workflow draft details after selecting the New node", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).getByRole("button", { name: "Graph canvas node new-node" }))
      .toBeInTheDocument();
    expect(
      within(editor).queryByRole("complementary", {
        name: "Graph inspector drawer",
      }),
    ).not.toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node new-node" }));

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

  test("creates a reusable subflow from selected workflow nodes without changing the workflow graph", async () => {
    const fillStep = {
      ...sleepStep,
      id: "step-2",
      name: "Fill credentials",
      order_index: 1,
      action_type: "input_text" as const,
      config: {
        type: "input_text" as const,
        config: {
          target: { locators: [{ kind: "css" as const, value: "#email" }], constraints: {} },
          text: "qa@example.test",
          clear_before_input: true,
        },
      },
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep, fillStep]),
      create_subflow: {
        id: "subflow-selected",
        project_id: "project-1",
        name: "Login block",
        description: "",
        tags: [],
        graph: { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        created_at: "2026-05-27T00:00:00.000Z",
        updated_at: "2026-05-27T00:00:00.000Z",
      },
      save_subflow_graph: undefined,
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-2" }), {
      shiftKey: true,
    });

    await userEvent.click(within(editor).getByRole("button", { name: "Create subflow" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Create subflow from selection",
    });
    await userEvent.type(within(dialog).getByLabelText("Subflow name"), "Login block");
    await userEvent.click(within(dialog).getByRole("button", { name: "Chỉ tạo" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith("create_subflow", {
        projectId: "project-1",
        input: { name: "Login block", description: null },
      });
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "save_subflow_graph",
        expect.objectContaining({
          subflowId: "subflow-selected",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({ id: "start", node_type: "start" }),
              expect.objectContaining({ id: "step-1", label: "Wait for page" }),
              expect.objectContaining({ id: "step-2", label: "Fill credentials" }),
            ]),
            edges: expect.arrayContaining([
              expect.objectContaining({
                source_node_id: "start",
                target_node_id: "step-1",
              }),
              expect.objectContaining({
                source_node_id: "step-1",
                target_node_id: "step-2",
              }),
            ]),
          }),
        }),
      );
    });

    expect(workflowCommandCallMock).not.toHaveBeenCalledWith(
      "save_workflow_graph",
      expect.anything(),
    );
    expect(within(editor).getByRole("button", { name: "Graph canvas node step-1" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Graph canvas node step-2" }))
      .toBeInTheDocument();
  });

  test("creates a reusable subflow and replaces the selected workflow nodes with a Call Subflow node", async () => {
    const fillStep = {
      ...sleepStep,
      id: "step-2",
      name: "Fill credentials",
      order_index: 1,
      action_type: "input_text" as const,
      config: {
        type: "input_text" as const,
        config: {
          target: { locators: [{ kind: "css" as const, value: "#email" }], constraints: {} },
          text: "qa@example.test",
          clear_before_input: true,
        },
      },
    };
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([sleepStep, fillStep]),
      create_subflow: {
        id: "subflow-selected",
        project_id: "project-1",
        name: "Login block",
        description: "",
        tags: [],
        graph: { version: 2, nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } },
        created_at: "2026-05-27T00:00:00.000Z",
        updated_at: "2026-05-27T00:00:00.000Z",
      },
      save_subflow_graph: undefined,
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    fireEvent.click(within(editor).getByRole("button", { name: "Graph canvas node step-2" }), {
      shiftKey: true,
    });

    await userEvent.click(within(editor).getByRole("button", { name: "Create subflow" }));
    const dialog = await screen.findByRole("dialog", {
      name: "Create subflow from selection",
    });
    await userEvent.type(within(dialog).getByLabelText("Subflow name"), "Login block");
    await userEvent.click(within(dialog).getByRole("button", { name: "Tạo và thay thế" }));

    await waitFor(() => {
      expect(within(editor).getByRole("button", { name: "Graph canvas node node-call_subflow-42" }))
        .toHaveTextContent("Login block");
    });
    expect(within(editor).queryByRole("button", { name: "Graph canvas node step-1" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Graph canvas node step-2" }))
      .not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    await waitFor(() => {
      expect(workflowCommandCallMock).toHaveBeenCalledWith(
        "save_workflow_graph",
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-call_subflow-42",
                node_type: "call_subflow",
                label: "Login block",
                config: expect.objectContaining({
                  subflow_id: "subflow-selected",
                  input_mapping: [],
                  output_prefix: null,
                }),
              }),
            ]),
            edges: expect.arrayContaining([
              expect.objectContaining({
                source_node_id: "start",
                target_node_id: "node-call_subflow-42",
              }),
              expect.objectContaining({
                source_node_id: "node-call_subflow-42",
                target_node_id: "end_success",
              }),
            ]),
          }),
        }),
      );
    });
    const saveCall = workflowCommandCallMock.mock.calls.find(
      ([command]) => command === "save_workflow_graph",
    );
    const savedGraph = saveCall?.[1] as { graph?: { nodes?: Array<{ id: string }> } };
    expect(savedGraph.graph?.nodes?.map((node) => node.id)).not.toContain("step-1");
    expect(savedGraph.graph?.nodes?.map((node) => node.id)).not.toContain("step-2");
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

  test("locks down graph editor and inspector when workflow is running", async () => {
    const runningRunState = {
      status: "running",
      mode: "run_workflow",
      target_step_id: null,
      current_step_id: "new-node",
      current_step_number: 1,
      completed_step_ids: ["start"],
      outputs: {},
      error: null,
    };

    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      get_run_state: runningRunState,
      list_run_states: [
        {
          run_id: "run-1",
          workflow_id: workflow.id,
          workflow_name: workflow.name,
          source: "manual",
          started_at: "2026-05-27T09:00:00.000Z",
          state: runningRunState,
          ...runningRunState,
        },
      ],
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflowDetails();
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    // Verify toolbar buttons are disabled
    expect(within(editor).getByRole("button", { name: "Undo" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Redo" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "New node" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Add Action" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Add Logic" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Add Variable" })).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Add End" })).toBeDisabled();

    // Select the node to open inspector
    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node new-node" }));

    // Verify inspector inputs and delete button are disabled
    expect(within(editor).getByLabelText("Node name")).toBeDisabled();
    expect(within(editor).getByRole("button", { name: "Delete Node" })).toBeDisabled();
  });
});

