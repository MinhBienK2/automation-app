// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ReviewedRecordingStep } from "../../../src/types/workflow";
import { compileWorkflowGraph } from "../graph/compiler";
import { validateWorkflowGraph } from "../graph/validateGraph";
import { generateRecordingGraph } from "./graphGenerator";

describe("generateRecordingGraph", () => {
  test("creates a valid left-to-right workflow graph with terminal success", () => {
    const graph = generateRecordingGraph(
      [
        reviewedStep("step-1", "Visit form", {
          type: "navigate",
          config: { url: "https://fixture.owned.test/form" },
        }),
        reviewedStep("step-2", "Fill Email", {
          type: "input_text",
          config: {
            target: { locators: [{ kind: "test_id", value: "email" }] },
            text: "qa@example.test",
            clear_before_input: true,
          },
        }),
      ],
      { addTerminalSuccess: true },
    );

    expect(graph).toMatchObject({
      version: 2,
      nodes: [
        { id: "start", node_type: "start", label: "Start", position: { x: 0, y: 0 } },
        { id: "recorded-step-1", node_type: "action", label: "Visit form", position: { x: 260, y: 0 } },
        { id: "recorded-step-2", node_type: "action", label: "Fill Email", position: { x: 520, y: 0 } },
        { id: "recorded-end-success", node_type: "end_success", label: "End Success", position: { x: 780, y: 0 } },
      ],
      edges: [
        {
          id: "edge-start-recorded-step-1",
          source_node_id: "start",
          target_node_id: "recorded-step-1",
        },
        {
          id: "edge-recorded-step-1-recorded-step-2",
          source_node_id: "recorded-step-1",
          target_node_id: "recorded-step-2",
        },
        {
          id: "edge-recorded-step-2-recorded-end-success",
          source_node_id: "recorded-step-2",
          target_node_id: "recorded-end-success",
        },
      ],
    });
    expect(validateWorkflowGraph(graph).filter((issue) => issue.level === "error")).toEqual([]);
    expect(compileWorkflowGraph(graph).steps.map((step) => step.node_id)).toEqual([
      "recorded-step-1",
      "recorded-step-2",
    ]);
  });

  test("preserves recorded operator pacing as edge delays between actions", () => {
    const graph = generateRecordingGraph(
      [
        reviewedStep("step-1", "Visit form", {
          type: "navigate",
          config: { url: "https://fixture.owned.test/form" },
        }, {
          first_event_at: "2026-05-27T10:00:00.000Z",
          last_event_at: "2026-05-27T10:00:00.000Z",
        }),
        reviewedStep("step-2", "Fill Email", {
          type: "input_text",
          config: {
            target: { locators: [{ kind: "test_id", value: "email" }] },
            text: "qa@example.test",
            clear_before_input: true,
          },
        }, {
          first_event_at: "2026-05-27T10:00:02.200Z",
          last_event_at: "2026-05-27T10:00:02.600Z",
        }),
        reviewedStep("step-3", "Submit", {
          type: "click",
          config: { target: { locators: [{ kind: "role", value: "button", name: "Submit" }] } },
        }, {
          first_event_at: "2026-05-27T10:00:04.100Z",
          last_event_at: "2026-05-27T10:00:04.100Z",
        }),
      ],
      { addTerminalSuccess: true },
    );

    expect(graph.edges.find((edge) => edge.id === "edge-start-recorded-step-1"))
      .not.toHaveProperty("delay");
    expect(graph.edges.find((edge) => edge.id === "edge-recorded-step-1-recorded-step-2"))
      .toMatchObject({ delay: { type: "fixed", duration_ms: 2200 } });
    expect(graph.edges.find((edge) => edge.id === "edge-recorded-step-2-recorded-step-3"))
      .toMatchObject({ delay: { type: "fixed", duration_ms: 1500 } });
    expect(graph.edges.find((edge) => edge.id === "edge-recorded-step-3-recorded-end-success"))
      .not.toHaveProperty("delay");
    expect(compileWorkflowGraph(graph).steps.map((step) => step.config.type)).toEqual([
      "navigate",
      "wait",
      "input_text",
      "wait",
      "click",
    ]);
  });

  test("wraps long recorded workflows into compact rows instead of one long line", () => {
    const graph = generateRecordingGraph(
      Array.from({ length: 18 }, (_, index) =>
        reviewedStep(`step-${index + 1}`, `Recorded step ${index + 1}`, {
          type: "wait",
          config: { condition: "duration", duration_ms: 10 },
        }),
      ),
      { addTerminalSuccess: true },
    );

    const positions = new Map(graph.nodes.map((node) => [node.id, node.position]));

    expect(positions.get("recorded-step-1")).toEqual({ x: 260, y: 0 });
    expect(positions.get("recorded-step-8")).toEqual({ x: 2080, y: 0 });
    expect(positions.get("recorded-step-9")).toEqual({ x: 2080, y: 180 });
    expect(positions.get("recorded-step-16")).toEqual({ x: 260, y: 180 });
    expect(positions.get("recorded-step-17")).toEqual({ x: 260, y: 360 });
    expect(positions.get("recorded-end-success")?.x).toBeLessThanOrEqual(2080);
  });

  test("excludes removed review steps before linking the graph", () => {
    const graph = generateRecordingGraph(
      [
        reviewedStep("step-1", "Visit", {
          type: "navigate",
          config: { url: "https://fixture.owned.test" },
        }),
        {
          ...reviewedStep("step-2", "Removed click", {
            type: "click",
            config: { target: { locators: [{ kind: "css", value: "button" }] } },
          }),
          included: false,
        },
      ],
      { addTerminalSuccess: false },
    );

    expect(graph.nodes.map((node) => node.id)).toEqual(["start", "recorded-step-1"]);
    expect(graph.edges).toEqual([
      expect.objectContaining({
        source_node_id: "start",
        target_node_id: "recorded-step-1",
      }),
    ]);
  });
});

function reviewedStep(
  id: string,
  label: string,
  action: ReviewedRecordingStep["action"],
  timing?: ReviewedRecordingStep["timing"],
): ReviewedRecordingStep {
  return {
    id,
    source_event_ids: [id.replace("step", "event")],
    action,
    label,
    included: true,
    locator_confidence: null,
    warnings: [],
    timing,
  };
}
