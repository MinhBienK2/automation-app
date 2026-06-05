import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import type { RunState, WorkflowGraph } from "../../../types/workflow";
import { RunMonitorDrawer } from "./RunMonitorDrawer";
import { nodePorts } from "../lib/workflowGraph";

const graph: WorkflowGraph = {
  version: 2,
  nodes: [
    {
      id: "start",
      node_type: "start",
      label: "Start",
      position: { x: 0, y: 0 },
      config: {},
      ports: nodePorts("start"),
      group_id: null,
    },
    {
      id: "step-1",
      node_type: "action",
      label: "Open page",
      position: { x: 220, y: 0 },
      config: { type: "wait", config: { condition: "duration", duration_ms: 1000 } },
      ports: nodePorts("action"),
      group_id: null,
    },
    {
      id: "step-2",
      node_type: "action",
      label: "Click button",
      position: { x: 440, y: 0 },
      config: {
        type: "click",
        config: {
          target: {
            locators: [{ kind: "css", value: "button" }],
            constraints: {},
          },
        },
      },
      ports: nodePorts("action"),
      group_id: null,
    },
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 },
};

const baseRunState: RunState = {
  status: "running",
  mode: "run_workflow",
  target_step_id: null,
  current_step_id: "step-1",
  current_step_number: 1,
  completed_step_ids: [],
  outputs: {},
  error: null,
};

describe("RunMonitorDrawer", () => {
  test("scrolls to the newest timeline event when the log grows", () => {
    const scrollIntoViewMock = vi.fn();
    Object.defineProperty(window.HTMLElement.prototype, "scrollIntoView", {
      configurable: true,
      value: scrollIntoViewMock,
    });

    const { rerender } = render(
      <RunMonitorDrawer
        graph={graph}
        runState={baseRunState}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
    scrollIntoViewMock.mockClear();

    rerender(
      <RunMonitorDrawer
        graph={graph}
        runState={{
          ...baseRunState,
          current_step_id: "step-2",
          current_step_number: 2,
          completed_step_ids: ["step-1"],
        }}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    const timeline = screen.getByRole("region", { name: "Run timeline" });
    expect(within(timeline).getByText("2 events")).toBeInTheDocument();
    expect(scrollIntoViewMock).toHaveBeenCalledTimes(1);
  });
});
