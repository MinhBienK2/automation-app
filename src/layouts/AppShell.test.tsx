import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
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
      "Settings",
    ]);
    expect(screen.queryByRole("button", { name: "Run Center" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Identities" })).not.toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Application content" }))
      .toHaveClass("app-content");
  });
});
