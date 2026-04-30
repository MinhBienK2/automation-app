import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { invokeMock, mockTauriCommands, resetTauriInvoke } from "./tests/mocks/tauri";
import { workflow } from "./tests/mocks/workflowFixtures";
import {
  listWorkflowScenario,
  workflowDetailScenario,
} from "./tests/mocks/workflowScenarios";
import { renderApp } from "./tests/utils/renderApp";

describe("App settings and graph autosave", () => {
  beforeEach(() => {
    resetTauriInvoke();
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(42);
  });

  test("opens settings from the sidebar and persists the autosave preference", async () => {
    mockTauriCommands(listWorkflowScenario([workflow]));

    const { unmount } = renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const autosaveToggle = screen.getByRole("checkbox", {
      name: "Autosave graph changes",
    });
    expect(autosaveToggle).toBeChecked();

    await userEvent.click(autosaveToggle);
    expect(autosaveToggle).not.toBeChecked();

    unmount();
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("checkbox", { name: "Autosave graph changes" }),
    ).not.toBeChecked();
  });

  test("autosaves graph changes by default", async () => {
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockTauriCommands({
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
    expect(await screen.findByText("Saved")).toBeInTheDocument();
  });

  test("keeps the draft visible when autosave fails and does not run the stale saved graph", async () => {
    const saveGraph = vi.fn().mockRejectedValue(new Error("disk is full"));
    mockTauriCommands({
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
    await userEvent.click(within(header).getByRole("button", { name: "Run" }));

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalled();
    });
    expect(invokeMock).not.toHaveBeenCalledWith("run_workflow", {
      workflowId: "workflow-1",
    });
  });

  test("renders primary graph actions only in the workflow header", async () => {
    mockTauriCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(header).getByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Validate Graph" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Save Graph" }))
      .not.toBeInTheDocument();
  });
});
