import { useEffect, useId, useRef, useState } from "react";
import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ActionType, WorkflowStep } from "../../../types/workflow";
import { actionGroups, actionLabels, stepSummary } from "../../../lib/workflowUi";
import { Badge } from "../../../components/ui/badge";
import { Button } from "../../../components/ui/button";
import { Label } from "../../../components/ui/label";

type StepListProps = {
  steps: WorkflowStep[];
  selectedStepId: string | null;
  newActionType: ActionType;
  onSelectStep: (stepId: string) => void;
  onNewActionTypeChange: (actionType: ActionType) => void;
  onAddStep: (event: React.FormEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
};

export function StepList({
  steps,
  selectedStepId,
  newActionType,
  onSelectStep,
  onNewActionTypeChange,
  onAddStep,
  onDragEnd,
}: StepListProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <section aria-label="Builder Steps" className="step-list-panel panel">
      <div className="panel-heading">
        <h2 className="builder-steps-title">Builder Steps</h2>
        <Badge variant="secondary">{steps.length} total</Badge>
      </div>

      {steps.length === 0 ? (
        <p className="muted">No steps yet</p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext
            items={steps.map((step) => step.id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="step-list">
              {steps.map((step, index) => (
                <SortableStepItem
                  index={index}
                  isSelected={step.id === selectedStepId}
                  key={step.id}
                  step={step}
                  onSelectStep={onSelectStep}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <form className="add-step-form" onSubmit={onAddStep}>
        <ActionTypePicker
          value={newActionType}
          onChange={onNewActionTypeChange}
        />
        <Button shape="pill" type="submit">
          Add Step
        </Button>
      </form>
    </section>
  );
}

type ActionTypePickerProps = {
  value: ActionType;
  onChange: (actionType: ActionType) => void;
};

function ActionTypePicker({ value, onChange }: ActionTypePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [placement, setPlacement] = useState<"down" | "up">("down");
  const pickerId = useId();
  const labelId = `${pickerId}-label`;
  const listboxId = `${pickerId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    if (!isOpen) {
      const rect = event.currentTarget.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      const spaceAbove = rect.top;
      setPlacement(spaceBelow < 320 && spaceAbove > spaceBelow ? "up" : "down");
    }

    setIsOpen((current) => !current);
  }

  return (
    <div className="action-picker-field" ref={rootRef}>
      <Label id={labelId}>Action type</Label>
      <div className="action-picker">
        <Button
          aria-controls={isOpen ? listboxId : undefined}
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          aria-label="Action type"
          className="action-picker-trigger"
          data-slot="action-picker-trigger"
          type="button"
          variant="secondary"
          onClick={toggleMenu}
        >
          <span>{actionLabels[value]}</span>
          <span aria-hidden="true" className="action-picker-chevron">
            ▾
          </span>
        </Button>

        {isOpen ? (
          <div
            aria-labelledby={labelId}
            className={
              placement === "up"
                ? "action-picker-menu action-picker-menu-up"
                : "action-picker-menu"
            }
            id={listboxId}
            role="listbox"
            tabIndex={-1}
          >
            {actionGroups.map((group) => (
              <div
                aria-label={group.label}
                className="action-picker-group"
                key={group.label}
                role="group"
              >
                <p className="action-picker-group-label">{group.label}</p>
                {group.actions.map((actionType) => (
                  <button
                    aria-selected={actionType === value}
                    className={
                      actionType === value
                        ? "action-picker-option action-picker-option-selected"
                        : "action-picker-option"
                    }
                    data-value={actionType}
                    key={actionType}
                    role="option"
                    type="button"
                    onClick={() => {
                      onChange(actionType);
                      setIsOpen(false);
                    }}
                  >
                    {actionLabels[actionType]}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type SortableStepItemProps = {
  step: WorkflowStep;
  index: number;
  isSelected: boolean;
  onSelectStep: (stepId: string) => void;
};

function SortableStepItem({
  step,
  index,
  isSelected,
  onSelectStep,
}: SortableStepItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id: step.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div className="step-item-wrap" ref={setNodeRef} style={style}>
      <Button
        className={isSelected ? "step-item step-item-selected" : "step-item"}
        type="button"
        onClick={() => onSelectStep(step.id)}
      >
        <span>{index + 1}</span>
        <strong>{step.name || actionLabels[step.action_type]}</strong>
        <small>
          {actionLabels[step.action_type]} - {stepSummary(step)}
        </small>
      </Button>
      <Button
        aria-label={`Drag step ${index + 1}`}
        className="step-drag-handle"
        variant="ghost"
        size="icon"
        type="button"
        {...attributes}
        {...listeners}
      >
        ::
      </Button>
    </div>
  );
}
