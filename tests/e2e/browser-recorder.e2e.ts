import type {
  ActionConfig,
  GraphNode,
  ReviewedRecordingStep,
  WorkflowGraph,
} from "../../src/types/workflow";
import { test, expect } from "./support/electronFixture";
import { runState } from "./support/workflows";

test.describe("desktop browser recorder", () => {
  test("records a deterministic fixture, saves it, and replays the generated graph", async ({
    appWindow,
    fixtureServer,
  }, testInfo) => {
    testInfo.annotations.push(
      {
        type: "fixture route",
        description: "/recorder-replay",
      },
      {
        type: "desktop depth",
        description:
          "Proves recorder session -> draft review -> workflow save -> normal run manager replay.",
      },
    );

    const recordUrl = `${fixtureServer.baseUrl}/recorder-replay?record=1`;
    const replayUrl = `${fixtureServer.baseUrl}/recorder-replay`;
    const saved = await appWindow.evaluate(
      async ({ recordUrl, replayUrl }) => {
        const api = window.workflowApi;
        if (!api) throw new Error("Workflow API bridge is unavailable");

        const session = await api.startRecordingSession({
          mode: "new_workflow",
          workflow_name: "Recorder replay E2E",
          initial_url: recordUrl,
          browser_launch_overrides: { headless: true },
        });
        const events = await waitForRecordingEvents(session.id, 5);
        await api.stopRecordingSession(session.id);
        const draft = await api.generateRecordingDraft(session.id, {
          include_event_ids: null,
          add_terminal_success: false,
        });
        const reviewedSteps = draft.steps.map((step) =>
          rewriteRecordedNavigation(step, replayUrl),
        );
        const saved = await api.saveRecordingDraft(draft.id, {
          workflow_name: "Recorder replay E2E",
          save_mode: "create_new",
          reviewed_steps: reviewedSteps,
          add_terminal_success: false,
        });
        const graph = appendSummaryExtraction(
          await api.getWorkflowGraph(saved.workflow.id),
        );
        await api.saveWorkflowGraph(saved.workflow.id, graph);
        const settings = await api.getWorkflowSettings(saved.workflow.id);
        await api.saveWorkflowSettings(saved.workflow.id, {
          ...settings,
          run_policy: {
            ...settings.run_policy,
            browser_retention: "close",
          },
          browser_launch: {
            ...settings.browser_launch,
            headless: true,
          },
        });
        await api.runWorkflow(saved.workflow.id);
        return {
          workflowId: saved.workflow.id,
          eventKinds: events.map((event) => event.kind),
          actionTypes: draft.steps.map((step) => step.action.type),
        };

        async function waitForRecordingEvents(sessionId: string, minimum: number) {
          for (let attempt = 0; attempt < 100; attempt += 1) {
            const events = await api.listRecordingEvents(sessionId);
            if (events.length >= minimum) return events;
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
          return api.listRecordingEvents(sessionId);
        }

        function rewriteRecordedNavigation(
          step: ReviewedRecordingStep,
          url: string,
        ): ReviewedRecordingStep {
          if (step.action.type !== "navigate") return step;
          return {
            ...step,
            action: {
              type: "navigate",
              config: { ...step.action.config, url },
            },
          };
        }

        function appendSummaryExtraction(graph: WorkflowGraph): WorkflowGraph {
          const lastNode = graph.nodes[graph.nodes.length - 1];
          if (!lastNode) throw new Error("Generated graph has no nodes");
          const extractNode: GraphNode = {
            id: "recorded-e2e-extract-summary",
            node_type: "action",
            label: "Extract Replay Summary",
            position: {
              x: lastNode.position.x + 260,
              y: lastNode.position.y,
            },
            config: {
              type: "extract_text",
              config: {
                target: { locators: [{ kind: "test_id", value: "summary" }] },
                output_name: "recorder_summary",
              },
            } satisfies ActionConfig,
            ports: [
              { id: "in", label: "In", direction: "input" },
              { id: "out", label: "Out", direction: "output" },
            ],
          };
          return {
            ...graph,
            nodes: [...graph.nodes, extractNode],
            edges: [
              ...graph.edges,
              {
                id: `edge-${lastNode.id}-${extractNode.id}`,
                source_node_id: lastNode.id,
                source_port: "out",
                target_node_id: extractNode.id,
                target_port: "in",
              },
            ],
          };
        }
      },
      { recordUrl, replayUrl },
    );

    expect(saved.eventKinds).toEqual(
      expect.arrayContaining(["navigation", "input", "clipboard", "select", "checkbox", "click"]),
    );
    expect(saved.actionTypes).toEqual(
      expect.arrayContaining([
        "navigate",
        "input_text",
        "set_clipboard",
        "paste_clipboard",
        "select_option",
        "check",
        "click",
      ]),
    );

    await expect
      .poll(() => runState(appWindow), { timeout: 45_000 })
      .toMatchObject({ status: "success" });
    const state = await runState(appWindow);
    expect(state.outputs.recorder_summary).toContain("email=qa-recorder@example.test");
    expect(state.outputs.recorder_summary).toContain("paste=clipboard-recorded");
    expect(state.outputs.recorder_summary).toContain("plan=Team");
    expect(state.outputs.recorder_summary).toContain("agree=true");
    expect(state.outputs.recorder_summary).toContain("status=submitted");
  });

  test("rejects empty recordings before saving a draft", async ({ appWindow }) => {
    const error = await appWindow.evaluate(async () => {
      const api = window.workflowApi;
      if (!api) throw new Error("Workflow API bridge is unavailable");
      const session = await api.startRecordingSession({
        mode: "new_workflow",
        workflow_name: "Empty recorder E2E",
        browser_launch_overrides: { headless: true },
      });
      await api.stopRecordingSession(session.id);
      try {
        await api.generateRecordingDraft(session.id, {
          include_event_ids: null,
          add_terminal_success: false,
        });
        return null;
      } catch (error) {
        return error && typeof error === "object" && "message" in error
          ? {
              message: String((error as { message: unknown }).message),
              field: "field" in error
                ? String((error as { field: unknown }).field)
                : null,
            }
          : { message: String(error), field: null };
      }
    });

    expect(error).toEqual({
      message: "No meaningful actions recorded",
      field: "events",
    });
  });
});
