import type { DragEndEvent } from "@dnd-kit/core";
import type {
  ActionConfig,
  ActionType,
  RunState,
  WorkflowDetail,
  WorkflowStep,
} from "../../../types/workflow";
import { PageHeader } from "../../../components/layout/PageHeader";
import { Button } from "../../../components/ui/button";
import { RunStatusBar } from "../components/RunStatusBar";
import { StepForm } from "../components/StepForm";
import { StepList } from "../components/StepList";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  selectedStep: WorkflowStep | null;
  selectedStepId: string | null;
  isRunning: boolean;
  appError: string;
  runState: RunState;
  onBack: () => void;
  onSelectStep: (stepId: string) => void;
  onAddStep: (actionType: ActionType) => void;
  onDeleteStep: (stepId: string) => void;
  onDuplicateStep: (
    step: WorkflowStep,
    name: string,
    config: ActionConfig,
  ) => Promise<void>;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
  onRunWorkflow: () => void;
  onTestStep: () => void;
  onTestAllSteps: () => void;
  onStopRun: () => void;
  onDragEnd: (event: DragEndEvent) => void;
};

export function WorkflowDetailPage({
  detail,
  selectedStep,
  selectedStepId,
  isRunning,
  appError,
  runState,
  onBack,
  onSelectStep,
  onAddStep,
  onDeleteStep,
  onDuplicateStep,
  onSaveStep,
  onRunWorkflow,
  onTestStep,
  onTestAllSteps,
  onStopRun,
  onDragEnd,
}: WorkflowDetailPageProps) {
  const stepCountLabel = `${detail.steps.length} ${
    detail.steps.length === 1 ? "step" : "steps"
  }`;

  return (
    <section className="app-screen workflow-detail-screen">
      <PageHeader
        ariaLabel="Workflow detail header"
        backLabel="Back to Workflows"
        eyebrow="Workflow Detail"
        meta={[stepCountLabel, `Updated ${detail.workflow.updated_at}`]}
        status={<RunStatusBar state={runState} error={appError} />}
        title={detail.workflow.name}
        onBack={onBack}
        actions={
          <div className={isRunning ? "run-actions run-actions-with-stop" : "run-actions"}>
            <Button
              shape="pill"
              type="button"
              onClick={onRunWorkflow}
              disabled={isRunning}
            >
              Run Workflow
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={() => onTestStep()}
              title="Runs from step 1 through the selected step."
              disabled={isRunning || !selectedStep}
            >
              Test to Here
            </Button>
            <Button
              variant="secondary"
              type="button"
              onClick={onTestAllSteps}
              title="Runs every step in this workflow."
              disabled={isRunning || detail.steps.length === 0}
            >
              Test All
            </Button>
            {isRunning ? (
              <Button variant="destructive" type="button" onClick={onStopRun}>
                Stop
              </Button>
            ) : null}
          </div>
        }
      />

      <div className="builder-grid">
        <StepList
          steps={detail.steps}
          selectedStepId={selectedStepId}
          onSelectStep={onSelectStep}
          onAddStep={onAddStep}
          onDragEnd={onDragEnd}
        />

        <section className="step-detail-panel panel">
          {selectedStep ? (
            <StepForm
              key={selectedStep.id}
              step={selectedStep}
              onDeleteStep={onDeleteStep}
              onDuplicateStep={onDuplicateStep}
              onSaveStep={onSaveStep}
            />
          ) : (
            <div className="empty-state">
              <h2>Step Detail</h2>
              <p className="muted">Select a step to edit its config.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}
