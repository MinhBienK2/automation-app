import { useCallback, useEffect, useRef, useState } from "react";
import { SettingsPage } from "./features/settings/pages/SettingsPage";
import { WorkflowDetailPage } from "./features/workflows/pages/WorkflowDetailPage";
import { WorkflowListPage } from "./features/workflows/pages/WorkflowListPage";
import { AppShell } from "./layouts/AppShell";
import {
  createWorkflow as createWorkflowCommand,
  deleteWorkflow as deleteWorkflowCommand,
  duplicateWorkflow as duplicateWorkflowCommand,
  exportWorkflowPackage,
  getWorkflowGraph,
  getRunState,
  getWorkflow,
  getWorkflowSettings,
  importWorkflowPackage,
  listWorkflows,
  previewWorkflowPackage,
  renameWorkflow as renameWorkflowCommand,
  runWorkflow as runWorkflowCommand,
  saveWorkflowPackageFile,
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
import { Button } from "./components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./components/ui/dialog";
import {
  PackageFlowCheckbox,
  PackageSectionPicker,
  sectionLabel,
} from "./features/workflows/components/WorkflowPackageOptions";
import type {
  GraphValidationIssue,
  RunState,
  WorkflowGraph,
  WorkflowDetail,
  WorkflowPackage,
  WorkflowPackagePreview,
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
const workflowPackageSections: WorkflowSettingsSectionId[] = [
  "general",
  "run_policy",
  "browser_launch",
  "environment",
];
const workflowPackageFileSizeLimitBytes = 5 * 1024 * 1024;

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
  const [workflowSettingsSavedSnapshot, setWorkflowSettingsSavedSnapshot] =
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
  const [deleteWorkflowCandidate, setDeleteWorkflowCandidate] =
    useState<WorkflowSummary | null>(null);
  const [exportPackageWorkflow, setExportPackageWorkflow] =
    useState<WorkflowSummary | null>(null);
  const [exportPackageIncludeFlow, setExportPackageIncludeFlow] = useState(true);
  const [exportPackageSections, setExportPackageSections] =
    useState<WorkflowSettingsSectionId[]>(workflowPackageSections);
  const [importPackage, setImportPackage] = useState<WorkflowPackage | null>(null);
  const [importPackagePreview, setImportPackagePreview] =
    useState<WorkflowPackagePreview | null>(null);
  const [importPackageIncludeFlow, setImportPackageIncludeFlow] = useState(true);
  const [importPackageSections, setImportPackageSections] =
    useState<WorkflowSettingsSectionId[]>([]);
  const [appError, setAppError] = useState("");
  const [toastMessage, setToastMessage] = useState("");
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
        const loadedSettings = await getWorkflowSettings(id);
        setWorkflowSettings(loadedSettings);
        setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(loadedSettings));
      } catch {
        const fallbackSettings = defaultWorkflowSettings({
          workflowId: id,
          workflowName: loaded.workflow.name,
          createdAt: loaded.workflow.created_at,
          updatedAt: loaded.workflow.updated_at,
        });
        setWorkflowSettings(fallbackSettings);
        setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(fallbackSettings));
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

  function deleteWorkflow(id: string) {
    setAppError("");
    setDeleteWorkflowCandidate(
      workflows.find((workflow) => workflow.id === id) ?? null,
    );
  }

  async function confirmDeleteWorkflow() {
    if (!deleteWorkflowCandidate) return;
    const id = deleteWorkflowCandidate.id;
    setAppError("");

    try {
      await deleteWorkflowCommand(id);
      setDeleteWorkflowCandidate(null);
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
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function duplicateWorkflow(workflow: WorkflowSummary) {
    setAppError("");
    const copyName = `Copy of ${workflow.name}`;

    try {
      await duplicateWorkflowCommand(workflow.id, copyName);
      await loadWorkflows();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function openExportPackageDialog(workflow: WorkflowSummary) {
    setAppError("");
    setExportPackageWorkflow(workflow);
    setExportPackageIncludeFlow(true);
    setExportPackageSections(workflowPackageSections);
  }

  function closeExportPackageDialog() {
    setExportPackageWorkflow(null);
    setExportPackageIncludeFlow(true);
    setExportPackageSections(workflowPackageSections);
    setAppError("");
  }

  async function submitExportPackage(event: React.FormEvent) {
    event.preventDefault();
    if (!exportPackageWorkflow) return;
    if (!exportPackageIncludeFlow && exportPackageSections.length === 0) {
      setAppError("Select at least Flow or one Settings section");
      return;
    }

    setAppError("");

    try {
      const packageValue = await exportWorkflowPackage(exportPackageWorkflow.id, {
        include_flow: exportPackageIncludeFlow,
        settings_sections: exportPackageSections,
      });
      const filePath = await saveWorkflowPackageFile(packageValue);
      if (!filePath) return;
      closeExportPackageDialog();
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  async function importWorkflowPackageFile(file: File | null) {
    if (!file) return;
    setAppError("");
    if (file.size > workflowPackageFileSizeLimitBytes) {
      setAppError("Workflow package file must be 5 MB or smaller");
      return;
    }

    try {
      const packageValue = JSON.parse(await file.text()) as WorkflowPackage;
      const preview = await previewWorkflowPackage(packageValue);
      setImportPackage(packageValue);
      setImportPackagePreview(preview);
      setImportPackageIncludeFlow(preview.includes_flow);
      setImportPackageSections(preview.settings_sections);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }

  function closeImportPackageDialog() {
    setImportPackage(null);
    setImportPackagePreview(null);
    setImportPackageIncludeFlow(true);
    setImportPackageSections([]);
    setAppError("");
  }

  async function submitImportPackage(event: React.FormEvent) {
    event.preventDefault();
    if (!importPackage) return;
    if (!importPackageIncludeFlow && importPackageSections.length === 0) {
      setAppError("Select at least Flow or one Settings section");
      return;
    }

    setAppError("");

    try {
      const imported = await importWorkflowPackage(importPackage, {
        include_flow: importPackageIncludeFlow,
        settings_sections: importPackageSections,
      });
      closeImportPackageDialog();
      await loadWorkflows();
      await openWorkflow(imported.workflow.id);
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
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(nextSettings));
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

  async function persistWorkflowSettings() {
    const saved = await persistDirtyWorkflowSettings();
    if (!saved) return false;
    if (workflowSettings) {
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(workflowSettings));
    }
    setToastMessage("Workflow settings saved.");
    window.setTimeout(() => setToastMessage(""), 2200);
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
      const loadedSettings = await getWorkflowSettings(workflow.id);
      setWorkflowSettings(loadedSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(loadedSettings));
    } catch {
      const fallbackSettings = defaultWorkflowSettings({
        workflowId: workflow.id,
        workflowName: workflow.name,
        createdAt: workflow.created_at,
        updatedAt: workflow.updated_at,
      });
      setWorkflowSettings(fallbackSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(fallbackSettings));
    }
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
    setWorkflowSettingsDialogOpen(true);
  }

  function openDetailWorkflowSettings(section: WorkflowSettingsSectionId) {
    if (!detail) return;
    if (!workflowSettings) {
      const fallbackSettings = defaultWorkflowSettings({
        workflowId: detail.workflow.id,
        workflowName: detail.workflow.name,
        createdAt: detail.workflow.created_at,
        updatedAt: detail.workflow.updated_at,
      });
      setWorkflowSettings(fallbackSettings);
      setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(fallbackSettings));
    }
    setWorkflowSettingsActiveSection(section);
    setWorkflowSettingsDialogOpen(true);
  }

  function closeWorkflowSettingsDialog() {
    setWorkflowSettingsDialogOpen(false);
    setAppError("");
  }

  function discardWorkflowSettingsChanges() {
    if (workflowSettingsSavedSnapshot) {
      setWorkflowSettings(cloneWorkflowSettings(workflowSettingsSavedSnapshot));
    }
    setWorkflowSettingsSaveStatuses(settingsSaveStatuses("saved"));
    closeWorkflowSettingsDialog();
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
            onOpenWorkflowSettings={() => openDetailWorkflowSettings("browser_launch")}
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
          onOpenExportWorkflow={openExportPackageDialog}
          onImportWorkflowPackageFile={importWorkflowPackageFile}
          onCloseWorkflowDialog={closeWorkflowDialog}
          onOpenWorkflow={openWorkflow}
          onDeleteWorkflow={deleteWorkflow}
        />
      )}
      <WorkflowSettingsDialog
        open={workflowSettingsDialogOpen}
        settings={workflowSettings}
        activeSection={workflowSettingsActiveSection}
        error={appError}
        hasUnsavedChanges={Object.values(workflowSettingsSaveStatuses).some(
          (status) => status === "unsaved",
        )}
        onOpenChange={(open) => {
          if (open) {
            setWorkflowSettingsDialogOpen(true);
            return;
          }
          closeWorkflowSettingsDialog();
        }}
        onActiveSectionChange={setWorkflowSettingsActiveSection}
        onSettingsChange={changeWorkflowSettings}
        onSaveSettings={persistWorkflowSettings}
        onDiscardChanges={discardWorkflowSettingsChanges}
      />
      {toastMessage ? (
        <div className="toast-alert app-toast" role="status">
          {toastMessage}
        </div>
      ) : null}
      <Dialog
        open={Boolean(exportPackageWorkflow)}
        onOpenChange={(open) => {
          if (!open) closeExportPackageDialog();
        }}
      >
        {exportPackageWorkflow ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Package</p>
              <DialogTitle>Export Workflow</DialogTitle>
              <DialogDescription>
                Choose the workflow parts to include in the JSON package.
              </DialogDescription>
            </DialogHeader>
            <form className="workflow-dialog-form" onSubmit={submitExportPackage}>
              <PackageFlowCheckbox
                checked={exportPackageIncludeFlow}
                label="Flow"
                onChange={setExportPackageIncludeFlow}
              />
              <PackageSectionPicker
                availableSections={workflowPackageSections}
                selectedSections={exportPackageSections}
                onSelectedSectionsChange={setExportPackageSections}
              />
              {appError ? <p className="field-error">{appError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  Export
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeExportPackageDialog}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(importPackage && importPackagePreview)}
        onOpenChange={(open) => {
          if (!open) closeImportPackageDialog();
        }}
      >
        {importPackagePreview ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Package</p>
              <DialogTitle>Import Workflow</DialogTitle>
              <DialogDescription>
                Import creates a new workflow and never overwrites an existing one.
              </DialogDescription>
            </DialogHeader>
            <form className="workflow-dialog-form" onSubmit={submitImportPackage}>
              <dl className="package-preview-list">
                <div>
                  <dt>Name</dt>
                  <dd>{importPackagePreview.workflow_name}</dd>
                </div>
                <div>
                  <dt>Included</dt>
                  <dd>
                    {[
                      importPackagePreview.includes_flow ? "Flow" : null,
                      ...importPackagePreview.settings_sections.map(sectionLabel),
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
              </dl>
              <PackageFlowCheckbox
                checked={importPackageIncludeFlow}
                disabled={!importPackagePreview.includes_flow}
                label="Flow"
                onChange={setImportPackageIncludeFlow}
              />
              <PackageSectionPicker
                availableSections={importPackagePreview.settings_sections}
                selectedSections={importPackageSections}
                onSelectedSectionsChange={setImportPackageSections}
              />
              {importPackagePreview.omitted_fields.length > 0 ? (
                <p className="muted">
                  Sanitized fields: {importPackagePreview.omitted_fields.join(", ")}
                </p>
              ) : null}
              {appError ? <p className="field-error">{appError}</p> : null}
              <DialogFooter className="form-actions">
                <Button shape="pill" type="submit">
                  Import
                </Button>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={closeImportPackageDialog}
                >
                  Cancel
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        ) : null}
      </Dialog>
      <Dialog
        open={Boolean(deleteWorkflowCandidate)}
        onOpenChange={(open) => {
          if (!open) setDeleteWorkflowCandidate(null);
        }}
      >
        {deleteWorkflowCandidate ? (
          <DialogContent className="workflow-dialog">
            <DialogHeader>
              <p className="eyebrow">Workflow</p>
              <DialogTitle>Delete Workflow</DialogTitle>
              <DialogDescription>
                This removes {deleteWorkflowCandidate.name} from the app. This
                action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            {appError ? <p className="field-error">{appError}</p> : null}
            <DialogFooter className="form-actions">
              <Button
                type="button"
                variant="destructive"
                onClick={() => {
                  void confirmDeleteWorkflow();
                }}
              >
                Delete Workflow
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => setDeleteWorkflowCandidate(null)}
              >
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        ) : null}
      </Dialog>
    </AppShell>
  );
}

function settingsSaveStatuses(status: WorkflowSettingsSaveStatus) {
  return {
    general: status,
    run_policy: status,
    browser_launch: status,
    environment: status,
  };
}

function cloneWorkflowSettings(settings: WorkflowSettings) {
  return JSON.parse(JSON.stringify(settings)) as WorkflowSettings;
}

function isWorkflowSettings(value: unknown): value is WorkflowSettings {
  return Boolean(
    value &&
      typeof value === "object" &&
      "workflow_id" in value &&
      "general" in value &&
      "browser_launch" in value,
  );
}

export default App;
