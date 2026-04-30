import { useEffect, useState } from "react";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { AppShell } from "./layouts/AppShell";
import {
  createWorkflow as createWorkflowCommand,
  deleteWorkflow as deleteWorkflowCommand,
  getWorkflowGraph,
  getRunState,
  getWorkflow,
  listWorkflows,
  renameWorkflow as renameWorkflowCommand,
  runWorkflow as runWorkflowCommand,
  saveWorkflowGraph,
  stopRun as stopRunCommand,
  validateWorkflowGraph,
} from "./lib/workflowApi";
import { linearGraphFromSteps } from "./features/workflows/lib/workflowGraph";
import {
  commandMessage,
  initialRunState,
  normalizeRunState,
} from "./lib/workflowUi";
import type {
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
  WorkflowSummary,
} from "./types/workflow";
import "./App.css";

type AppScreen = "list" | "detail";
type WorkflowDialogMode = "create" | "edit" | null;

function App() {
  const [screen, setScreen] = useState<AppScreen>("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [graphIssues, setGraphIssues] = useState<GraphValidationIssue[]>([]);
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [workflowDialogMode, setWorkflowDialogMode] =
    useState<WorkflowDialogMode>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
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

  async function openWorkflow(id: string) {
    setAppError("");

    try {
      const loaded = await getWorkflow(id);
      if (!loaded) {
        setScreen("list");
        setSelectedWorkflowId(null);
        setDetail(null);
        setWorkflowGraph(null);
        setGraphIssues([]);
        setAppError("Workflow not found");
        return;
      }

      setSelectedWorkflowId(id);
      setDetail(loaded);
      try {
        setWorkflowGraph(await getWorkflowGraph(id));
      } catch {
        setWorkflowGraph(linearGraphFromSteps(loaded.steps));
      }
      setGraphIssues([]);
      setRunState((current) =>
        current.status === "running" ? current : initialRunState,
      );
      setScreen("detail");
    } catch (error) {
      setAppError(commandMessage(error));
    }
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
      setWorkflowGraph(null);
      setGraphIssues([]);
      setScreen("list");
    }
    await loadWorkflows();
  }

  async function runGraph() {
    if (!detail || !workflowGraph) return;
    setAppError("");

    try {
      await saveWorkflowGraph(detail.workflow.id, workflowGraph);
      const state = await runWorkflowCommand(detail.workflow.id);
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function validateGraph() {
    if (!workflowGraph) return;
    setAppError("");

    try {
      setGraphIssues(await validateWorkflowGraph(workflowGraph));
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function saveGraph() {
    if (!detail || !workflowGraph) return;
    setAppError("");

    try {
      await saveWorkflowGraph(detail.workflow.id, workflowGraph);
      await loadWorkflows();
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

  function backToList() {
    setScreen("list");
    setAppError("");
    void loadWorkflows();
  }
  const isRunning = runState.status === "running";

  return (
    <AppShell
      sidebarCollapsed={sidebarCollapsed}
      onBackToList={backToList}
      onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
    >
      {screen === "detail" && detail ? (
        <>
          <WorkflowDetailPage
            detail={detail}
            isRunning={isRunning}
            appError={appError}
            runState={runState}
            workflowGraph={workflowGraph}
            graphIssues={graphIssues}
            onBack={backToList}
            onStopRun={stopRun}
            onGraphChange={setWorkflowGraph}
            onRunGraph={runGraph}
            onSaveGraph={saveGraph}
            onValidateGraph={validateGraph}
          />
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
    </AppShell>
  );
}

export default App;
