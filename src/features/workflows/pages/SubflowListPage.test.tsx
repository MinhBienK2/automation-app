import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
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

  test("opens subflow settings from the list and saves a renamed subflow", async () => {
    let currentSubflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: [],
      used_by_count: 0,
      created_at: "1",
      updated_at: "1",
    };
    const updateSubflow = vi.fn(({ input }: { input: { name?: string } }) => {
      currentSubflow = {
        ...currentSubflow,
        name: input.name ?? currentSubflow.name,
        updated_at: "2",
      };
      return { ...currentSubflow, graph: linearGraphFromSteps([]) };
    });
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: () => [currentSubflow],
      update_subflow: updateSubflow,
    });

    renderApp();

    await openSubflows();
    const row = (await screen.findByText("Login Subflow")).closest("[data-slot='card']");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Settings Login Subflow" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Subflow Settings" });
    const nameInput = within(dialog).getByLabelText("Subflow name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Session Prep");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(updateSubflow).toHaveBeenCalledWith({
        subflowId: "subflow-login",
        input: { name: "Session Prep" },
      });
    });
    expect(await screen.findByText("Session Prep")).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Subflow Settings" })).not.toBeInTheDocument();
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

  test("opens subflow settings from detail and updates the detail title", async () => {
    const graph = linearGraphFromSteps([sleepStep]);
    let currentSubflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: [],
      used_by_count: 0,
      created_at: "1",
      updated_at: "1",
    };
    const updateSubflow = vi.fn(({ input }: { input: { name?: string } }) => {
      currentSubflow = {
        ...currentSubflow,
        name: input.name ?? currentSubflow.name,
        updated_at: "2",
      };
      return { ...currentSubflow, graph };
    });
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: () => [currentSubflow],
      get_subflow: () => ({ ...currentSubflow, graph }),
      get_subflow_graph: graph,
      get_subflow_usage: [],
      update_subflow: updateSubflow,
    });

    renderApp();

    await openSubflows();
    const row = (await screen.findByText("Login Subflow")).closest("[data-slot='card']");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Open Login Subflow" }),
    );

    const header = await screen.findByRole("region", { name: "Subflow detail header" });
    await userEvent.click(within(header).getByRole("button", { name: "Settings" }));
    const dialog = await screen.findByRole("dialog", { name: "Subflow Settings" });
    const nameInput = within(dialog).getByLabelText("Subflow name");
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, "Session Prep");
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Settings" }));

    await waitFor(() => {
      expect(updateSubflow).toHaveBeenCalledWith({
        subflowId: "subflow-login",
        input: { name: "Session Prep" },
      });
    });
    expect(await screen.findByRole("heading", { name: "Session Prep" })).toBeInTheDocument();
  });

  test("exports a subflow and imports a subflow from file", async () => {
    const subflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: [],
      used_by_count: 0,
      created_at: "1",
      updated_at: "1",
    };

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: [subflow],
      export_subflow: {
        version: 1,
        subflow: {
          name: "Login Subflow",
          description: "Reusable login path",
          graph: linearGraphFromSteps([]),
        },
      },
      save_subflow_package_file: "saved-file-path.json",
      import_subflow: {
        id: "subflow-imported",
        project_id: "project-1",
        name: "Imported Subflow",
        description: "From package",
        tags: [],
        used_by_count: 0,
        created_at: "1",
        updated_at: "1",
      },
    });

    renderApp();

    await openSubflows();

    const row = (await screen.findByText("Login Subflow")).closest("[data-slot='card']");
    expect(row).toBeInTheDocument();

    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Export Login Subflow" }),
    );

    await waitFor(() => {
      expect(workflowBridgeMock.exportSubflow).toHaveBeenCalledWith("subflow-login");
      expect(workflowBridgeMock.saveSubflowPackageFile).toHaveBeenCalledWith({
        version: 1,
        subflow: {
          name: "Login Subflow",
          description: "Reusable login path",
          graph: linearGraphFromSteps([]),
        },
      });
    });

    const file = new File(
      [
        JSON.stringify({
          version: 1,
          subflow: {
            name: "Imported Subflow",
            description: "From package",
            graph: linearGraphFromSteps([]),
          },
        }),
      ],
      "imported.subflow.json",
      { type: "application/json" },
    );

    const input = screen.getByLabelText("Subflow package file");
    await userEvent.upload(input, file);

    await waitFor(() => {
      expect(workflowBridgeMock.importSubflow).toHaveBeenCalledWith(
        "project-1",
        expect.objectContaining({
          version: 1,
          subflow: expect.objectContaining({
            name: "Imported Subflow",
          }),
        }),
      );
    });
  });

  test("asks for confirmation before deleting a subflow and updates the list after deletion", async () => {
    const subflow: SubflowSummary = {
      id: "subflow-login",
      project_id: "project-1",
      name: "Login Subflow",
      description: "Reusable login path",
      tags: [],
      used_by_count: 0,
      created_at: "1",
      updated_at: "1",
    };

    let subflowList = [subflow];

    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_subflows: () => subflowList,
      delete_subflow: () => {
        subflowList = [];
        return Promise.resolve();
      },
    });

    renderApp();

    await openSubflows();

    expect(await screen.findByText("Login Subflow")).toBeInTheDocument();

    const row = (await screen.findByText("Login Subflow")).closest("[data-slot='card']");
    await userEvent.click(
      within(row as HTMLElement).getByRole("button", { name: "Delete Login Subflow" }),
    );

    const dialog = await screen.findByRole("dialog", { name: "Delete Subflow" });
    expect(within(dialog).getByText(/This removes Login Subflow/i)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Delete Subflow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.deleteSubflow).toHaveBeenCalledWith("subflow-login");
    });

    await waitFor(() => {
      expect(screen.queryByText("Login Subflow")).not.toBeInTheDocument();
    });
  });
});

