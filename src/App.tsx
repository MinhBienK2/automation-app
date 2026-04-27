import { useEffect, useMemo, useState } from "react";
import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { WorkflowDetailPage } from "./components/workflows/WorkflowDetailPage";
import { WorkflowListPage } from "./components/workflows/WorkflowListPage";
import { TestStepMonitor } from "./components/workflows/TestStepMonitor";
import {
  addStep as addWorkflowStep,
  createWorkflow as createWorkflowCommand,
  deleteStep as deleteWorkflowStep,
  deleteWorkflow as deleteWorkflowCommand,
  getRunState,
  getWorkflow,
  listWorkflows,
  renameWorkflow as renameWorkflowCommand,
  reorderSteps,
  runWorkflow as runWorkflowCommand,
  stopRun as stopRunCommand,
  testStep as testStepCommand,
  updateStep,
} from "./lib/workflowApi";
import {
  commandMessage,
  initialRunState,
  normalizeRunState,
} from "./lib/workflowUi";
import type {
  ActionConfig,
  ActionType,
  RunState,
  WorkflowDetail,
  WorkflowSummary,
} from "./types/workflow";
import "./App.css";

type AppScreen = "list" | "detail";
type WorkflowDialogMode = "create" | "edit" | null;

function WorkflowNavIcon() {
  return (
    <svg
      aria-hidden="true"
      className="sidebar-item-icon"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <path
        d="M4 4.5h10M4 9h10M4 13.5h10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="sidebar-toggle-icon"
      data-testid="sidebar-toggle-icon"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      {collapsed ? (
        <path
          d="M7 4.5 11.5 9 7 13.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M11 4.5 6.5 9l4.5 4.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}

function App() {
  const [screen, setScreen] = useState<AppScreen>("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [monitorOpen, setMonitorOpen] = useState(false);
  const [monitorStepIds, setMonitorStepIds] = useState<string[]>([]);
  const [monitorScope, setMonitorScope] = useState("");
  const [workflowDialogMode, setWorkflowDialogMode] =
    useState<WorkflowDialogMode>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
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
    const items = await listWorkflows();
    setWorkflows(items);
  }

  async function refreshRunState() {
    const state = await getRunState();
    setRunState(normalizeRunState(state));
  }

  async function openWorkflow(id: string, preferredStepId?: string | null) {
    setAppError("");

    try {
      const loaded = await getWorkflow(id);
      if (!loaded) {
        setScreen("list");
        setSelectedWorkflowId(null);
        setDetail(null);
        setSelectedStepId(null);
        setAppError("Workflow not found");
        return;
      }

      setSelectedWorkflowId(id);
      setDetail(loaded);
      const preferredStepExists = loaded.steps.some(
        (step) => step.id === preferredStepId,
      );
      setSelectedStepId(
        preferredStepExists
          ? (preferredStepId ?? null)
          : (loaded.steps[0]?.id ?? null),
      );
      setRunState((current) =>
        current.status === "running" ? current : initialRunState,
      );
      setScreen("detail");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function reloadSelectedWorkflow(preferredStepId = selectedStepId) {
    if (!selectedWorkflowId) return;
    await openWorkflow(selectedWorkflowId, preferredStepId);
    await loadWorkflows();
  }

  function openCreateWorkflowDialog() {
    setWorkflowDialogMode("create");
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setAppError("");
  }

  function openEditWorkflowDialog(workflow: WorkflowSummary) {
    setWorkflowDialogMode("edit");
    setEditingWorkflowId(workflow.id);
    setWorkflowNameDraft(workflow.name);
    setAppError("");
  }

  function closeWorkflowDialog() {
    setWorkflowDialogMode(null);
    setEditingWorkflowId(null);
    setWorkflowNameDraft("");
    setAppError("");
  }

  async function submitWorkflowDialog(event: React.FormEvent) {
    event.preventDefault();
    setAppError("");

    try {
      if (workflowDialogMode === "create") {
        const created = await createWorkflowCommand(workflowNameDraft);
        closeWorkflowDialog();
        await loadWorkflows();
        await openWorkflow(created.id);
        return;
      }

      if (workflowDialogMode === "edit" && editingWorkflowId) {
        await renameWorkflowCommand(editingWorkflowId, workflowNameDraft);
        if (detail?.workflow.id === editingWorkflowId) {
          setDetail({
            ...detail,
            workflow: { ...detail.workflow, name: workflowNameDraft },
          });
        }
        closeWorkflowDialog();
        await loadWorkflows();
      }
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteWorkflow(id: string) {
    if (!window.confirm("Delete this workflow?")) return;

    await deleteWorkflowCommand(id);
    if (selectedWorkflowId === id) {
      setSelectedWorkflowId(null);
      setDetail(null);
      setSelectedStepId(null);
      setMonitorOpen(false);
      setScreen("list");
    }
    await loadWorkflows();
  }

  async function addStep(event: React.FormEvent) {
    event.preventDefault();
    if (!detail) return;
    setAppError("");

    try {
      const step = await addWorkflowStep(detail.workflow.id, newActionType);
      await reloadSelectedWorkflow(step.id);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function deleteStep(stepId: string) {
    if (!window.confirm("Delete this step?")) return;

    await deleteWorkflowStep(stepId);
    await reloadSelectedWorkflow();
  }

  async function runWorkflow() {
    if (!detail) return;
    setAppError("");

    try {
      const state = await runWorkflowCommand(detail.workflow.id);
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function testStep(targetStepId = selectedStepId, scope = "selected") {
    if (!detail || !targetStepId) return;
    setAppError("");

    const selectedIndex = detail.steps.findIndex((step) => step.id === targetStepId);
    if (selectedIndex < 0) return;

    setMonitorStepIds(detail.steps.slice(0, selectedIndex + 1).map((step) => step.id));
    setMonitorScope(scope);
    setMonitorOpen(true);

    try {
      const state = await testStepCommand(detail.workflow.id, targetStepId);
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function stopRun() {
    setAppError("");

    try {
      const state = await stopRunCommand();
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function testAllSteps() {
    if (!detail?.steps.length) return;
    await testStep(detail.steps[detail.steps.length - 1].id, "all");
  }

  async function handleDragEnd(event: DragEndEvent) {
    if (!detail || !event.over || event.active.id === event.over.id) return;

    const oldIndex = detail.steps.findIndex((step) => step.id === event.active.id);
    const newIndex = detail.steps.findIndex((step) => step.id === event.over?.id);
    if (oldIndex < 0 || newIndex < 0) return;

    const reordered = arrayMove(detail.steps, oldIndex, newIndex);
    setDetail({ ...detail, steps: reordered });

    await reorderSteps(
      detail.workflow.id,
      reordered.map((step) => step.id),
    );
    await reloadSelectedWorkflow();
  }

  function backToList() {
    setScreen("list");
    setMonitorOpen(false);
    setAppError("");
    void loadWorkflows();
  }

  const selectedStep = useMemo(
    () => detail?.steps.find((step) => step.id === selectedStepId) ?? null,
    [detail, selectedStepId],
  );
  const isRunning = runState.status === "running";

  return (
    <main className={sidebarCollapsed ? "app-shell app-shell-collapsed" : "app-shell"}>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <span className="sidebar-mark">W</span>
          <span className="sidebar-title">Workflow Manager</span>
        </div>
        <nav aria-label="Main navigation" className="sidebar-nav">
          <button
            className="sidebar-nav-item sidebar-nav-item-active"
            type="button"
            onClick={backToList}
          >
            <WorkflowNavIcon />
            <span>Workflows</span>
          </button>
        </nav>
        <button
          aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!sidebarCollapsed}
          className="sidebar-toggle"
          type="button"
          onClick={() => setSidebarCollapsed((current) => !current)}
        >
          <SidebarToggleIcon collapsed={sidebarCollapsed} />
        </button>
      </aside>

      <section className="app-content">
        {screen === "detail" && detail ? (
          <>
            <WorkflowDetailPage
              detail={detail}
              selectedStep={selectedStep}
              selectedStepId={selectedStepId}
              newActionType={newActionType}
              isRunning={isRunning}
              appError={appError}
              runState={runState}
              onBack={backToList}
              onSelectStep={setSelectedStepId}
              onNewActionTypeChange={setNewActionType}
              onAddStep={addStep}
              onDeleteStep={deleteStep}
              onSaveStep={async (stepId, name, config: ActionConfig) => {
                setAppError("");
                await updateStep(stepId, name, config);
                await reloadSelectedWorkflow(stepId);
              }}
              onRunWorkflow={runWorkflow}
              onTestStep={testStep}
              onTestAllSteps={testAllSteps}
              onStopRun={stopRun}
              onDragEnd={handleDragEnd}
            />
            {monitorOpen ? (
              <TestStepMonitor
                runState={runState}
                scope={monitorScope}
                steps={detail.steps.filter((step) => monitorStepIds.includes(step.id))}
                totalSteps={detail.steps.length}
                onClose={() => setMonitorOpen(false)}
                onStop={stopRun}
              />
            ) : null}
          </>
        ) : (
          <WorkflowListPage
            workflows={workflows}
            workflowDialogMode={workflowDialogMode}
            workflowNameDraft={workflowNameDraft}
            appError={appError}
            onWorkflowNameDraftChange={setWorkflowNameDraft}
            onSubmitWorkflowDialog={submitWorkflowDialog}
            onOpenCreateWorkflow={openCreateWorkflowDialog}
            onOpenEditWorkflow={openEditWorkflowDialog}
            onCloseWorkflowDialog={closeWorkflowDialog}
            onOpenWorkflow={openWorkflow}
            onDeleteWorkflow={deleteWorkflow}
          />
        )}
      </section>
    </main>
  );
}

export default App;
