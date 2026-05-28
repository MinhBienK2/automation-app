import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import type {
  OperationalRunDetail,
  WorkflowRunSnapshot,
} from "../../../types/workflow";
import { initialRunState } from "../../../lib/workflowUi";
import { RunCenterPage } from "./RunCenterPage";

describe("RunCenterPage", () => {
  test("summarizes and sorts session runs newest first", () => {
    renderRunCenter({
      runSnapshots: [
        runSnapshot({
          run_id: "run-old",
          workflow_name: "Login flow",
          started_at: "2026-05-29T10:00:00.000Z",
          status: "success",
        }),
        runSnapshot({
          run_id: "run-new",
          workflow_name: "Support flow",
          source: "schedule",
          started_at: "2026-05-29T10:05:00.000Z",
          status: "running",
          current_step_number: 3,
        }),
      ],
    });

    const runCenter = screen.getByRole("region", { name: "Runs" });
    expect(within(runCenter).getByText("1 active")).toBeInTheDocument();
    expect(within(runCenter).getByText("2 session runs")).toBeInTheDocument();
    const rows = within(runCenter).getAllByRole("row");
    expect(rows[1]).toHaveTextContent("Support flow");
    expect(rows[1]).toHaveTextContent("Schedule");
    expect(rows[1]).toHaveTextContent("Running step 3");
    expect(rows[2]).toHaveTextContent("Login flow");
    expect(rows[2]).toHaveTextContent("Manual");
    expect(rows[2]).toHaveTextContent("Run succeeded");
  });

  test("stops only the selected running session", async () => {
    const onStopRun = vi.fn();
    renderRunCenter({
      onStopRun,
      runSnapshots: [
        runSnapshot({
          run_id: "run-1",
          workflow_name: "Login flow",
          status: "success",
        }),
        runSnapshot({
          run_id: "run-2",
          workflow_name: "Support flow",
          status: "running",
        }),
      ],
    });

    await userEvent.click(screen.getByRole("button", {
      name: "Stop Support flow run",
    }));

    expect(onStopRun).toHaveBeenCalledWith("run-2");
    expect(screen.queryByRole("button", { name: "Stop Login flow run" }))
      .not.toBeInTheDocument();
  });

  test("keeps table issue copy bounded to a short sanitized summary", () => {
    renderRunCenter({
      runSnapshots: [
        runSnapshot({
          status: "failed",
          error: {
            step_id: "step-1",
            step_number: 1,
            step_name: "Navigate",
            action_type: "navigate",
            reason: [
              "page.goto: net::ERR_NAME_NOT_RESOLVED at https://owned.example.test/path/abcdefghijklmnopqrstuvwxyz0123456789",
              "Call log:",
              "  - raw browser trace output",
            ].join("\n"),
          },
        }),
      ],
    });

    const runCenter = screen.getByRole("region", { name: "Runs" });
    expect(within(runCenter).getByText(/^page\.goto: net::ERR_NAME_NOT_RESOLVED/))
      .toBeInTheDocument();
    expect(within(runCenter).queryByText(/raw browser trace output/))
      .not.toBeInTheDocument();
  });

  test("renders bounded persisted run detail with durable navigation actions", async () => {
    const onOpenEvidence = vi.fn();
    const onOpenWorkflow = vi.fn();
    const onOpenIdentity = vi.fn();
    const focusedRunDetail = operationalRunDetail();
    renderRunCenter({
      runSnapshots: [
        runSnapshot({
          run_id: focusedRunDetail.run_id,
          workflow_id: focusedRunDetail.workflow.id,
          workflow_name: focusedRunDetail.workflow.name,
          source: "schedule",
          status: "failed",
        }),
      ],
      focusedRunDetail,
      onOpenEvidence,
      onOpenWorkflow,
      onOpenIdentity,
    });

    const detail = screen.getByRole("article", { name: "Selected run detail" });
    expect(within(detail).getByText("Persisted Run")).toBeInTheDocument();
    expect(within(detail).getByText("Support flow")).toBeInTheDocument();
    expect(within(detail).getByText("Schedule")).toBeInTheDocument();
    expect(within(detail).getByText("Support identity")).toBeInTheDocument();
    expect(within(detail).getAllByText("Element not found")).toHaveLength(2);
    expect(within(detail).getByText("click")).toBeInTheDocument();
    expect(within(detail).queryByText(/raw browser trace/)).not.toBeInTheDocument();

    await userEvent.click(within(detail).getByRole("button", { name: "Open Evidence" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Workflow" }));
    await userEvent.click(within(detail).getByRole("button", { name: "Open Identity" }));

    expect(onOpenEvidence).toHaveBeenCalledWith("run-focused");
    expect(onOpenWorkflow).toHaveBeenCalledWith("workflow-2");
    expect(onOpenIdentity).toHaveBeenCalledWith({
      type: "managed",
      workflow_id: "workflow-2",
      identity_id: "identity-2",
    });
  });

  test("shows an explicit missing run target state while keeping the table visible", () => {
    renderRunCenter({
      missingRunId: "run-missing",
      runSnapshots: [
        runSnapshot({
          run_id: "run-visible",
          workflow_name: "Visible flow",
          status: "success",
        }),
      ],
    });

    const missing = screen.getByRole("article", { name: "Run target unavailable" });
    expect(within(missing).getByText("Run target unavailable")).toBeInTheDocument();
    expect(within(missing).getByText("run-missing")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /Visible flow/ })).toBeInTheDocument();
  });

  test("keeps the session table visible when a refresh error is present", () => {
    renderRunCenter({
      error: "Could not refresh run states",
      runSnapshots: [
        runSnapshot({
          run_id: "run-visible",
          workflow_name: "Visible flow",
          status: "running",
        }),
      ],
    });

    expect(screen.getByRole("alert")).toHaveTextContent("Could not refresh run states");
    expect(screen.getByRole("row", { name: /Visible flow/ })).toBeInTheDocument();
  });
});

function renderRunCenter({
  runSnapshots = [],
  focusedRunDetail = null,
  missingRunId = null,
  error = "",
  onStopRun = vi.fn(),
  onOpenEvidence,
  onOpenWorkflow,
  onOpenIdentity,
}: {
  runSnapshots?: WorkflowRunSnapshot[];
  focusedRunDetail?: OperationalRunDetail | null;
  missingRunId?: string | null;
  error?: string;
  onStopRun?: (runId: string) => void;
  onOpenEvidence?: (runId: string) => void;
  onOpenWorkflow?: (workflowId: string) => void;
  onOpenIdentity?: Parameters<typeof RunCenterPage>[0]["onOpenIdentity"];
} = {}) {
  return render(
    <RunCenterPage
      runSnapshots={runSnapshots}
      focusedRunDetail={focusedRunDetail}
      missingRunId={missingRunId}
      staleTarget={null}
      error={error}
      onStopRun={onStopRun}
      onOpenEvidence={onOpenEvidence}
      onOpenWorkflow={onOpenWorkflow}
      onOpenIdentity={onOpenIdentity}
    />,
  );
}

function runSnapshot({
  run_id = "run-1",
  workflow_id = "workflow-1",
  workflow_name = "Login flow",
  source = "manual",
  started_at = "2026-05-29T10:00:00.000Z",
  status = "idle",
  current_step_number = null,
  error = null,
}: Partial<WorkflowRunSnapshot> & {
  status?: WorkflowRunSnapshot["state"]["status"];
} = {}): WorkflowRunSnapshot {
  const state = {
    ...initialRunState,
    status,
    current_step_number,
    error,
  };
  return {
    ...state,
    run_id,
    workflow_id,
    workflow_name,
    source,
    started_at,
    state,
  };
}

function operationalRunDetail(): OperationalRunDetail {
  return {
    run_id: "run-focused",
    workflow: { id: "workflow-2", name: "Support flow" },
    source: "schedule",
    identity: { id: "identity-2", display_name: "Support identity" },
    status: "failed",
    started_at: "2026-05-29T10:05:00.000Z",
    finished_at: "2026-05-29T10:06:00.000Z",
    sanitized_error_summary: "Element not found",
    step_summaries: [
      {
        node_id: "step-1",
        step_number: 1,
        action_type: "navigate",
        status: "success",
      },
      {
        node_id: "step-2",
        step_number: 2,
        action_type: "click",
        status: "failed",
        sanitized_error_summary: "Element not found",
      },
    ],
    step_summaries_has_more: false,
    evidence_metadata: [],
    evidence_metadata_has_more: false,
  };
}
