import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  workflowBridgeMock,
  workflowCommandCallMock,
  mockWorkflowBridgeCommands,
  resetWorkflowBridge,
} from "./tests/mocks/electron";
import { workflow } from "./tests/mocks/workflowFixtures";
import {
  emptyOperationsOverview,
  idleRunState,
  listWorkflowScenario,
  workflowDetailScenario,
} from "./tests/mocks/workflowScenarios";
import { renderApp } from "./tests/utils/renderApp";

describe("App settings and graph autosave", () => {
  beforeEach(() => {
    resetWorkflowBridge();
    window.localStorage.clear();
    vi.spyOn(Date, "now").mockReturnValue(42);
  });

  async function confirmLaunchRun(scope: HTMLElement = document.body) {
    await userEvent.click(within(scope).getByRole("button", { name: "Launch Run" }));
    const dialog = await screen.findByRole("dialog", { name: "Launch Run" });
    await userEvent.click(within(dialog).getByRole("button", { name: "Launch Run" }));
  }

  async function openWorkflows() {
    await userEvent.click(await screen.findByRole("button", { name: "Workflows" }));
  }

  test("opens settings from the sidebar and persists the autosave preference", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    const { unmount } = renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    expect(await screen.findByRole("heading", { name: "Settings" })).toBeInTheDocument();
    const autosaveToggle = screen.getByRole("switch", {
      name: "Autosave graph changes",
    });
    expect(autosaveToggle).toHaveAttribute("aria-checked", "true");

    await userEvent.click(autosaveToggle);
    expect(autosaveToggle).toHaveAttribute("aria-checked", "false");

    unmount();
    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));
    expect(
      screen.getByRole("switch", { name: "Autosave graph changes" }),
    ).toHaveAttribute("aria-checked", "false");
  });

  test("lands on Overview with operational panels and refreshes the durable aggregate", async () => {
    let overviewCalls = 0;
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      get_operations_overview: () => {
        overviewCalls += 1;
        return {
          ...emptyOperationsOverview(),
          generated_at: `2026-05-27T00:00:0${overviewCalls}.000Z`,
          metrics: {
            active_runs: 1,
            succeeded_today: 2,
            attention_today: 3,
            upcoming_schedules: 4,
          },
          live_runs: {
            items: [
              {
                run_id: "run-1",
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                source: "manual",
                status: "running",
                current_step_id: "visit",
                current_step_number: 2,
                started_at: "2026-05-27T00:00:00.000Z",
                identity_display_name: "Login identity",
                navigation_target: { type: "run", run_id: "run-1" },
              },
            ],
            total: 1,
            has_more: false,
          },
          attention: {
            items: [
              {
                id: "attention-1",
                source_kind: "launch_blocked",
                severity: "failure",
                occurred_at: "2026-05-27T00:00:00.000Z",
                title: "Launch blocked",
                summary: "Graph needs a start node",
                workflow: { id: workflow.id, name: workflow.name },
                navigation_target: { type: "workflow", workflow_id: workflow.id },
              },
            ],
            total: 1,
            has_more: false,
          },
          activity: [
            {
              bucket_start_utc: "2026-05-27T00:00:00.000Z",
              bucket_end_utc: "2026-05-27T01:00:00.000Z",
              succeeded: 2,
              failed: 1,
              blocked: 1,
              schedule_attention: 1,
            },
          ],
          recent_evidence: {
            items: [
              {
                evidence_id: "ev-1",
                artifact_kind: "screenshot",
                relative_path_or_label: "runs/run-1/screenshots/001.png",
                created_at: "2026-05-27T00:01:00.000Z",
                run_id: "run-1",
                workflow: { id: workflow.id, name: workflow.name },
                node_id: "visit",
                navigation_targets: {
                  run: { type: "run", run_id: "run-1" },
                  workflow: { type: "workflow", workflow_id: workflow.id },
                },
              },
            ],
            total: 1,
            has_more: false,
          },
          upcoming_schedules: {
            items: [
              {
                schedule_id: "schedule-1",
                workflow_id: workflow.id,
                workflow_name: workflow.name,
                schedule_name: "Daily audit",
                next_run_at: "2026-05-27T05:00:00.000Z",
                last_status: "started",
                last_reason: null,
                navigation_target: { type: "schedule", schedule_id: "schedule-1" },
              },
            ],
            total: 1,
            has_more: false,
          },
        };
      },
    });

    renderApp();

    expect(await screen.findByRole("heading", { name: "Overview" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Workflows" })).toBeInTheDocument();
    expect(screen.getByText("Active Runs")).toBeInTheDocument();
    expect(screen.getByText("Succeeded Today")).toBeInTheDocument();
    expect(screen.getByText("Attention Needed")).toBeInTheDocument();
    expect(screen.getAllByText("Upcoming Schedules").length).toBeGreaterThan(0);
    expect(screen.getByRole("region", { name: "Live Operations" })).toHaveTextContent("Login identity");
    expect(screen.getByRole("region", { name: "Attention Queue" })).toHaveTextContent("Graph needs a start node");
    expect(screen.getByRole("region", { name: "Execution Activity" })).toHaveTextContent("2 success");
    expect(screen.getByRole("region", { name: "Recent Evidence" })).toHaveTextContent("runs/run-1/screenshots/001.png");
    expect(screen.getByRole("region", { name: "Upcoming Schedules" })).toHaveTextContent("Daily audit");

    await userEvent.click(screen.getByRole("button", { name: "Refresh Overview" }));

    await waitFor(() => {
      expect(overviewCalls).toBeGreaterThan(1);
    });
  });

  test("opens Evidence Explorer from sidebar and focuses Overview evidence selections", async () => {
    const evidencePage = {
      generated_at: "2026-05-27T00:00:00.000Z",
      items: [
        {
          evidence_id: "ev-shot",
          kind: "screenshot",
          label: "001-visit.png",
          created_at: "2026-05-27T09:01:00.000Z",
          run: {
            id: "run-1",
            status: "success",
            source: "manual",
            started_at: "2026-05-27T09:00:00.000Z",
            finished_at: "2026-05-27T09:02:00.000Z",
          },
          workflow: { id: workflow.id, name: workflow.name },
          identity: { id: "bi_123", display_name: "QA identity" },
          node_id: "visit",
          step_number: 1,
          relative_path: "runs/run-1/screenshots/001-visit.png",
          file_state: "unchecked",
          navigation_targets: { run: true, workflow: true },
        },
      ],
      next_cursor: null,
      has_more: false,
      warnings: {
        skipped_artifacts: 1,
        skipped_reports: 0,
        skipped_traces: 0,
        skipped_manifests: 0,
      },
    };
    const listEvidenceItems = vi.fn((_request: unknown) => evidencePage);
    const getEvidenceDetail = vi.fn((_evidenceId: string) => ({
      item: evidencePage.items[0],
      payload: {
        kind: "screenshot",
        relative_path: "runs/run-1/screenshots/001-visit.png",
        file_state: "available",
        artifact_kind: "screenshot",
      },
    }));
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_evidence_items: ({ request }: { request: unknown }) => listEvidenceItems(request),
      get_evidence_detail: ({ evidenceId }: { evidenceId: string }) => getEvidenceDetail(evidenceId),
      get_evidence_screenshot_preview: () => ({
        evidence_id: "ev-shot",
        mime_type: "image/png",
        base64_data: "cG5nLWRhdGE=",
        file_state: "available",
      }),
      reveal_evidence_artifact: null,
      export_evidence_bundle: {
        bundle_dir: "/tmp/evidence-bundle-20260527",
        exported_count: 1,
        omitted_file_count: 0,
      },
      get_operations_overview: () => ({
        ...emptyOperationsOverview(),
        recent_evidence: {
          items: [
            {
              evidence_id: "ev-shot",
              artifact_kind: "screenshot",
              relative_path_or_label: "runs/run-1/screenshots/001-visit.png",
              created_at: "2026-05-27T09:01:00.000Z",
              run_id: "run-1",
              workflow: { id: workflow.id, name: workflow.name },
              node_id: "visit",
              navigation_targets: {
                run: { type: "run", run_id: "run-1" },
                workflow: { type: "workflow", workflow_id: workflow.id },
                evidence: { type: "evidence", evidence_id: "ev-shot" },
              },
            },
          ],
          total: 1,
          has_more: false,
        },
      }),
    });

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Evidence" }));

    expect(await screen.findByRole("heading", { name: "Evidence Explorer" })).toBeInTheDocument();
    expect(screen.getByRole("searchbox", { name: "Search evidence" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Export Selection" })).toBeDisabled();
    expect(screen.getByRole("region", { name: "Evidence results" })).toHaveTextContent("001-visit.png");
    expect(screen.getByRole("region", { name: "Evidence detail" })).toHaveTextContent("runs/run-1/screenshots/001-visit.png");
    expect(screen.getByText("1 malformed evidence item skipped.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Overview" }));
    await userEvent.click(await screen.findByRole("button", { name: /001-visit\.png/ }));

    expect(await screen.findByRole("heading", { name: "Evidence Explorer" })).toBeInTheDocument();
    await waitFor(() => {
      expect(listEvidenceItems).toHaveBeenLastCalledWith(
        expect.objectContaining({ focus_evidence_id: "ev-shot" }),
      );
    });
    expect(getEvidenceDetail).toHaveBeenCalledWith("ev-shot");
  });

  test("shows graph keyboard and mouse guidance in settings", async () => {
    mockWorkflowBridgeCommands(listWorkflowScenario([workflow]));

    renderApp();

    await userEvent.click(await screen.findByRole("button", { name: "Settings" }));

    const shortcuts = await screen.findByRole("region", { name: "Graph shortcuts" });
    expect(within(shortcuts).getByText("Drag empty canvas")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Box select nodes and links")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Hold Space + drag")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Pan the graph view")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Ctrl/Cmd + Enter")).toBeInTheDocument();
    expect(within(shortcuts).getByText("Launch Run")).toBeInTheDocument();
  });

  test("autosaves graph changes by default", async () => {
    const saveGraph = vi.fn().mockResolvedValue(undefined);
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: "workflow-1",
          graph: expect.objectContaining({
            nodes: expect.arrayContaining([
              expect.objectContaining({
                id: "node-action-42",
                node_type: "action",
                config: expect.objectContaining({ type: "navigate" }),
              }),
            ]),
          }),
        }),
      );
    });
    expect((await screen.findAllByText("Saved")).length).toBeGreaterThan(0);
  });

  test("keeps the draft visible when autosave fails and does not run the stale saved graph", async () => {
    const saveGraph = vi.fn().mockRejectedValue(new Error("disk is full"));
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: saveGraph,
      run_workflow: {
        status: "running",
        mode: "run_workflow",
        target_step_id: null,
        current_step_id: null,
        current_step_number: null,
        completed_step_ids: [],
        outputs: {},
        error: null,
      },
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    await userEvent.click(within(editor).getByRole("button", { name: "Add Action" }));
    await userEvent.click(
      (await screen.findByRole("dialog", { name: "Choose an action type" }))
        .querySelector('[data-value="navigate"]') as HTMLElement,
    );

    expect(
      await within(editor).findByRole("button", { name: "Graph canvas node node-action-42" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Autosave failed")).toBeInTheDocument();

    const header = screen.getByRole("region", { name: "Workflow detail header" });
    await confirmLaunchRun(header);

    await waitFor(() => {
      expect(saveGraph).toHaveBeenCalled();
    });
    expect(workflowCommandCallMock).not.toHaveBeenCalledWith("run_workflow", {
      workflowId: "workflow-1",
    });
  });

  test("renders primary graph actions only in the workflow header", async () => {
    mockWorkflowBridgeCommands({
      ...workflowDetailScenario([]),
      save_workflow_graph: undefined,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "View Details" }));
    const header = await screen.findByRole("region", { name: "Workflow detail header" });
    const editor = await screen.findByRole("region", { name: "Visual Graph" });

    expect(within(header).getByRole("button", { name: "Validate" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Launch Run" })).toBeInTheDocument();
    expect(within(header).getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Validate Graph" }))
      .not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Run" })).not.toBeInTheDocument();
    expect(within(editor).queryByRole("button", { name: "Save Graph" }))
      .not.toBeInTheDocument();
  });

  test("polls run state for a workflow started from the list", async () => {
    let runStateCalls = 0;
    let runSnapshotCalls = 0;
    const runningSnapshot = {
      run_id: "run-1",
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      source: "manual" as const,
      started_at: "2026-05-17T06:00:00.000Z",
      state: {
        ...idleRunState,
        status: "running" as const,
        mode: "run_workflow" as const,
      },
    };
    const successSnapshot = {
      ...runningSnapshot,
      state: {
        ...runningSnapshot.state,
        status: "success" as const,
      },
    };
    mockWorkflowBridgeCommands({
      ...listWorkflowScenario([workflow]),
      list_run_states: () => {
        runSnapshotCalls += 1;
        if (runSnapshotCalls === 1) return [];
        return runSnapshotCalls === 2 ? [runningSnapshot] : [successSnapshot];
      },
      get_run_state: () => {
        runStateCalls += 1;
        return idleRunState;
      },
      run_workflow: runningSnapshot,
    });

    renderApp();

    await openWorkflows();
    await userEvent.click(await screen.findByRole("button", { name: "Run Login flow" }));

    await waitFor(() => {
      expect(workflowBridgeMock.runWorkflow).toHaveBeenCalledWith("workflow-1");
    });
    expect(await screen.findByText("Running")).toBeInTheDocument();

    expect(await screen.findByText("Run succeeded: Login flow")).toBeInTheDocument();
    expect(runSnapshotCalls).toBeGreaterThan(1);
    expect(runStateCalls).toBeGreaterThanOrEqual(1);
  });
});
