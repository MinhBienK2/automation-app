import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { AppShell } from "./layouts/AppShell";
import {
  createWorkflow as createWorkflowCommand,
  deleteWorkflow as deleteWorkflowCommand,
  exportWorkflow,
  getWorkflowGraph,
  getRunState,
  getWorkflow,
  getWorkflowSettings,
  importWorkflow,
  listWorkflows,
  renameWorkflow as renameWorkflowCommand,
  runWorkflow as runWorkflowCommand,
  saveWorkflowGraph,
  saveWorkflowSettingsSection,
  stopRun as stopRunCommand,
  validateWorkflowGraph,
} from "./lib/workflowApi";
import { linearGraphFromSteps } from "./features/workflows/lib/workflowGraph";
import {
  commandMessage,
  initialRunState,
  normalizeRunState,
} from "./lib/workflowUi";
import {
  defaultWorkflowSettings,
} from "./features/workflows/lib/workflowSettings";
import { WorkflowSettingsDialog } from "./features/workflows/components/WorkflowSettingsDialog";
import type {
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
  WorkflowSettings,
  WorkflowSettingsSectionId,
  WorkflowSummary,
} from "./types/workflow";
import "./App.css";

type AppScreen = "list" | "detail" | "settings";
type WorkflowDialogMode = "create" | "edit" | null;
type GraphSaveStatus = "saved" | "unsaved" | "saving" | "failed" | "off";
type WorkflowSettingsSaveStatus = "saved" | "unsaved" | "saving" | "failed";

const appSettingsStorageKey = "workflow-manager:settings:v1";

function readGraphAutosaveEnabled() {
  try {
    const stored = window.localStorage.getItem(appSettingsStorageKey);
    if (!stored) return true;
    const parsed = JSON.parse(stored) as { graphAutosaveEnabled?: unknown };
    return typeof parsed.graphAutosaveEnabled === "boolean"
      ? parsed.graphAutosaveEnabled
      : true;
  } catch {
    return true;
  }
}

function writeGraphAutosaveEnabled(enabled: boolean) {
  window.localStorage.setItem(
    appSettingsStorageKey,
    JSON.stringify({ graphAutosaveEnabled: enabled }),
  );
}

function graphSaveStatusLabel(status: GraphSaveStatus) {
  switch (status) {
    case "saved":
      return "Saved";
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving...";
    case "failed":
      return "Autosave failed";
    case "off":
      return "Autosave off";
  }
}

function workflowSettingsSaveStatusLabel(status: WorkflowSettingsSaveStatus) {
  switch (status) {
    case "saved":
      return "Saved";
    case "unsaved":
      return "Unsaved changes";
    case "saving":
      return "Saving...";
    case "failed":
      return "Save failed";
  }
}

function App() {
  const [screen, setScreen] = useState<AppScreen>("list");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([]);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null,
  );
  const [detail, setDetail] = useState<WorkflowDetail | null>(null);
  const [workflowGraph, setWorkflowGraph] = useState<WorkflowGraph | null>(null);
  const [workflowSettings, setWorkflowSettings] =
    useState<WorkflowSettings | null>(null);
  const [workflowSettingsDialogOpen, setWorkflowSettingsDialogOpen] =
    useState(false);
  const [workflowSettingsActiveSection, setWorkflowSettingsActiveSection] =
    useState<WorkflowSettingsSectionId>("general");
  const [workflowSettingsSaveStatuses, setWorkflowSettingsSaveStatuses] =
    useState<Record<WorkflowSettingsSectionId, WorkflowSettingsSaveStatus>>(
      settingsSaveStatuses("saved"),
    );
  const [graphAutosaveEnabled, setGraphAutosaveEnabled] = useState(
    readGraphAutosaveEnabled,
  );
  const [graphSaveStatus, setGraphSaveStatus] = useState<GraphSaveStatus>(
    graphAutosaveEnabled ? "saved" : "off",
  );
  const [graphRevision, setGraphRevision] = useState(0);
  const [savedGraphRevision, setSavedGraphRevision] = useState(0);
  const [graphIssues, setGraphIssues] = useState<GraphValidationIssue[]>([]);
  const [graphIssuesNeedRecheck, setGraphIssuesNeedRecheck] = useState(false);
  const [runState, setRunState] = useState<RunState>(initialRunState);
  const [workflowDialogMode, setWorkflowDialogMode] =
    useState<WorkflowDialogMode>(null);
  const [editingWorkflowId, setEditingWorkflowId] = useState<string | null>(null);
  const [workflowNameDraft, setWorkflowNameDraft] = useState("");
  const [appError, setAppError] = useState("");
  const graphRevisionRef = useRef(graphRevision);
  const savedGraphRevisionRef = useRef(savedGraphRevision);

  useEffect(() => {
    graphRevisionRef.current = graphRevision;
  }, [graphRevision]);

  useEffect(() => {
    savedGraphRevisionRef.current = savedGraphRevision;
  }, [savedGraphRevision]);

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

  useEffect(() => {
    if (
      !graphAutosaveEnabled ||
      !detail ||
      !workflowGraph ||
      graphRevision === savedGraphRevision
    ) {
      return;
    }

    const workflowId = detail.workflow.id;
    const graphToSave = workflowGraph;
    const revisionToSave = graphRevision;

    const timeoutId = window.setTimeout(() => {
      void (async () => {
        setGraphSaveStatus("saving");
        try {
          await saveWorkflowGraph(workflowId, graphToSave);
          setSavedGraphRevision((current) => Math.max(current, revisionToSave));
          if (graphRevisionRef.current === revisionToSave) {
            setGraphSaveStatus("saved");
            setAppError("");
          }
        } catch (error) {
          if (graphRevisionRef.current === revisionToSave) {
            setGraphSaveStatus("failed");
          }
          setAppError(commandMessage(error));
        }
      })();
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [
    detail,
    graphAutosaveEnabled,
    graphRevision,
    savedGraphRevision,
    workflowGraph,
  ]);

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
        setWorkflowSettings(null);
        setGraphIssues([]);
        setGraphIssuesNeedRecheck(false);
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
      try {
        setWorkflowSettings(await getWorkflowSettings(id));
      } catch {
        setWorkflowSettings(
          defaultWorkflowSettings({
            workflowId: id,
            workflowName: loaded.workflow.name,
            createdAt: loaded.workflow.created_at,
            updatedAt: loaded.workflow.updated_at,
          }),
        );
      }
      setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
      graphRevisionRef.current = 0;
      savedGraphRevisionRef.current = 0;
      setGraphRevision(0);
      setSavedGraphRevision(0);
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
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
    void openWorkflowSettings(workflow, "general");
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
      setWorkflowSettings(null);
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      setScreen("list");
    }
    await loadWorkflows();
  }

  async function duplicateWorkflow(workflow: WorkflowSummary) {
    setAppError("");
    const copyName = `Copy of ${workflow.name}`;

    try {
      const exported = await exportWorkflow(workflow.id);
      const graph = await getWorkflowGraph(workflow.id);
      const imported = await importWorkflow(exported);
      const copiedWorkflowId = imported.workflow.id;

      await saveWorkflowGraph(copiedWorkflowId, graph);
      await renameWorkflowCommand(copiedWorkflowId, copyName);

      if (exported.settings) {
        await saveWorkflowSettingsSection(copiedWorkflowId, "general", {
          ...exported.settings.general,
          name: copyName,
        });
      }

      await loadWorkflows();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function persistCurrentGraph() {
    if (!detail || !workflowGraph) return;
    setAppError("");
    setGraphSaveStatus("saving");

    try {
      await saveWorkflowGraph(detail.workflow.id, workflowGraph);
      setSavedGraphRevision(graphRevisionRef.current);
      savedGraphRevisionRef.current = graphRevisionRef.current;
      setGraphSaveStatus(graphAutosaveEnabled ? "saved" : "off");
      await loadWorkflows();
      return true;
    } catch (error) {
      setGraphSaveStatus("failed");
      setAppError(commandMessage(error));
      return false;
    }
  }

  async function persistWorkflowSettingsSection(
    section: WorkflowSettingsSectionId,
    { force = false } = {},
  ) {
    if (!workflowSettings) return true;
    if (!force && workflowSettingsSaveStatuses[section] === "saved") return true;
    setAppError("");
    setWorkflowSettingsSaveStatuses((current) => ({
      ...current,
      [section]: "saving",
    }));

    try {
      const saved = await saveWorkflowSettingsSection(
        workflowSettings.workflow_id,
        section,
        workflowSettings[section],
      );
      const nextSettings = isWorkflowSettings(saved) ? saved : workflowSettings;
      setWorkflowSettings(nextSettings);
      if (section === "general") {
        updateLoadedWorkflowName(nextSettings.general.name);
      }
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [section]: "saved",
      }));
      await loadWorkflows();
      return true;
    } catch (error) {
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [section]: "failed",
      }));
      setAppError(commandMessage(error));
      return false;
    }
  }

  async function persistDirtyWorkflowSettings() {
    for (const section of Object.keys(workflowSettingsSaveStatuses) as WorkflowSettingsSectionId[]) {
      if (workflowSettingsSaveStatuses[section] === "unsaved") {
        const saved = await persistWorkflowSettingsSection(section, { force: true });
        if (!saved) return false;
      }
    }

    return true;
  }

  async function runGraph() {
    if (!detail || !workflowGraph) return;
    setAppError("");

    try {
      const saved = await persistCurrentGraph();
      if (!saved) return;
      const settingsSaved = await persistDirtyWorkflowSettings();
      if (!settingsSaved) return;
      const state = await runWorkflowCommand(detail.workflow.id);
      setGraphIssues([]);
      setGraphIssuesNeedRecheck(false);
      setRunState(normalizeRunState(state));
    } catch (error) {
      setAppError(commandMessage(error));
      if (workflowGraph) {
        try {
          setGraphIssues(await validateWorkflowGraph(workflowGraph));
          setGraphIssuesNeedRecheck(false);
        } catch {
          // Keep the command error as the primary system issue when validation cannot run.
        }
      }
    }
  }

  async function validateGraph() {
    if (!workflowGraph) return;
    setAppError("");

    try {
      setGraphIssues(await validateWorkflowGraph(workflowGraph));
      setGraphIssuesNeedRecheck(false);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function saveGraph() {
    await persistCurrentGraph();
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

  function openSettings() {
    setScreen("settings");
    setAppError("");
  }

  function updateGraphAutosaveEnabled(enabled: boolean) {
    setGraphAutosaveEnabled(enabled);
    writeGraphAutosaveEnabled(enabled);
    if (!enabled) {
      setGraphSaveStatus("off");
      return;
    }

    setGraphSaveStatus(
      graphRevisionRef.current === savedGraphRevisionRef.current ? "saved" : "unsaved",
    );
  }

  const changeWorkflowGraph = useCallback((nextGraph: WorkflowGraph) => {
    setWorkflowGraph(nextGraph);
    setGraphIssuesNeedRecheck((current) => current || graphIssues.length > 0);
    setGraphRevision((current) => {
      const nextRevision = current + 1;
      graphRevisionRef.current = nextRevision;
      return nextRevision;
    });
    setGraphSaveStatus(graphAutosaveEnabled ? "unsaved" : "off");
  }, [graphAutosaveEnabled, graphIssues.length]);

  const changeWorkflowSettings = useCallback(
    (nextSettings: WorkflowSettings) => {
      setWorkflowSettings(nextSettings);
      setWorkflowSettingsSaveStatuses((current) => ({
        ...current,
        [workflowSettingsActiveSection]: "unsaved",
      }));
    },
    [workflowSettingsActiveSection],
  );

  async function openWorkflowSettings(
    workflow: WorkflowSummary,
    section: WorkflowSettingsSectionId,
  ) {
    setAppError("");
    setWorkflowSettingsActiveSection(section);

    try {
      setWorkflowSettings(await getWorkflowSettings(workflow.id));
    } catch {
      setWorkflowSettings(
        defaultWorkflowSettings({
          workflowId: workflow.id,
          workflowName: workflow.name,
          createdAt: workflow.created_at,
          updatedAt: workflow.updated_at,
        }),
      );
    }
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
    setWorkflowSettingsDialogOpen(true);
  }

  function openDetailWorkflowSettings(section: WorkflowSettingsSectionId) {
    if (!detail) return;
    if (!workflowSettings) {
      setWorkflowSettings(
        defaultWorkflowSettings({
          workflowId: detail.workflow.id,
          workflowName: detail.workflow.name,
          createdAt: detail.workflow.created_at,
          updatedAt: detail.workflow.updated_at,
        }),
      );
    }
    setWorkflowSettingsActiveSection(section);
    setWorkflowSettingsDialogOpen(true);
  }

  function updateLoadedWorkflowName(name: string) {
    setDetail((current) =>
      current
        ? {
            ...current,
            workflow: {
              ...current.workflow,
              name,
            },
          }
        : current,
    );
    setWorkflows((current) =>
      current.map((workflow) =>
        workflow.id === workflowSettings?.workflow_id
          ? { ...workflow, name }
          : workflow,
      ),
    );
  }

  const isRunning = runState.status === "running";

  return (
    <AppShell
      activeItem={screen === "settings" ? "settings" : "workflows"}
      sidebarCollapsed={sidebarCollapsed}
      onOpenSettings={openSettings}
      onOpenWorkflows={backToList}
      onToggleSidebar={() => setSidebarCollapsed((current) => !current)}
    >
      {screen === "settings" ? (
        <SettingsPage
          graphAutosaveEnabled={graphAutosaveEnabled}
          onGraphAutosaveEnabledChange={updateGraphAutosaveEnabled}
        />
      ) : screen === "detail" && detail ? (
        <>
          <WorkflowDetailPage
            detail={detail}
            isRunning={isRunning}
            appError={appError}
            graphSaveStatus={graphSaveStatusLabel(graphSaveStatus)}
            runState={runState}
            workflowGraph={workflowGraph}
            graphIssues={graphIssues}
            graphIssuesNeedRecheck={graphIssuesNeedRecheck}
            onBack={backToList}
            onOpenWorkflowSettings={() => openDetailWorkflowSettings("browser")}
            onStopRun={stopRun}
            onGraphChange={changeWorkflowGraph}
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
          onDuplicateWorkflow={duplicateWorkflow}
          onCloseWorkflowDialog={closeWorkflowDialog}
          onOpenWorkflow={openWorkflow}
          onDeleteWorkflow={deleteWorkflow}
        />
      )}
      <WorkflowSettingsDialog
        open={workflowSettingsDialogOpen}
        settings={workflowSettings}
        activeSection={workflowSettingsActiveSection}
        saveStatuses={Object.fromEntries(
          Object.entries(workflowSettingsSaveStatuses).map(([section, status]) => [
            section,
            workflowSettingsSaveStatusLabel(status),
          ]),
        )}
        error={appError}
        onOpenChange={setWorkflowSettingsDialogOpen}
        onActiveSectionChange={setWorkflowSettingsActiveSection}
        onSettingsChange={changeWorkflowSettings}
        onSaveSection={async (section) => {
          await persistWorkflowSettingsSection(section, { force: true });
        }}
      />
    </AppShell>
  );
}

function settingsSaveStatuses(status: WorkflowSettingsSaveStatus) {
  return {
    general: status,
    execution: status,
    browser: status,
    environment: status,
    inputs: status,
    triggers: status,
    advanced: status,
  };
}

function isWorkflowSettings(value: unknown): value is WorkflowSettings {
  return Boolean(
    value &&
      typeof value === "object" &&
      "workflow_id" in value &&
      "general" in value &&
      "browser" in value,
  );
}

export default App;
