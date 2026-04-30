import { useEffect, useRef, useState } from "react";
import type { ActionConfig, ActionType, WorkflowStep } from "../../../types/workflow";
import { actionLabels, actionOptions, commandMessage } from "../../../lib/workflowUi";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import type { StepHelpLanguage } from "../lib/stepHelpContent";
import { StepHelpModal } from "./StepHelpModal";
import { ActionConfigEditor } from "./ActionConfigEditor";

type StepFormProps = {
  step: WorkflowStep;
  onDeleteStep: (stepId: string) => void;
  onDuplicateStep: (step: WorkflowStep, name: string, config: ActionConfig) => Promise<void>;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
};

export function StepForm({
  step,
  onDeleteStep,
  onDuplicateStep,
  onSaveStep,
}: StepFormProps) {
  const [name, setName] = useState(step.name || actionLabels[step.action_type]);
  const [config, setConfig] = useState<ActionConfig>(step.config);
  const [fieldError, setFieldError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [helpLanguage, setHelpLanguage] = useState<StepHelpLanguage>("vi");
  const successTimeoutRef = useRef<number | null>(null);
  const helpActionType = isActionType(config.type) ? config.type : step.action_type;

  useEffect(() => {
    return () => {
      if (successTimeoutRef.current !== null) {
        window.clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  function showSuccessMessage(message: string) {
    if (successTimeoutRef.current !== null) {
      window.clearTimeout(successTimeoutRef.current);
    }
    setSuccessMessage(message);
    successTimeoutRef.current = window.setTimeout(() => {
      setSuccessMessage("");
      successTimeoutRef.current = null;
    }, 2500);
  }

  async function saveStep(event: React.FormEvent) {
    event.preventDefault();
    setFieldError("");
    setSuccessMessage("");

    try {
      await onSaveStep(step.id, name, config);
      showSuccessMessage("Step saved successfully.");
    } catch (error) {
      setFieldError(commandMessage(error));
    }
  }

  return (
    <>
      <form className="step-form" onSubmit={saveStep}>
        <div className="step-form-header">
          <div>
            <p className="eyebrow">Step Detail</p>
            <h2>{actionLabels[step.action_type]}</h2>
          </div>
          <Button
            aria-label={`Open ${actionLabels[step.action_type]} help`}
            className="step-help-button"
            type="button"
            onClick={() => setIsHelpOpen(true)}
          >
            ?
          </Button>
        </div>

        <Label>
          Step name
          <Input
            value={name}
            onChange={(event) => setName(event.currentTarget.value)}
          />
        </Label>

        <ActionConfigEditor config={config} onChange={setConfig} />

        {fieldError ? <p className="field-error">{fieldError}</p> : null}

        <div className="form-actions">
          <Button shape="pill" type="submit">
            Save Step
          </Button>
          <Button
            variant="secondary"
            type="button"
            onClick={() => {
              setFieldError("");
              void onDuplicateStep(step, name, config).catch((error) => {
                setFieldError(commandMessage(error));
              });
            }}
          >
            Duplicate Step
          </Button>
          <Button
            variant="destructive"
            type="button"
            onClick={() => onDeleteStep(step.id)}
          >
            Delete Step
          </Button>
        </div>
      </form>
      {successMessage ? (
        <div className="toast-alert" role="status">
          {successMessage}
        </div>
      ) : null}
      {isHelpOpen ? (
        <StepHelpModal
          actionType={helpActionType}
          language={helpLanguage}
          onClose={() => setIsHelpOpen(false)}
          onLanguageChange={setHelpLanguage}
        />
      ) : null}
    </>
  );
}

function isActionType(value: string): value is ActionType {
  return actionOptions.includes(value as ActionType);
}
