import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { invokeMock, mockTauriCommands, resetTauriInvoke } from "../../../tests/mocks/tauri";
import { sleepStep } from "../../../tests/mocks/workflowFixtures";
import { workflowDetailScenario } from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";

describe("Workflow graph editor integration", () => {
  beforeEach(() => {
    resetTauriInvoke();
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

    await userEvent.click(within(editor).getByRole("button", { name: "Delete Node" }));
    expect(within(editor).queryByRole("button", { name: "Graph canvas node node-if-42" }))
      .not.toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Save Graph" }));

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

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="manual_approval"]') as HTMLElement,
    );
    expect(within(editor).getByText("Human checkpoint only; this does not bypass challenges."))
      .toBeInTheDocument();
    await userEvent.clear(within(editor).getByLabelText("Approval reason"));
    await userEvent.type(within(editor).getByLabelText("Approval reason"), "Review before posting");

    await userEvent.click(within(editor).getByRole("button", { name: "Save Graph" }));

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
              expect.objectContaining({
                node_type: "manual_approval",
                config: expect.objectContaining({
                  reason: "Review before posting",
                }),
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
    await userEvent.click(within(editor).getByRole("button", { name: "Save Graph" }));

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

    await userEvent.click(within(editor).getByRole("button", { name: "Save Graph" }));

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
    await userEvent.selectOptions(within(editor).getByLabelText("Action type"), "click");
    expect(within(editor).getByRole("heading", { name: "Click" })).toBeInTheDocument();
    await userEvent.type(within(editor).getByLabelText("XPath"), "//button");
    await userEvent.click(within(editor).getByRole("button", { name: "Save Graph" }));

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
    await userEvent.click(within(editor).getByRole("button", { name: "Validate Graph" }));

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

    await userEvent.click(within(editor).getByRole("button", { name: "Run" }));

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

  test("offers advanced node types with structured inspector fields", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    const logicPalette = await screen.findByRole("dialog", { name: "Choose a logic node" });
    [
      "switch",
      "while",
      "repeat_until",
      "try_catch",
      "fallback",
      "break_loop",
      "continue_loop",
      "stop_workflow",
      "manual_approval",
      "rate_limit",
      "domain_allowlist",
    ].forEach((value) => {
      expect(logicPalette.querySelector(`[data-value="${value}"]`)).toBeInTheDocument();
    });
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

    await userEvent.click(within(editor).getByRole("button", { name: "Add End" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an end node" }))
        .querySelector('[data-value="end_failure"]') as HTMLElement,
    );
    expect(within(editor).getByLabelText("Failure reason")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add Logic" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose a logic node" }))
        .querySelector('[data-value="domain_allowlist"]') as HTMLElement,
    );
    expect(within(editor).getByLabelText("Allowed domains")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Save Graph" }));

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
                  domains: [],
                },
              }),
            ]),
          }),
        }),
      );
    });
  });

  test("shows edge direction order and node context actions on the canvas", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(editor).queryByLabelText("Edge direction order")).not.toBeInTheDocument();
    expect(within(editor).getByLabelText("Drag node step-1")).toBeInTheDocument();

    fireEvent.contextMenu(within(editor).getByRole("button", { name: "Graph canvas node step-1" }));
    const menu = await within(editor).findByRole("menu", { name: "Node actions" });
    [
      "Edit",
      "Rename",
      "Duplicate",
      "Focus",
      "Help",
      "Delete",
    ].forEach((name) => {
      expect(within(menu).getByRole("menuitem", { name })).toBeInTheDocument();
    });
  });
});
