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
    <section className="step-list-panel panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Builder</p>
          <h2>Steps</h2>
        </div>
        <span>{steps.length} total</span>
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
        <label>
          Action type
          <select
            value={newActionType}
            onChange={(event) =>
              onNewActionTypeChange(event.currentTarget.value as ActionType)
            }
          >
            {actionGroups.map((group) => (
              <optgroup key={group.label} label={group.label}>
                {group.actions.map((actionType) => (
                  <option key={actionType} value={actionType}>
                    {actionLabels[actionType]}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
        <button className="primary-button" type="submit">
          Add Step
        </button>
      </form>
    </section>
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
      <button
        className={isSelected ? "step-item step-item-selected" : "step-item"}
        type="button"
        onClick={() => onSelectStep(step.id)}
      >
        <span>{index + 1}</span>
        <strong>{step.name || actionLabels[step.action_type]}</strong>
        <small>
          {actionLabels[step.action_type]} - {stepSummary(step)}
        </small>
      </button>
      <button
        aria-label={`Drag step ${index + 1}`}
        className="step-drag-handle"
        type="button"
        {...attributes}
        {...listeners}
      >
        ::
      </button>
    </div>
  );
}
