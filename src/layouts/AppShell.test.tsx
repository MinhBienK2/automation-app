import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test } from "vitest";
import { mockTauriCommands, resetTauriInvoke } from "../tests/mocks/tauri";
import { workflow } from "../tests/mocks/workflowFixtures";
import { listWorkflowScenario } from "../tests/mocks/workflowScenarios";
import { renderApp } from "../tests/utils/renderApp";

describe("App shell", () => {
  beforeEach(() => {
    resetTauriInvoke();
  });

  test("toggles the application sidebar", async () => {
    mockTauriCommands(listWorkflowScenario([workflow]));

    renderApp();

    const toggle = await screen.findByRole("button", { name: "Collapse sidebar" });
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
    mockTauriCommands(listWorkflowScenario([workflow]));

    renderApp();

    expect(await screen.findByRole("complementary", { name: "Application sidebar" }))
      .toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Application content" }))
      .toHaveClass("app-content");
  });
});
