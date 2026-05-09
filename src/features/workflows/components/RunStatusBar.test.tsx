import { render, screen, within } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { initialRunState } from "../../../lib/workflowUi";
import { RunStatusBar } from "./RunStatusBar";

describe("RunStatusBar", () => {
  test("renders a compact recent run event monitor", () => {
    render(
      <RunStatusBar
        state={{ ...initialRunState, status: "running" }}
        error=""
        runEvents={[
          {
            type: "run.started",
            severity: "info",
            runId: "run_1",
            payload: { stepCount: 2 },
            createdAt: "2026-05-09T00:00:00.000Z",
          },
          {
            type: "action.trace",
            severity: "info",
            runId: "run_1",
            nodeId: "node_1",
            actionId: "action_1",
            payload: { actionType: "click", mode: "playwright_action" },
            createdAt: "2026-05-09T00:00:01.000Z",
          },
        ]}
      />,
    );

    const monitor = screen.getByRole("list", { name: "Recent run events" });

    expect(within(monitor).getByText("run.started")).toBeInTheDocument();
    expect(within(monitor).getByText("action.trace")).toBeInTheDocument();
    expect(within(monitor).getByText("click")).toBeInTheDocument();
  });
});
