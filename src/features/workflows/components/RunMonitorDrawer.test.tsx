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

  test("shows runtime failure action context", () => {
    render(
      <RunMonitorDrawer
        graph={graph}
        runState={{
          ...baseRunState,
          status: "failed",
          current_step_id: null,
          current_step_number: null,
          completed_step_ids: ["step-1"],
          error: {
            step_id: "step-2",
            step_number: 2,
            step_name: "Checkout > Click button",
            action_type: "click",
            reason: "frame.click: Timeout 30000ms exceeded",
            diagnostics: {
              compiled_step_id: "step-2",
              subflow_node_id: "click-button",
              label_path: ["Checkout", "Click button"],
              action_summary: "CSS button",
              subflow_id: "subflow-checkout",
              subflow_name: "Checkout",
              subflow_step_number: 2,
              subflow_step_count: 4,
            },
          },
        }}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    const issue = screen.getByRole("region", { name: "Run monitor issue" });
    expect(within(issue).getByText("Location: Checkout > Click button"))
      .toBeInTheDocument();
    expect(within(issue).getByText("Subflow step: 2 of 4 · node click"))
      .toBeInTheDocument();
    expect(within(issue).getByText("Action target: CSS button"))
      .toBeInTheDocument();
  });

  test("renders expandable timeline items and shows environment variables delta and full state", async () => {
    const user = (await import("@testing-library/user-event")).default.setup();
    const runStateWithTraces: RunState = {
      ...baseRunState,
      completed_step_ids: ["step-1", "step-2"],
      status: "success",
      outputs: {
        __action_traces: [
          {
            output_summary: {
              added_keys: ["var1"],
              changed_keys: [],
              removed_keys: [],
            },
            output_values: {
              var1: "value1",
            },
          },
          {
            output_summary: {
              added_keys: ["var2"],
              changed_keys: ["var1"],
              removed_keys: [],
            },
            output_values: {
              var2: "value2",
              var1: "newValue1",
            },
          },
        ],
      },
    };

    render(
      <RunMonitorDrawer
        graph={graph}
        runState={runStateWithTraces}
        initialVariables={[{ name: "initVar", value: "initVal" }]}
        onClose={vi.fn()}
        onFocusNode={vi.fn()}
      />,
    );

    // Timeline should show 2 events
    const timeline = screen.getByRole("region", { name: "Run timeline" });
    expect(within(timeline).getByText("2 events")).toBeInTheDocument();

    // The environment panel should not be visible initially
    expect(screen.queryByText("Environment changes")).not.toBeInTheDocument();

    // Click first event to expand it
    const event1Button = screen.getByRole("button", {
      name: /Event 1 completed: Step 1 Open page/i,
    });
    await user.click(event1Button);

    // Now first event environment changes should be visible
    expect(screen.getByText("Environment changes")).toBeInTheDocument();
    expect(screen.getByText("added")).toBeInTheDocument();
    expect(screen.getByText("var1")).toBeInTheDocument();
    expect(screen.getByText("value1")).toBeInTheDocument();

    // Click "Show full environment" button
    const toggleButton = screen.getByRole("button", { name: /Show full environment/i });
    await user.click(toggleButton);

    // Active Variables section should show initVar and var1
    expect(screen.getByText("Active Variables")).toBeInTheDocument();
    expect(screen.getByText("initVar")).toBeInTheDocument();
    expect(screen.getByText("initVal")).toBeInTheDocument();
    
    // Verify var1 is present under active variables
    const activeVar1 = screen.getAllByText("var1");
    expect(activeVar1.length).toBeGreaterThan(0);

    // Expand second event
    const event2Button = screen.getByRole("button", {
      name: /Event 2 completed: Step 2 Click button/i,
    });
    await user.click(event2Button);

    // Second event environment changes should show added and changed
    const addedBadges = screen.getAllByText("added");
    expect(addedBadges.length).toBeGreaterThan(0);

    expect(screen.getByText("changed")).toBeInTheDocument();
    expect(screen.getByText("var2")).toBeInTheDocument();
    expect(screen.getByText("value2")).toBeInTheDocument();
    expect(screen.getAllByText("value1").length).toBeGreaterThan(1);
    expect(screen.getByText("newValue1")).toBeInTheDocument(); // new value of var1
  });
});

