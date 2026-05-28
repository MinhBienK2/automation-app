import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { CommandSearchResult } from "../types/workflow";
import { AppShell } from "./AppShell";
import { mockWorkflowBridgeCommands, resetWorkflowBridge } from "../tests/mocks/electron";
import { workflow } from "../tests/mocks/workflowFixtures";
import { listWorkflowScenario } from "../tests/mocks/workflowScenarios";
import { renderApp } from "../tests/utils/renderApp";

describe("App shell", () => {
  beforeEach(() => {
    resetWorkflowBridge();
  });

  test("toggles the application sidebar", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    const toggle = await screen.findByRole("button", { name: "Collapse sidebar" });
    expect(toggle).toHaveAttribute("data-slot", "button");
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(toggle).not.toHaveTextContent("Collapse sidebar");
    expect(within(toggle).getByTestId("sidebar-toggle-icon")).toHaveAttribute(
      "aria-hidden",
      "true",
    );

    await userEvent.click(toggle);

    const collapsedToggle = screen.getByRole("button", { name: "Expand sidebar" });
    expect(collapsedToggle).toHaveAttribute("aria-expanded", "false");
    expect(collapsedToggle).not.toHaveTextContent("Expand sidebar");
  });

  test("renders the sidebar and scrollable content as separate layout regions", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    expect(await screen.findByRole("complementary", { name: "Application sidebar" }))
      .toBeInTheDocument();
    const logo = screen.getByRole("img", { name: "Mission Control logo" });
    expect(logo.getAttribute("src")).toContain("app-logo.svg");
    expect(screen.getByText("Mission Control")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workflows" })).toHaveAttribute(
      "data-slot",
      "button",
    );
    expect(screen.getByRole("button", { name: "Runs" })).toHaveAttribute(
      "data-slot",
      "button",
    );
    const navItems = within(screen.getByRole("navigation", { name: "Main navigation" }))
      .getAllByRole("button")
      .map((item) => item.textContent);
    expect(navItems).toEqual([
      "Overview",
      "Workflows",
      "Runs",
      "Evidence",
      "Schedules",
      "Identities",
      "Settings",
    ]);
    expect(screen.queryByRole("button", { name: "Run Center" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Identities" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Application content" }))
      .toHaveClass("app-content");
  });

  test("opens command palette results and selects with the keyboard", async () => {
    const result: CommandSearchResult = {
      id: "workflow:wf_1",
      type: "Workflow",
      label: "Login flow",
      context: "3 steps",
      target: { type: "workflow", workflow_id: "wf_1" },
    };
    const secondResult: CommandSearchResult = {
      id: "workflow:wf_2",
      type: "Workflow",
      label: "Signup flow",
      context: "4 steps",
      target: { type: "workflow", workflow_id: "wf_2" },
    };
    const onSelect = vi.fn();

    render(
      <AppShell
        activeItem="overview"
        sidebarCollapsed={false}
        commandSearchQuery="login"
        commandSearchGroups={[{ key: "Workflow", label: "Workflows", results: [result, secondResult] }]}
        commandSearchLoading={false}
        commandSearchError={null}
        alertCount={0}
        alertItems={[]}
        onCommandSearchQueryChange={() => {}}
        onCommandSearchResultSelect={onSelect}
        onOpenAlerts={() => {}}
        onOpenOverview={() => {}}
        onOpenEvidence={() => {}}
        onOpenIdentities={() => {}}
        onOpenRunCenter={() => {}}
        onOpenSchedules={() => {}}
        onOpenSettings={() => {}}
        onOpenWorkflows={() => {}}
        onToggleSidebar={() => {}}
      >
        <div>Workspace</div>
      </AppShell>,
    );

    const search = screen.getByRole("searchbox", { name: "Search Mission Control" });
    await userEvent.keyboard("/");
    expect(search).toHaveFocus();
    expect(screen.getByRole("dialog", { name: "Mission Control command palette" }))
      .toHaveTextContent("Login flow");
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Mission Control command palette" }))
      .not.toBeInTheDocument();

    search.blur();
    await userEvent.click(search);
    expect(screen.getByRole("dialog", { name: "Mission Control command palette" }))
      .toBeInTheDocument();
    await userEvent.keyboard("{ArrowDown}");
    await userEvent.keyboard("{Enter}");
    expect(onSelect).toHaveBeenCalledWith(secondResult);
  });

  test("previews alerts before opening the attention queue", async () => {
    const onOpenAlerts = vi.fn();

    render(
      <AppShell
        activeItem="overview"
        sidebarCollapsed={false}
        commandSearchQuery=""
        commandSearchGroups={[]}
        commandSearchLoading={false}
        commandSearchError={null}
        alertCount={1}
        alertItems={[
          {
            id: "attention-1",
            severity: "failure",
            title: "Launch blocked",
            summary: "Graph needs a start node",
            workflowName: "Login flow",
          },
        ]}
        onCommandSearchQueryChange={() => {}}
        onCommandSearchResultSelect={() => {}}
        onOpenAlerts={onOpenAlerts}
        onOpenOverview={() => {}}
        onOpenEvidence={() => {}}
        onOpenIdentities={() => {}}
        onOpenRunCenter={() => {}}
        onOpenSchedules={() => {}}
        onOpenSettings={() => {}}
        onOpenWorkflows={() => {}}
        onToggleSidebar={() => {}}
      >
        <div>Workspace</div>
      </AppShell>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Alerts 1" }));

    const popover = screen.getByRole("dialog", { name: "Alerts preview" });
    expect(popover).toHaveTextContent("Launch blocked");
    await userEvent.click(within(popover).getByRole("button", { name: "Open Attention Queue" }));
    expect(onOpenAlerts).toHaveBeenCalled();
  });
});
