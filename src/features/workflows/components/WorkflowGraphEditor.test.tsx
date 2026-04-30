import { screen, waitFor, within } from "@testing-library/react";
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

  test("adds selects connects deletes and saves graph nodes", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([sleepStep]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));

    const editor = await screen.findByRole("region", { name: "Visual Graph" });
    expect(within(editor).getByRole("button", { name: "Graph canvas node start" }))
      .toBeInTheDocument();
    expect(within(editor).getByRole("button", { name: "Graph canvas node step-1" }))
      .toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Add If" }));
    expect(within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }))
      .toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", { name: "Graph canvas node node-if-42" }));
    expect(within(editor).getByRole("heading", { name: "If" })).toBeInTheDocument();
    expect(within(editor).getByText("input: in")).toBeInTheDocument();

    await userEvent.selectOptions(within(editor).getByLabelText("Source node"), "start");
    await userEvent.selectOptions(within(editor).getByLabelText("Source port"), "out");
    await userEvent.selectOptions(within(editor).getByLabelText("Target node"), "node-if-42");
    await userEvent.selectOptions(within(editor).getByLabelText("Target port"), "in");
    await userEvent.click(within(editor).getByRole("button", { name: "Connect Nodes" }));
    expect(within(editor).getByText("start -> node-if-42")).toBeInTheDocument();

    await userEvent.click(within(editor).getByRole("button", {
      name: "Delete edge start -> node-if-42",
    }));
    expect(within(editor).queryByText("start -> node-if-42")).not.toBeInTheDocument();

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

    await userEvent.click(within(editor).getByRole("button", { name: "Add If" }));
    await userEvent.clear(within(editor).getByLabelText("Output name"));
    await userEvent.type(within(editor).getByLabelText("Output name"), "logged_in");
    await userEvent.clear(within(editor).getByLabelText("Value"));
    await userEvent.type(within(editor).getByLabelText("Value"), "false");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Repeat Times" }));
    await userEvent.clear(within(editor).getByLabelText("Times"));
    await userEvent.type(within(editor).getByLabelText("Times"), "3");

    await userEvent.click(within(editor).getByRole("button", { name: "Add Manual Approval" }));
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

  test("validates and runs graph with timeline and output context panels", async () => {
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
        error: null,
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add If" }));
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

    const validationPanel = within(editor).getByRole("region", {
      name: "Graph validation",
    });
    expect(within(validationPanel).getByText("If node needs a false branch"))
      .toBeInTheDocument();
    expect(within(validationPanel).getByText("node-if-42")).toBeInTheDocument();

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

    const timeline = within(editor).getByRole("region", { name: "Graph run timeline" });
    expect(within(timeline).getByText("Current: node-if-42")).toBeInTheDocument();
    expect(within(timeline).getByText("Completed: start")).toBeInTheDocument();

    const outputInspector = within(editor).getByRole("region", {
      name: "Output inspector",
    });
    expect(within(outputInspector).getByText("loop.index")).toBeInTheDocument();
    expect(within(outputInspector).getByText("No captured outputs yet")).toBeInTheDocument();
  });
});
