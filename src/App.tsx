import { useEffect, useMemo, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

type ActionType = "open_url" | "sleep" | "type_text" | "click" | "scroll";
type RunStatus = "idle" | "running" | "success" | "failed" | "stopped";
type RunMode = "none" | "run_workflow" | "test_step";

type WorkflowSummary = {
  id: string;
  name: string;
  step_count: number;
  created_at: string;
  updated_at: string;
};

type Workflow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

type ActionConfig =
  | { type: "open_url"; config: { url: string } }
  | { type: "sleep"; config: { seconds: number } }
  | { type: "type_text"; config: { xpath: string; text: string } }
  | { type: "click"; config: { xpath: string } }
  | { type: "scroll"; config: { direction: "up" | "down"; pixels: number } };

type WorkflowStep = {
  id: string;
  name: string;
  workflow_id: string;
  order_index: number;
  action_type: ActionType;
  config: ActionConfig;
  created_at: string;
  updated_at: string;
};

type WorkflowDetail = {
  workflow: Workflow;
  steps: WorkflowStep[];
};

type RunState = {
  status: RunStatus;
  mode: RunMode;
  target_step_id: string | null;
  current_step_id: string | null;
  current_step_number: number | null;
  completed_step_ids: string[];
  error: null | {
    step_id?: string | null;
    step_number: number;
    step_name?: string | null;
    action_type: string;
    reason: string;
  };
};

type CommandError = {
  message: string;
  field?: string | null;
};

const actionLabels: Record<ActionType, string> = {
  open_url: "Open URL",
  sleep: "Sleep",
  type_text: "Type Text",
  click: "Click",
  scroll: "Scroll",
};

const actionOptions: ActionType[] = [
  "open_url",
  "sleep",
  "type_text",
  "click",
  "scroll",
];

function App() {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>({
    status: "idle",
    mode: "none",
    target_step_id: null,
    current_step_id: null,
    current_step_number: null,
    completed_step_ids: [],
    error: null,
  });
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorStepIds, setMonitorStepIds] = useState<string[]>([]);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  const [newActionType, setNewActionType] = useState<ActionType>("open_url");
  const [appError, setAppError] = useState("");

  useEffect(() => {
    void loadWorkflows();
    void refreshRunState();
  }, []);

  useEffect(() => {
    if (runState.status !== "running") return;

    const intervalId = window.setInterval(() => {
      void refreshRunState();
    }, 250);

    return () => window.clearInterval(intervalId);
  }, [runState.status]);

  async function loadWorkflows() {
    const items = await invoke<WorkflowSummary[]>("list_workflows");
    setWorkflows(items);
  }

  async function refreshRunState() {
    const state = await invoke<RunState>("get_run_state");
    setRunState(normalizeRunState(state));
  }

  async function openWorkflow(id: string, preferredStepId?: string | null) {
    const loaded = await invoke<WorkflowDetail | null>("get_workflow", { id });
    setSelectedWorkflowId(id);
    setDetail(loaded);
    const preferredStepExists = loaded?.steps.some(
      (step) => step.id === preferredStepId,
    );
    setSelectedStepId(
      preferredStepExists ? (preferredStepId ?? null) : (loaded?.steps[0]?.id ?? null),
    );
    setAppError("");
  }

  async function reloadSelectedWorkflow(preferredStepId = selectedStepId) {
    if (!selectedWorkflowId) return;
    await openWorkflow(selectedWorkflowId, preferredStepId);
    await loadWorkflows();
  }

  async function createWorkflow(event: React.FormEvent) {
    event.preventDefault();
    setAppError("");

    try {
      const created = await invoke<Workflow>("create_workflow", {
        name: newWorkflowName,
      });
      setNewWorkflowName("");
      await loadWorkflows();
      await openWorkflow(created.id);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function renameWorkflow() {
    if (!detail) return;
    setAppError("");

    try {
      await invoke("rename_workflow", {
        id: detail.workflow.id,
        name: detail.workflow.name,
      });
      await reloadSelectedWorkflow();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteWorkflow(id: string) {
    if (!window.confirm("Delete this workflow?")) return;
    await invoke("delete_workflow", { id });
    if (selectedWorkflowId === id) {
      setSelectedWorkflowId(null);
      setDetail(null);
      setSelectedStepId(null);
    }
    await loadWorkflows();
  }

  async function addStep(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;

    const step = await invoke<WorkflowStep>("add_step", {
      workflowId: detail.workflow.id,
      actionType: newActionType,
    });
    await reloadSelectedWorkflow();
    setSelectedStepId(step.id);
  }

  async function deleteStep(stepId: string) {
    if (!window.confirm("Delete this step?")) return;
    await invoke("delete_step", { stepId });
    await reloadSelectedWorkflow();
  }

  async function runWorkflow() {
    if (!detail) return;
    setAppError("");

    try {
      const state = await invoke<RunState>("run_workflow", {
        workflowId: detail.workflow.id,
      });
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function testStep() {
    if (!detail || !selectedStepId) return;
    setAppError("");
    const selectedIndex = detail.steps.findIndex((step) => step.id === selectedStepId);
    if (selectedIndex < 0) return;
    setMonitorStepIds(detail.steps.slice(0, selectedIndex + 1).map((step) => step.id));
    setMonitorOpen(true);

    try {
      const state = await invoke<RunState>("test_step", {
        workflowId: detail.workflow.id,
        stepId: selectedStepId,
      });
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function stopRun() {
    setAppError("");

    try {
      const state = await invoke<RunState>("stop_run");
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!detail || !event.over || event.active.id === event.over.id) return;

    const oldIndex = detail.steps.findIndex((step) => step.id === event.active.id);
    const newIndex = detail.steps.findIndex((step) => step.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(detail.steps, oldIndex, newIndex);
    setDetail({ ...detail, steps: reordered });

    await invoke("reorder_steps", {
      workflowId: detail.workflow.id,
      orderedStepIds: reordered.map((step) => step.id),
    });
    await reloadSelectedWorkflow();
  }

  const selectedStep = useMemo(
    () => detail?.steps.find((step) => step.id === selectedStepId) ?? null,
    [detail, selectedStepId],
  );
  const isRunning = runState.status === "running";

  return (
    <main className="app-shell">
      <WorkflowList
        workflows={workflows}
        selectedWorkflowId={selectedWorkflowId}
        newWorkflowName={newWorkflowName}
        onNewWorkflowNameChange={setNewWorkflowName}
        onCreateWorkflow={createWorkflow}
        onOpenWorkflow={openWorkflow}
        onDeleteWorkflow={deleteWorkflow}
      />

      <section className="builder-panel">
        {detail ? (
          <>
            <WorkflowBuilder
              detail={detail}
              selectedStep={selectedStep}
              selectedStepId={selectedStepId}
              newActionType={newActionType}
              isRunning={isRunning}
              appError={appError}
              runState={runState}
              onWorkflowNameChange={(name) =>
                setDetail({ ...detail, workflow: { ...detail.workflow, name } })
              }
              onRenameWorkflow={renameWorkflow}
              onSelectStep={setSelectedStepId}
              onNewActionTypeChange={setNewActionType}
              onAddStep={addStep}
              onDeleteStep={deleteStep}
              onSaveStep={async (stepId, name, config) => {
                setAppError("");
                await invoke("update_step", { stepId, name, config });
                await reloadSelectedWorkflow(stepId);
              }}
              onRunWorkflow={runWorkflow}
              onTestStep={testStep}
              onStopRun={stopRun}
              onDragEnd={handleDragEnd}
            />
            {monitorOpen ? (
              <TestStepMonitor
                runState={runState}
                steps={detail.steps.filter((step) => monitorStepIds.includes(step.id))}
                onClose={() => setMonitorOpen(false)}
                onStop={stopRun}
              />
            ) : null}
          </>
        ) : (
          <div className="empty-builder">
            <h2>Workflow Builder</h2>
            <p>Select or create a workflow to edit its steps.</p>
          </div>
        )}
      </section>
    </main>
  );
}

type WorkflowListProps = {
  workflows: WorkflowSummary[];
  selectedWorkflowId: string | null;
  newWorkflowName: string;
  onNewWorkflowNameChange: (name: string) => void;
  onCreateWorkflow: (event: React.FormEvent) => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
};

function WorkflowList({
  workflows,
  selectedWorkflowId,
  newWorkflowName,
  onNewWorkflowNameChange,
  onCreateWorkflow,
  onOpenWorkflow,
  onDeleteWorkflow,
}: WorkflowListProps) {
  return (
    <aside className="workflow-list">
      <div>
        <p className="eyebrow">Workflow Automation Manager</p>
        <h1>Workflows</h1>
      </div>

      <form className="create-form" onSubmit={onCreateWorkflow}>
        <label>
          Workflow name
          <input
            value={newWorkflowName}
            onChange={(event) => onNewWorkflowNameChange(event.currentTarget.value)}
            placeholder="Login flow"
          />
        </label>
        <button type="submit">Create</button>
      </form>

      <div className="workflow-items">
        {workflows.length === 0 ? (
          <p className="muted">No workflows yet</p>
        ) : (
          workflows.map((workflow) => (
            <article
              className={
                workflow.id === selectedWorkflowId
                  ? "workflow-row workflow-row-selected"
                  : "workflow-row"
              }
              key={workflow.id}
            >
              <div>
                <strong>{workflow.name}</strong>
                <span>{workflow.step_count} steps</span>
              </div>
              <div className="row-actions">
                <button type="button" onClick={() => onOpenWorkflow(workflow.id)}>
                  Open
                </button>
                <button
                  className="secondary-danger"
                  type="button"
                  onClick={() => onDeleteWorkflow(workflow.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </aside>
  );
}

type WorkflowBuilderProps = {
  detail: WorkflowDetail;
  selectedStep: WorkflowStep | null;
  selectedStepId: string | null;
  newActionType: ActionType;
  isRunning: boolean;
  appError: string;
  runState: RunState;
  onWorkflowNameChange: (name: string) => void;
  onRenameWorkflow: () => void;
  onSelectStep: (stepId: string) => void;
  onNewActionTypeChange: (actionType: ActionType) => void;
  onAddStep: (event: React.FormEvent) => void;
  onDeleteStep: (stepId: string) => void;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
  onRunWorkflow: () => void;
  onTestStep: () => void;
  onStopRun: () => void;
  onDragEnd: (event: DragEndEvent) => void;
};

function WorkflowBuilder({
  detail,
  selectedStep,
  selectedStepId,
  newActionType,
  isRunning,
  appError,
  runState,
  onWorkflowNameChange,
  onRenameWorkflow,
  onSelectStep,
  onNewActionTypeChange,
  onAddStep,
  onDeleteStep,
  onSaveStep,
  onRunWorkflow,
  onTestStep,
  onStopRun,
  onDragEnd,
}: WorkflowBuilderProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  return (
    <div className="builder-grid">
      <section className="step-list-panel">
        <div className="builder-header">
          <label>
            Workflow name
            <input
              value={detail.workflow.name}
              onChange={(event) => onWorkflowNameChange(event.currentTarget.value)}
            />
          </label>
          <button type="button" onClick={onRenameWorkflow}>
            Save Name
          </button>
        </div>

        <RunStatusBar state={runState} error={appError} />

        <div className="run-actions">
          <button type="button" onClick={onRunWorkflow} disabled={isRunning}>
            Run Workflow
          </button>
          <button
            type="button"
            onClick={onTestStep}
            disabled={isRunning || !selectedStep}
          >
            Test Step
          </button>
          {isRunning ? (
            <button type="button" onClick={onStopRun}>
              Stop
            </button>
          ) : null}
        </div>

        <h2>Steps</h2>
        {detail.steps.length === 0 ? (
          <p className="muted">No steps yet</p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={detail.steps.map((step) => step.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="step-list">
                {detail.steps.map((step, index) => (
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
              {actionOptions.map((actionType) => (
                <option key={actionType} value={actionType}>
                  {actionLabels[actionType]}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Add Step</button>
        </form>
      </section>

      <section className="step-detail-panel">
        {selectedStep ? (
          <StepForm
            key={selectedStep.id}
            step={selectedStep}
            onDeleteStep={onDeleteStep}
            onSaveStep={onSaveStep}
          />
        ) : (
          <div>
            <h2>Step Detail</h2>
            <p className="muted">Select a step to edit its config.</p>
          </div>
        )}
      </section>
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
      <button
        className={isSelected ? "step-item step-item-selected" : "step-item"}
        type="button"
        onClick={() => onSelectStep(step.id)}
      >
        <span>{index + 1}</span>
        <strong>{step.name || actionLabels[step.action_type]}</strong>
        <small>
          {actionLabels[step.action_type]} · {stepSummary(step)}
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

type StepFormProps = {
  step: WorkflowStep;
  onDeleteStep: (stepId: string) => void;
  onSaveStep: (stepId: string, name: string, config: ActionConfig) => Promise<void>;
};

function StepForm({ step, onDeleteStep, onSaveStep }: StepFormProps) {
  const [name, setName] = useState(step.name || actionLabels[step.action_type]);
  const [config, setConfig] = useState<ActionConfig>(step.config);
  const [fieldError, setFieldError] = useState("");

  async function saveStep(event: React.FormEvent) {
    event.preventDefault();
    setFieldError("");

    try {
      await onSaveStep(step.id, name, config);
    } catch (error) {
      setFieldError(commandMessage(error));
    }
  }

  return (
    <form className="step-form" onSubmit={saveStep}>
      <div>
        <p className="eyebrow">Step Detail</p>
        <h2>{actionLabels[step.action_type]}</h2>
      </div>

      <label>
        Step name
        <input
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
      </label>

      <ActionFields config={config} onChange={setConfig} />

      {fieldError ? <p className="field-error">{fieldError}</p> : null}

      <div className="form-actions">
        <button type="submit">Save Step</button>
        <button
          className="secondary-danger"
          type="button"
          onClick={() => onDeleteStep(step.id)}
        >
          Delete Step
        </button>
      </div>
    </form>
  );
}

type ActionFieldsProps = {
  config: ActionConfig;
  onChange: (config: ActionConfig) => void;
};

function ActionFields({ config, onChange }: ActionFieldsProps) {
  switch (config.type) {
    case "open_url":
      return (
        <label>
          URL
          <input
            value={config.config.url}
            onChange={(event) =>
              onChange({
                type: "open_url",
                config: { url: event.currentTarget.value },
              })
            }
          />
        </label>
      );
    case "sleep":
      return (
        <label>
          Seconds
          <input
            min="0"
            step="0.1"
            type="number"
            value={config.config.seconds}
            onChange={(event) =>
              onChange({
                type: "sleep",
                config: { seconds: Number(event.currentTarget.value) },
              })
            }
          />
        </label>
      );
    case "type_text":
      return (
        <>
          <label>
            XPath
            <input
              value={config.config.xpath}
              onChange={(event) =>
                onChange({
                  type: "type_text",
                  config: {
                    ...config.config,
                    xpath: event.currentTarget.value,
                  },
                })
              }
            />
          </label>
          <label>
            Text
            <textarea
              value={config.config.text}
              onChange={(event) =>
                onChange({
                  type: "type_text",
                  config: {
                    ...config.config,
                    text: event.currentTarget.value,
                  },
                })
              }
            />
          </label>
        </>
      );
    case "click":
      return (
        <label>
          XPath
          <input
            value={config.config.xpath}
            onChange={(event) =>
              onChange({
                type: "click",
                config: { xpath: event.currentTarget.value },
              })
            }
          />
        </label>
      );
    case "scroll":
      return (
        <>
          <label>
            Direction
            <select
              value={config.config.direction}
              onChange={(event) =>
                onChange({
                  type: "scroll",
                  config: {
                    ...config.config,
                    direction: event.currentTarget.value as "up" | "down",
                  },
                })
              }
            >
              <option value="down">Down</option>
              <option value="up">Up</option>
            </select>
          </label>
          <label>
            Pixels
            <input
              min="1"
              type="number"
              value={config.config.pixels}
              onChange={(event) =>
                onChange({
                  type: "scroll",
                  config: {
                    ...config.config,
                    pixels: Number(event.currentTarget.value),
                  },
                })
              }
            />
          </label>
        </>
      );
  }
}

type TestStepMonitorProps = {
  steps: WorkflowStep[];
  runState: RunState;
  onClose: () => void;
  onStop: () => void;
};

function TestStepMonitor({
  steps,
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
                  {actionLabels[detailStep.action_type]} · {stepSummary(detailStep)}
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

type RunStatusBarProps = {
  state: RunState;
  error: string;
};

function RunStatusBar({ state, error }: RunStatusBarProps) {
  const failure =
    state.status === "failed" && state.error
      ? `Failed at step ${state.error.step_number}: ${state.error.reason}`
      : "";

  return (
    <div className="run-status">
      <span>Status</span>
      <strong>{state.status}</strong>
      {failure ? <p>{failure}</p> : null}
      {error ? <p>{error}</p> : null}
    </div>
  );
}

function stepSummary(step: WorkflowStep) {
  switch (step.config.type) {
    case "open_url":
      return step.config.config.url || "No URL";
    case "sleep":
      return `${step.config.config.seconds}s`;
    case "type_text":
      return step.config.config.xpath || "No XPath";
    case "click":
      return step.config.config.xpath || "No XPath";
    case "scroll":
      return `${step.config.config.direction} ${step.config.config.pixels}px`;
  }
}

function commandMessage(error: unknown) {
  if (typeof error === "object" && error && "message" in error) {
    return String((error as CommandError).message);
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unexpected error";
}

function normalizeRunState(state: RunState): RunState {
  return {
    status: state.status,
    mode: state.mode ?? "none",
    target_step_id: state.target_step_id ?? null,
    current_step_id: state.current_step_id ?? null,
    current_step_number: state.current_step_number ?? null,
    completed_step_ids: state.completed_step_ids ?? [],
    error: state.error ?? null,
  };
}

function monitorStepStatus(step: WorkflowStep, state: RunState) {
  if (state.error?.step_id === step.id) return "failed";
  if (state.current_step_id === step.id) return "running";
  if (state.completed_step_ids.includes(step.id)) return "passed";
  return "pending";
}

function suggestionsFor(reason: string, actionType: string) {
  if (reason.includes("XPath not found")) {
    return [
      "Check the XPath in the Chromium window that remains open.",
      "Add a Sleep step before this step if the element loads slowly.",
      "Prefer XPath based on id, name, placeholder, text, or stable attributes.",
      "Avoid absolute XPath such as /html/body/div[2]/...",
    ];
  }
  if (reason.includes("Element cannot receive text")) {
    return [
      "Make sure the XPath points to an input, textarea, or editable element.",
      "Check whether the XPath points to a label, div, button, or wrapper instead of the field.",
    ];
  }
  if (reason.includes("URL") || actionType === "open_url") {
    return [
      "Use a full URL with http:// or https://.",
      "Check for extra whitespace or missing characters.",
    ];
  }
  if (reason.includes("Seconds")) {
    return [
      "Use a Sleep value greater than 0.",
      "Try 0.5, 1, or 2 seconds depending on page speed.",
    ];
  }
  if (reason.includes("Pixels")) {
    return [
      "Use a Scroll pixels value greater than 0.",
      "Try 300 to 800 pixels for a single scroll.",
    ];
  }
  return [
    "Close old test browsers and try again.",
    "Check that Chrome or Chromium can start on this machine.",
  ];
}

export default App;
