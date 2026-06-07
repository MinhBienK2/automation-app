import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import {
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
  workflowBridgeMock,
} from "../../../tests/mocks/electron";
import { workflow } from "../../../tests/mocks/workflowFixtures";
import { sleepStep } from "../../../tests/mocks/workflowFixtures";
import { listWorkflowScenario } from "../../../tests/mocks/workflowScenarios";
import { renderApp } from "../../../tests/utils/renderApp";
import type { SubflowSummary } from "../../../types/workflow";
import { linearGraphFromSteps } from "../lib/workflowGraph";

describe("Subflow list integration", () => {
  beforeEach(() => {
    resetWorkflowBridge();
  });

  async function openSubflows() {
    await userEvent.click(await screen.findByRole("button", { name: "Projects" }));
    const projectDetail = await screen.findByRole("region", { name: "Project detail" });
    const collections = await within(projectDetail).findByRole("navigation", {
      name: "Project sections",
    });
    await userEvent.click(within(collections).getByRole("button", { name: "Subflows" }));
  }

  test("lists project subflows and duplicates one from the sidebar route", async () => {
    const subflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: ["auth"],
      used_by_count: 2,
      created_at: "1",
      updated_at: "1",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: [subflow],
      duplicate_subflow: { ...subflow, id: "subflow-copy", name: "Copy of Login Subflow" },
    });

    renderApp();

    await openSubflows();

    expect(await screen.findByRole("heading", { name: "Subflows" })).toBeInTheDocument();
    const row = (await screen.findByText("Login Subflow")).closest("[data-slot='card']");
    expect(row).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("Reusable login path")).toBeInTheDocument();
    expect(within(row as HTMLElement).getByText("2 workflows")).toBeInTheDocument();

    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Duplicate Login Subflow" }),
    );

    await waitFor(() => {
      expect(workflowBridgeMock.duplicateSubflow).toHaveBeenCalledWith(
        "subflow-login",
        "Copy of Login Subflow",
      );
    });
  });

  test("opens a subflow editor with usage warning and no nested Call Subflow palette", async () => {
    const graph = linearGraphFromSteps([sleepStep]);
    const subflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: [],
      used_by_count: 1,
      created_at: "1",
      updated_at: "1",
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: [subflow],
      get_subflow: { ...subflow, graph },
      get_subflow_graph: graph,
      get_subflow_usage: [
        {
          workflow_id: "workflow-checkout",
          workflow_name: "Checkout E2E",
        },
      ],
      save_subflow_graph: undefined,
    });

    renderApp();

    await openSubflows();
    const row = (await screen.findByText("Login Subflow")).closest("[data-slot='card']");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Open Login Subflow" }),
    );

    expect(await screen.findByRole("heading", { name: "Login Subflow" })).toBeInTheDocument();
    const header = screen.getByRole("region", { name: "Subflow detail header" });
    expect(within(header).getByText("Project: Main")).toBeInTheDocument();
    expect(
      within(header).getByRole("button", { name: "Subflows" }),
    ).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Save" })).toBeDisabled();
    expect(within(header).queryByRole("button", { name: "Duplicate Login Subflow" }))
      .not.toBeInTheDocument();
    expect(within(header).queryByRole("button", { name: "Delete Login Subflow" }))
      .not.toBeInTheDocument();
    expect(screen.getByText("Used by 1 workflow")).toBeInTheDocument();
    expect(screen.getByText("Checkout E2E")).toBeInTheDocument();
    expect(
      screen.getByText("This subflow is used by 1 workflow. Saving changes will affect their next run."),
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Add Logic" }));
    const logicPalette = await screen.findByRole("dialog", { name: "Choose a logic node" });
    expect(within(logicPalette).queryByText("Call Subflow")).not.toBeInTheDocument();
    await userEvent.click(within(logicPalette).getByRole("button", { name: /^Merge/ }));

    expect(within(header).getByRole("button", { name: "Save" })).not.toBeDisabled();

    await userEvent.click(screen.getByRole("button", { name: "Save" }));
    await waitFor(() => {
      expect(workflowBridgeMock.saveSubflowGraph).toHaveBeenCalledWith(
        "subflow-login",
        expect.objectContaining({
          nodes: expect.arrayContaining([
            expect.objectContaining({ node_type: "merge" }),
          ]),
        }),
      );
    });

    await userEvent.click(screen.getByRole("button", { name: "Back to Subflows" }));
    expect(await screen.findByRole("heading", { name: "Subflows" })).toBeInTheDocument();
    expect(screen.getByText("Login Subflow")).toBeInTheDocument();
  });
});
