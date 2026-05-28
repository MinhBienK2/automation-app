import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import type {
  RecordingSession,
  RecordingWorkflowDraft,
  ReviewedRecordingStep,
} from "../../../types/workflow";
import { workflowDetailScenario } from "../../../tests/mocks/workflowScenarios";
import { linearGraphFromSteps } from "../lib/workflowGraph";
import { RecordingReviewDialog } from "./RecordingReviewDialog";

describe("RecordingReviewDialog", () => {
  test("renders live session status safely and guards discard", async () => {
    const onStopRecording = vi.fn();
    const onDiscard = vi.fn();

    render(
      <RecordingReviewHarness
        session={recordingSession()}
        draft={null}
        onStopRecording={onStopRecording}
        onDiscard={onDiscard}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Recording Workflow" });
    expect(within(dialog).getByText("Browser Recorder")).toBeInTheDocument();
    expect(within(dialog).getByText("recording")).toBeInTheDocument();
    expect(within(dialog).getByText("3 events")).toBeInTheDocument();
    expect(within(dialog).getByText(/Started/)).toBeInTheDocument();
    expect(within(dialog).getByText("https://owned.example.test/form")).toBeInTheDocument();
    expect(within(dialog).getByText("Recorded identity")).toBeInTheDocument();
    expect(within(dialog).getByText("Persona")).toBeInTheDocument();
    expect(within(dialog).getByText("Humanize on")).toBeInTheDocument();
    expect(within(dialog).queryByText("bi_recording_profile")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("raw-seed")).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Stop Recording" }));
    expect(onStopRecording).toHaveBeenCalledTimes(1);

    await userEvent.click(within(dialog).getByRole("button", { name: "Discard" }));
    expect(onDiscard).not.toHaveBeenCalled();
    const confirm = await screen.findByRole("dialog", { name: "Discard Recording" });
    expect(within(confirm).getByText(/captured events cannot be recovered/i))
      .toBeInTheDocument();
    await userEvent.click(within(confirm).getByRole("button", { name: "Discard Recording" }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  test("renders draft summary filters and blocks save until required review fixes", async () => {
    const onSave = vi.fn();

    render(
      <RecordingReviewHarness
        session={recordingSession({ status: "stopped" })}
        draft={recordingDraft([
          inputStep({
            id: "redacted-input",
            text: "",
            warnings: [{
              code: "sensitive_input_redacted",
              message: "Sensitive input was redacted.",
              severity: "warning",
            }],
          }),
          uploadStep({ files: [] }),
          clickStep({ included: false }),
        ])}
        onSave={onSave}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Review Recording" });
    expect(within(dialog).getByText("3 total steps")).toBeInTheDocument();
    expect(within(dialog).getByText("2 included")).toBeInTheDocument();
    expect(within(dialog).getByText("2 needs attention")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "All 3" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Included 2" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Excluded 1" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Warnings 2" })).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Needs attention 2" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /Step 2 Upload File/i }));
    const detail = within(dialog).getByRole("region", {
      name: "Selected recording step",
    });
    expect(within(detail).getByText("Upload required")).toBeInTheDocument();
    expect(within(detail).getByLabelText("Upload file paths")).toHaveValue("");
    expect(within(dialog).getByText("2 blockers before save")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Save Workflow" })).toBeDisabled();

    await userEvent.type(
      within(detail).getByLabelText("Upload file paths"),
      "/tmp/automation-fixtures/avatar.png",
    );
    expect(within(dialog).getByText("1 blocker before save")).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", {
      name: /Step 1 Fill Field/i,
    }));
    await userEvent.type(
      within(dialog).getByRole("region", { name: "Selected recording step" })
        .querySelector("[aria-label='Text value']") as HTMLElement,
      "safe@example.test",
    );
    await userEvent.click(within(dialog).getByRole("button", { name: "Save Workflow" }));
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  test("shows replacement consequences and guards close with a draft", async () => {
    const onDiscard = vi.fn();

    render(
      <RecordingReviewHarness
        session={recordingSession({ status: "stopped", mode: "replace_current_graph" })}
        draft={{
          ...recordingDraft([navigateStep()]),
          mode: "replace_current_graph",
          workflow_id: "workflow-1",
        }}
        workflowName="Login flow"
        onDiscard={onDiscard}
      />,
    );

    const dialog = screen.getByRole("dialog", { name: "Review Recording" });
    expect(within(dialog).getByText("Replace Graph")).toBeInTheDocument();
    expect(within(dialog).getByText(/replaces only the current workflow graph/i))
      .toBeInTheDocument();
    expect(within(dialog).getByText(/does not create a new workflow/i))
      .toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close dialog" }));
    const confirm = await screen.findByRole("dialog", { name: "Discard Recording" });
    expect(onDiscard).not.toHaveBeenCalled();
    await userEvent.click(within(confirm).getByRole("button", { name: "Keep Reviewing" }));
    expect(screen.getByRole("dialog", { name: "Review Recording" })).toBeInTheDocument();
  });
});

function RecordingReviewHarness({
  session,
  draft,
  workflowName = "Recorded workflow",
  onStopRecording = vi.fn(),
  onDiscard = vi.fn(),
  onSave = vi.fn(),
}: {
  session: RecordingSession | null;
  draft: RecordingWorkflowDraft | null;
  workflowName?: string;
  onStopRecording?: () => void;
  onDiscard?: () => void;
  onSave?: () => void;
}) {
  const [currentDraft, setCurrentDraft] = useState(draft);
  const [name, setName] = useState(workflowName);

  return (
    <RecordingReviewDialog
      open
      session={session}
      draft={currentDraft}
      workflowName={name}
      busy={false}
      error=""
      onWorkflowNameChange={setName}
      onStopRecording={onStopRecording}
      onDiscard={onDiscard}
      onSave={onSave}
      onStepChange={(step) =>
        setCurrentDraft((current) =>
          current
            ? {
                ...current,
                steps: current.steps.map((candidate) =>
                  candidate.id === step.id ? step : candidate,
                ),
              }
            : current,
        )
      }
      onOpenChange={vi.fn()}
    />
  );
}

function recordingSession(
  input: Partial<Pick<RecordingSession, "status" | "mode">> = {},
): RecordingSession {
  return {
    id: "rec_1",
    workflow_id: input.mode === "replace_current_graph" ? "workflow-1" : null,
    mode: input.mode ?? "new_workflow",
    status: input.status ?? "recording",
    started_at: "2026-05-29T10:00:00.000Z",
    stopped_at: input.status === "stopped" ? "2026-05-29T10:01:00.000Z" : null,
    browser_identity: {
      identity_id: "bi_recording",
      display_name: "Recorded identity",
      profile_dir: "bi_recording_profile",
      profile_name: "bi_recording_profile",
      fingerprint_seed_hash: "raw-seed",
      persona_id: "persona",
      persona_label: "Persona",
      humanize: true,
      human_preset: "default",
      headless: false,
    },
    workflow_settings_snapshot: workflowDetailScenario([]).get_workflow_settings,
    page_url: "https://owned.example.test/form",
    event_count: 3,
    warnings: [],
  };
}

function recordingDraft(steps: ReviewedRecordingStep[]): RecordingWorkflowDraft {
  return {
    id: "draft-1",
    session_id: "rec_1",
    workflow_id: null,
    mode: "new_workflow",
    status: "draft",
    generated_at: "2026-05-29T10:01:00.000Z",
    workflow_settings_snapshot: workflowDetailScenario([]).get_workflow_settings,
    steps,
    graph: linearGraphFromSteps([]),
    validation_issues: [],
    warnings: [],
  };
}

function navigateStep(): ReviewedRecordingStep {
  return {
    id: "navigate",
    source_event_ids: ["event-navigation"],
    action: { type: "navigate", config: { url: "https://fixture.owned.test" } },
    label: "Navigate",
    included: true,
    locator_confidence: null,
    warnings: [],
  };
}

function inputStep(
  input: Partial<{
    id: string;
    text: string;
    warnings: ReviewedRecordingStep["warnings"];
  }> = {},
): ReviewedRecordingStep {
  return {
    id: input.id ?? "input",
    source_event_ids: ["event-input"],
    action: {
      type: "input_text",
      config: {
        target: { locators: [{ kind: "label", value: "Email" }] },
        text: input.text ?? "qa@example.test",
        clear_before_input: true,
      },
    },
    label: "Fill Field",
    included: true,
    locator_confidence: "high",
    warnings: input.warnings ?? [],
  };
}

function uploadStep(input: Partial<{ files: string[] }> = {}): ReviewedRecordingStep {
  return {
    id: "upload",
    source_event_ids: ["event-upload"],
    action: {
      type: "upload_file",
      config: {
        target: { locators: [{ kind: "label", value: "Avatar" }] },
        files: input.files ?? [],
        wait_until: "visible",
      },
    },
    label: "Upload File",
    included: true,
    locator_confidence: "high",
    warnings: [{
      code: "upload_requires_reviewed_file_path",
      message: "Native file chooser paths are not captured.",
      severity: "warning",
    }],
  };
}

function clickStep(input: Partial<{ included: boolean }> = {}): ReviewedRecordingStep {
  return {
    id: "click",
    source_event_ids: ["event-click"],
    action: {
      type: "click",
      config: { target: { locators: [{ kind: "text", value: "Continue" }] } },
    },
    label: "Click",
    included: input.included ?? true,
    locator_confidence: "high",
    warnings: [],
  };
}
