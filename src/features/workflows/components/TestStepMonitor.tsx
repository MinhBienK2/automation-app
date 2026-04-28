import type { RunState, WorkflowStep } from "../../../types/workflow";
import {
  actionLabels,
  monitorStepStatus,
  stepSummary,
  suggestionsFor,
} from "../../../lib/workflowUi";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { ScrollArea } from "../../../components/ui/scroll-area";

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
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent className="monitor-dialog">
        <DialogHeader className="monitor-header">
          <div>
            <p className="eyebrow">Test Step</p>
            <DialogTitle>Test Step Monitor</DialogTitle>
          </div>
          <Button variant="secondary" type="button" onClick={onClose}>
            Close
          </Button>
        </DialogHeader>

        <div className="monitor-grid">
          <Card className="monitor-progress">
            <CardHeader>
              <CardTitle>
                <h3>Step Progress</h3>
              </CardTitle>
              <p className="monitor-range">
                Testing steps 1-{steps.length} of {totalSteps}
              </p>
              <p className="monitor-range">
                {scope === "all"
                  ? "This test runs every step in the workflow."
                  : "This test runs from step 1 through the selected step only."}
              </p>
            </CardHeader>
            <CardContent>
              <ScrollArea className="monitor-step-list">
                <div className="monitor-step-list" style={{ overflow: "visible" }}>
                  {steps.map((step, index) => {
                    const status = monitorStepStatus(step, runState);
                    return (
                      <article className={`monitor-step monitor-step-${status}`} key={step.id}>
                        <span>{index + 1}</span>
                        <div>
                          <strong>{step.name || actionLabels[step.action_type]}</strong>
                          <small>{actionLabels[step.action_type]}</small>
                        </div>
                        <Badge variant={status === "failed" ? "destructive" : "secondary"}>
                          {status}
                        </Badge>
                      </article>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          <Card className="monitor-detail">
            <CardHeader>
              <CardTitle>
                <h3>Step Detail</h3>
              </CardTitle>
            </CardHeader>
            <CardContent>
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
            </CardContent>
          </Card>
        </div>

        <div className="monitor-actions">
          {runState.status === "running" ? (
            <Button type="button" onClick={onStop}>
              Stop
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
