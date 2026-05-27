import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  workflowBridgeMock,
  workflowCommandCallMock,
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
} from "./tests/mocks/electron";
import { workflow } from "./tests/mocks/workflowFixtures";
import {
  idleRunState,
  listWorkflowScenario,
  workflowDetailScenario,
} from "./tests/mocks/workflowScenarios";
import { renderApp } from "./tests/utils/renderApp";

describe("App settings and graph autosave", () => {
  beforeEach(() => {
    resetWorkflowBridge();
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(42);
  });

  async function confirmLaunchRun(scope: HTMLElement = document.body) {
    await userEvent.click(within(scope).getByRole("button", { name: "Launch Run" }));
    const dialog = await screen.findByRole("dialog", { name: "Launch Run" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Launch Run" }));
  }

  test("opens settings from the sidebar and persists the autosave preference", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    const { unmount } = renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const autosaveToggle = screen.getByRole("switch", {
      name: "Autosave graph changes",
    });
    expect(autosaveToggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(autosaveToggle);
    expect(autosaveToggle).toHaveAttribute("aria-checked", "false");

    unmount();
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("switch", { name: "Autosave graph changes" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("shows graph keyboard and mouse guidance in settings", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    const shortcuts = await screen.findByRole("region", { name: "Graph shortcuts" });
    expect(within(shortcuts).getByText("Drag empty canvas")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Box select nodes and links")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Hold Space + drag")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Pan the graph view")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl/Cmd + Enter")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Launch Run")).toBeInTheDocument();
  });

  test("autosaves graph changes by default", async () => {
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                node_type: "action",
                config: expect.objectContaining({ type: "navigate" }),
              }),
            ]),
          }),
        }),
      );
    });
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);
  });

  test("keeps the draft visible when autosave fails and does not run the stale saved graph", async () => {
    const saveGraph = vi.fn().mockRejectedValue(new Error("disk is full"));
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
      run_workflow: {
        status: "running",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: [],
        outputs: {},
        error: null,
      },
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    expect(
      await within(editor).findByRole("button", { name: "Graph canvas node node-action-42" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Autosave failed")).toBeInTheDocument();

    const header = screen.getByRole("region", { name: "Workflow detail header" });
    await confirmLaunchRun(header);

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalled();
    });
    expect(workflowCommandCallMock).not.toHaveBeenCalledWith("run_workflow", {
      workflowId: "workflow-1",
    });
  });

  test("renders primary graph actions only in the workflow header", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(header).getByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Launch Run" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Validate Graph" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Save Graph" }))
      .not.toBeInTheDocument();
  });

  test("polls run state for a workflow started from the list", async () => {
    let runStateCalls = 0;
    let runSnapshotCalls = 0;
    const runningSnapshot = {
      run_id: "run-1",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      source: "manual" as const,
      started_at: "2026-05-17T06:00:00.000Z",
      state: {
        ...idleRunState,
        status: "running" as const,
        mode: "run_workflow" as const,
      },
    };
    const successSnapshot = {
      ...runningSnapshot,
      state: {
        ...runningSnapshot.state,
        status: "success" as const,
      },
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: () => {
        runSnapshotCalls += 1;
        if (runSnapshotCalls === 1) return [];
        return runSnapshotCalls === 2 ? [runningSnapshot] : [successSnapshot];
      },
      get_run_state: () => {
        runStateCalls += 1;
        return idleRunState;
      },
      run_workflow: runningSnapshot,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Run Login flow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
    });
    expect(await screen.findByText("Running")).toBeInTheDocument();

    expect(await screen.findByText("Run succeeded: Login flow")).toBeInTheDocument();
    expect(runSnapshotCalls).toBeGreaterThan(1);
    expect(runStateCalls).toBeGreaterThanOrEqual(1);
  });
});
