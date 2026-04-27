import type { RunState, WorkflowStep } from "../../types/workflow";
import {
  actionLabels,
  monitorStepStatus,
  stepSummary,
  suggestionsFor,
} from "../../lib/workflowUi";

type TestStepMonitorProps = {
  steps: WorkflowStep[];
  totalSteps: number;
  scope: string;
  runState: RunState;
  onClose: () => void;
  onStop: () => void;
};

export function TestStepMonitor({
  steps,
  totalSteps,
  scope,
  runState,
  onClose,
  onStop,
}: TestStepMonitorProps) {
  const activeStep =
    steps.find((step) => step.id === runState.current_step_id) ??
    steps.find((step) => step.id === runState.error?.step_id) ??
    steps[steps.length - 1] ??
    null;
  const failedStep = runState.error
    ? steps.find((step) => step.id === runState.error?.step_id) ?? activeStep
    : null;
  const detailStep = failedStep ?? activeStep;
  const suggestions = runState.error
    ? suggestionsFor(runState.error.reason, runState.error.action_type)
    : [];

  return (
    <div className="monitor-backdrop">
      <section
        aria-modal="true"
        aria-label="Test Step Monitor"
        className="monitor-dialog"
        role="dialog"
      >
        <div className="monitor-header">
          <div>
            <p className="eyebrow">Test Step</p>
            <h2>Test Step Monitor</h2>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>

        <div className="monitor-grid">
          <section className="monitor-progress">
            <h3>Step Progress</h3>
            <p className="monitor-range">
              Testing steps 1-{steps.length} of {totalSteps}
            </p>
            <p className="monitor-range">
              {scope === "all"
                ? "This test runs every step in the workflow."
                : "This test runs from step 1 through the selected step only."}
            </p>
            <div className="monitor-step-list">
              {steps.map((step, index) => {
                const status = monitorStepStatus(step, runState);
                return (
                  <article className={`monitor-step monitor-step-${status}`} key={step.id}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.name || actionLabels[step.action_type]}</strong>
                      <small>{actionLabels[step.action_type]}</small>
                    </div>
                    <em>{status}</em>
                  </article>
                );
              })}
            </div>
          </section>

          <section className="monitor-detail">
            <h3>Step Detail</h3>
            {detailStep ? (
              <>
                <strong>{detailStep.name || actionLabels[detailStep.action_type]}</strong>
                <p>
                  {actionLabels[detailStep.action_type]} - {stepSummary(detailStep)}
                </p>
              </>
            ) : null}

            {runState.status === "success" ? (
              <p className="monitor-success">Test completed through selected step.</p>
            ) : null}
            {runState.status === "stopped" ? (
              <p className="monitor-stopped">
                Test stopped. Chromium remains open for inspection.
              </p>
            ) : null}
            {runState.status === "failed" && runState.error ? (
              <div className="monitor-error">
                <strong>
                  Failed at step {runState.error.step_number}:{" "}
                  {runState.error.step_name ?? detailStep?.name ?? "Unknown step"}
                </strong>
                <p>Reason: {runState.error.reason}</p>
                <h4>Suggestions</h4>
                <ul>
                  {suggestions.map((suggestion) => (
                    <li key={suggestion}>{suggestion}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>
        </div>

        <div className="monitor-actions">
          {runState.status === "running" ? (
            <button type="button" onClick={onStop}>
              Stop
            </button>
          ) : null}
        </div>
      </section>
    </div>
  );
}
