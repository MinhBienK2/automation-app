import type { DragEndEvent } from "@dnd-kit/core";
import type {
  ActionConfig,
  ActionType,
  RunState,
  WorkflowDetail,
  WorkflowStep,
} from "../../types/workflow";
import { RunStatusBar } from "./RunStatusBar";
import { StepForm } from "./StepForm";
import { StepList } from "./StepList";

type WorkflowDetailPageProps = {
  detail: WorkflowDetail;
  selectedStep: WorkflowStep | null;
  selectedStepId: string | null;
  newActionType: ActionType;
  isRunning: boolean;
  appError: string;
  runState: RunState;
  onBack: () => void;
  onSelectStep: (stepId: string) => void;
  onNewActionTypeChange: (actionType: ActionType) => void;
  onAddStep: (event: React.FormEvent) => void;
  onDeleteStep: (stepId: string) => void;
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
  newActionType,
  isRunning,
  appError,
  runState,
  onBack,
  onSelectStep,
  onNewActionTypeChange,
  onAddStep,
  onDeleteStep,
  onSaveStep,
  onRunWorkflow,
  onTestStep,
  onTestAllSteps,
  onStopRun,
  onDragEnd,
}: WorkflowDetailPageProps) {
  return (
    <section className="app-screen workflow-detail-screen">
      <header className="detail-header">
        <div className="detail-title-group">
          <button className="ghost-button" type="button" onClick={onBack}>
            Back to Workflows
          </button>
          <div>
            <p className="eyebrow">Workflow Detail</p>
            <h1>{detail.workflow.name}</h1>
          </div>
        </div>
        <div className="workflow-command-panel panel">
          <RunStatusBar state={runState} error={appError} />
          <div className="run-actions">
            <button
              className="primary-button"
              type="button"
              onClick={onRunWorkflow}
              disabled={isRunning}
            >
              Run Workflow
            </button>
            <button
              type="button"
              onClick={() => onTestStep()}
              title="Runs from step 1 through the selected step."
              disabled={isRunning || !selectedStep}
            >
              Test to Here
            </button>
            <button
              type="button"
              onClick={onTestAllSteps}
              title="Runs every step in this workflow."
              disabled={isRunning || detail.steps.length === 0}
            >
              Test All
            </button>
            {isRunning ? (
              <button className="secondary-danger" type="button" onClick={onStopRun}>
                Stop
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <div className="builder-grid">
        <StepList
          steps={detail.steps}
          selectedStepId={selectedStepId}
          newActionType={newActionType}
          onSelectStep={onSelectStep}
          onNewActionTypeChange={onNewActionTypeChange}
          onAddStep={onAddStep}
          onDragEnd={onDragEnd}
        />

        <section className="step-detail-panel panel">
          {selectedStep ? (
            <StepForm
              key={selectedStep.id}
              step={selectedStep}
              onDeleteStep={onDeleteStep}
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
