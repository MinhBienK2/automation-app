import type { ReactNode } from "react";
import type {
  BrowserProfile,
  DesktopTarget,
  GraphValidationIssue,
  IdentityLabOverview,
  IdentityLabTarget,
  OperationsNavigationTarget,
  Project,
  ProjectCollection,
  ProjectPackage,
  ProjectPackagePreview,
  ProjectStats,
  RunState,
  Schedule,
  ScheduleEvent,
  VariableAssignment,
  Workflow,
  WorkflowDetail,
  WorkflowGraph,
  WorkflowPackagePreview,
  WorkflowPackageSection,
  WorkflowRunFromSelectedMode,
  WorkflowRunSnapshot,
  WorkflowSettings,
  WorkflowSettingsSectionId,
} from "../types/workflow";
import type { AppScreen } from "../shared/types/workspaceContracts";
import type { ThemePreferences } from "./useThemePreferences";
import { OperationsOverviewPage } from "../features/overview/pages/OperationsOverviewPage";
import { SettingsPage } from "../features/settings/pages/SettingsPage";
import { SettingsHelpPage } from "../features/settings/pages/SettingsHelpPage";
import { SchedulesPage } from "../features/schedules/pages/SchedulesPage";
import { AdminPanel } from "../features/auth/pages/AdminPanel";
import { AdminBackupsPanel } from "../features/auth/pages/AdminBackupsPanel";
import { SubflowDetailPage } from "../features/workflows/pages/SubflowDetailPage";
import { ProjectsWorkspaceContainer } from "../features/projects/containers/ProjectsWorkspaceContainer";
import { WorkflowDetailWorkspaceContainer } from "../features/workflows/containers/WorkflowDetailWorkspaceContainer";
import { WorkflowSettingsDialog } from "../features/workflows/components/dialogs/WorkflowSettingsDialog";
import { UnsavedChangesDialog } from "../components/ui/unsaved-changes-dialog";
import { isRouteAllowed } from "./routePermissions";
import { createSubflow, getSubflowGraph, saveSubflowGraph, setWorkflowDesktopTarget } from "../lib/api/workflowApi";
import { commandMessage } from "../lib/workflowUi";
import { cloneWorkflowSettings, graphSaveStatusLabel } from "../lib/appState";

import type { AppWorkspaceRoutesProps } from "./appWorkspaceRoutesTypes";

export function AppWorkspaceRoutes(props: AppWorkspaceRoutesProps): ReactNode {
  const {
    nav,
    auth,
    appError,
    setAppError,
    showToast,
    operationsOverview,
    operationsOverviewLoading,
    loadOperationsOverview,
    navigateFromOverview,
    graphAutosaveEnabled,
    graphAutosaveDelayMs,
    onGraphAutosaveEnabledChange,
    onGraphAutosaveDelayMsChange,
    setGraphSaveStatus,
    settingsDiagnostics,
    settingsDiagnosticsLoading,
    settingsDiagnosticsError,
    settingsMaintenanceMessage,
    loadSettingsDiagnostics,
    installSettingsBrowserBinary,
    cleanupSettingsBrowserProfiles,
    themePreferences,
    schedules,
    schedulesLoading,
    focusedScheduleId,
    scheduleEvents,
    createScheduleItem,
    updateScheduleItem,
    removeSchedule,
    toggleSchedule,
    loadScheduleHistory,
    projectsWorkspace,
    selectedProject,
    projectStats,
    importProjectPackageFile,
    exportProjectPackageFile,
    subflowsWorkspace,
    selectedBrowserProfiles,
    selectedProjectWorkflows,
    identityLabOverview,
    identityLabLoading,
    identityLabTarget,
    loadIdentityLabOverview,
    selectIdentity,
    openIdentityWorkflowSettings,
    closeIdentitySession,
    resetIdentityFromLab,
    openIdentityTarget,
    createBrowserProfile,
    updateBrowserProfile,
    deleteBrowserProfile,
    selectedDesktopTargets,
    workflowsWorkspace,
    settingsWorkspace,
    runSnapshots,
    runWorkspace,
    openExportPackageDialog,
    importWorkflowPackageFile,
    recordingWorkspace,
    packageDialogs,
    selectedSubflowProjectName,
    canSaveSubflowGraph,
    detailProjectName,
    isRunning,
    canSaveWorkflowGraph,
    detailRunState,
    workflowGraph,
    graphIssues,
    graphIssuesNeedRecheck,
    profileVariables,
    openDetailWorkflowSettings,
    detailRunSnapshot,
    graphState,
    runFromSelectedAvailability,
    graphSaveStatus,
    workflowSettings,
    workflowSettingsDialogOpen,
    workflowSettingsActiveSection,
    workflowProfileDraftId,
    workflowSettingsSaveStatuses,
    setWorkflowSettingsDialogOpen,
    setWorkflowProfileDraftId,
    setWorkflowSettingsSavedSnapshot,
    setWorkflowSettingsSaveStatuses,
    graphExitDialogOpen,
    clearGraphExitNavigation,
    discardGraphExitChangesAndNavigate,
    saveGraphExitChangesAndNavigate,
  } = props;

  return (
    <>
      {nav.screen === "overview" ? (
        <OperationsOverviewPage
          overview={operationsOverview}
          loading={operationsOverviewLoading}
          error={appError}
          focus={nav.overviewFocus}
          onRefresh={loadOperationsOverview}
          onOpenWorkflows={() => nav.openProjects("workflows")}
          onNavigate={navigateFromOverview}
          diagnostics={settingsDiagnostics}
          diagnosticsLoading={settingsDiagnosticsLoading}
          diagnosticsError={settingsDiagnosticsError}
          onRefreshDiagnostics={loadSettingsDiagnostics}
        />
      ) : nav.screen === "settings" ? (
        <SettingsPage
          graphAutosaveEnabled={graphAutosaveEnabled}
          graphAutosaveDelayMs={graphAutosaveDelayMs}
          maintenanceMessage={settingsMaintenanceMessage}
          onGraphAutosaveEnabledChange={onGraphAutosaveEnabledChange}
          onGraphAutosaveDelayMsChange={onGraphAutosaveDelayMsChange}
          onInstallBinary={installSettingsBrowserBinary}
          onCleanupProfiles={cleanupSettingsBrowserProfiles}
          theme={themePreferences.theme}
          accent={themePreferences.accent}
          density={themePreferences.density}
          onThemeChange={themePreferences.setTheme}
          onAccentChange={themePreferences.setAccent}
          onDensityChange={themePreferences.setDensity}
        />
      ) : nav.screen === "admin-users" && isRouteAllowed("admin-users", auth.mode, auth.currentUser?.role) ? (
        <AdminPanel currentUser={auth.currentUser} />
      ) : nav.screen === "admin-backups" && isRouteAllowed("admin-backups", auth.mode, auth.currentUser?.role) ? (
        <AdminBackupsPanel showToast={showToast} />
      ) : nav.screen === "settings-help" ? (
        <SettingsHelpPage />
      ) : nav.screen === "schedules" ? (
        <SchedulesPage
          schedules={schedules}
          schedulesLoading={schedulesLoading}
          focusedScheduleId={focusedScheduleId}
          scheduleEvents={scheduleEvents}
          scheduleEventsLoading={schedulesLoading}
          workflowOptions={workflowsWorkspace.workflows}
          onCreateSchedule={createScheduleItem}
          onUpdateSchedule={updateScheduleItem}
          onDeleteSchedule={removeSchedule}
          onToggleSchedule={toggleSchedule}
          onLoadEvents={loadScheduleHistory}
          onOpenWorkflow={(workflowId) => {
            void nav.navigateToMissionControlTarget({ type: "workflow", workflow_id: workflowId });
          }}
        />
      ) : nav.screen === "projects" ? (
        <ProjectsWorkspaceContainer
          projects={projectsWorkspace.projects}
          selectedProject={selectedProject}
          projectCollection={projectsWorkspace.projectCollection}
          projectsBrowseMode={nav.projectsBrowseMode}
          projectStats={projectStats}
          appError={appError}
          setAppError={setAppError}
          onSelectProject={(projectId) => {
            void projectsWorkspace.selectProject(projectId);
            nav.setProjectsBrowseMode("detail");
          }}
          onCreateProject={async (input) => {
            await projectsWorkspace.createProject(input);
            nav.setProjectsBrowseMode("detail");
          }}
          onImportProjectPackageFile={importProjectPackageFile}
          onCollectionChange={(coll) => projectsWorkspace.setProjectCollection(coll)}
          onDuplicateProject={async (projectId) => {
            await projectsWorkspace.duplicateProject(projectId);
            nav.setProjectsBrowseMode("detail");
          }}
          onExportProject={(projectId) => {
            void exportProjectPackageFile(projectId);
          }}
          onDeleteProject={(projectId) => {
            void projectsWorkspace.deleteProject(projectId);
          }}
          subflowsWorkspace={subflowsWorkspace}
          selectedBrowserProfiles={selectedBrowserProfiles}
          selectedProjectWorkflows={selectedProjectWorkflows}
          identityLabOverview={identityLabOverview}
          identityLabLoading={identityLabLoading}
          identityLabTarget={identityLabTarget}
          loadIdentityLabOverview={loadIdentityLabOverview}
          selectIdentity={selectIdentity}
          openIdentityWorkflowSettings={openIdentityWorkflowSettings}
          closeIdentitySession={closeIdentitySession}
          resetIdentityFromLab={resetIdentityFromLab}
          openIdentityTarget={openIdentityTarget}
          createBrowserProfile={createBrowserProfile}
          updateBrowserProfile={updateBrowserProfile}
          deleteBrowserProfile={deleteBrowserProfile}
          selectedDesktopTargets={selectedDesktopTargets}
          loadDesktopTargets={projectsWorkspace.loadDesktopTargets}
          updateProject={(id, input) => projectsWorkspace.updateProject(id, input)}
          exportProjectPackageFile={exportProjectPackageFile}
          workflowsWorkspace={workflowsWorkspace}
          openWorkflowSettings={settingsWorkspace.openWorkflowSettings}
          runSnapshots={runSnapshots}
          runWorkspace={runWorkspace}
          openExportPackageDialog={openExportPackageDialog}
          importWorkflowPackageFile={importWorkflowPackageFile}
          recordingWorkspace={recordingWorkspace}
          packageDialogs={packageDialogs}
        />
      ) : nav.screen === "subflow-detail" ? (
        <SubflowDetailPage
          subflow={subflowsWorkspace.selectedSubflow}
          projectName={selectedSubflowProjectName}
          usage={subflowsWorkspace.selectedSubflowUsage}
          graph={subflowsWorkspace.selectedSubflowGraph}
          graphSaveStatus={graphSaveStatusLabel(subflowsWorkspace.subflowGraphSaveStatus)}
          canSaveGraph={canSaveSubflowGraph}
          appError={appError}
          backLabel={
            subflowsWorkspace.subflowBackTarget.type === "workflow-detail"
              ? "Back to Workflow"
              : "Back to Subflows"
          }
          breadcrumbLabel={
            subflowsWorkspace.subflowBackTarget.type === "workflow-detail"
              ? subflowsWorkspace.subflowBackTarget.workflowName ?? "Workflow"
              : "Subflows"
          }
          onBack={nav.backFromSubflowDetail}
          onGraphChange={subflowsWorkspace.changeSubflowGraph}
          onSaveGraph={() => {
            void subflowsWorkspace.saveCurrentSubflowGraph();
          }}
          onUpdateSubflow={async (input) => {
            if (subflowsWorkspace.selectedSubflow) {
              await subflowsWorkspace.updateProjectSubflow(subflowsWorkspace.selectedSubflow, input);
            }
          }}
          isSavingGraph={subflowsWorkspace.subflowGraphSaveStatus === "saving"}
        />
      ) : nav.screen === "detail" && workflowsWorkspace.detail ? (
        <WorkflowDetailWorkspaceContainer
          detail={workflowsWorkspace.detail}
          projectName={detailProjectName}
          isRunning={isRunning}
          isStartingRun={runWorkspace.isStartingRun}
          appError={appError}
          graphSaveStatus={graphSaveStatusLabel(graphSaveStatus)}
          canSaveWorkflowGraph={canSaveWorkflowGraph}
          detailRunState={detailRunState}
          workflowGraph={workflowGraph!}
          graphIssues={graphIssues}
          subflowOptions={subflowsWorkspace.subflows}
          graphIssuesNeedRecheck={graphIssuesNeedRecheck}
          workflowSettings={workflowSettings}
          profileVariables={profileVariables}
          onBack={nav.backToList}
          openDetailWorkflowSettings={() => openDetailWorkflowSettings("browser_launch")}
          stopRun={(runId) => runWorkspace.stopRun(runId)}
          detailRunSnapshot={detailRunSnapshot}
          onCreateSubflowFromSelection={async (input) => {
            setAppError("");
            const projectId = workflowsWorkspace.detail?.workflow.project_id ?? (await projectsWorkspace.ensureProjectId());
            try {
              const createdSubflow = await createSubflow(projectId, {
                name: input.name,
                description: null,
              });
              await saveSubflowGraph(createdSubflow.id, input.graph);
              await subflowsWorkspace.loadSubflowsForProject(projectId);
              return createdSubflow;
            } catch (error) {
              const message = commandMessage(error);
              setAppError(message);
              throw new Error(message);
            }
          }}
          onLoadSubflowGraph={getSubflowGraph}
          onOpenSubflowDetail={(subflowId) => {
            void subflowsWorkspace.openSubflowDetail(subflowId, {
              type: "workflow-detail",
              workflowId: workflowsWorkspace.detail!.workflow.id,
              workflowName: workflowsWorkspace.detail!.workflow.name,
            });
          }}
          onGraphChange={graphState.changeWorkflowGraph}
          onRunGraph={runWorkspace.runGraph}
          onRunGraphFromSelected={async (mode) => {
            if (workflowSettings) {
              workflowSettings.run_policy = {
                ...workflowSettings.run_policy,
                run_from_selected_mode: mode,
              };
            }
            await runWorkspace.runGraphFromSelectedNode(mode);
          }}
          onSelectedGraphNodeChange={graphState.setSelectedGraphNodeId}
          runFromSelectedAvailability={runFromSelectedAvailability}
          onSaveGraph={graphState.saveGraph}
          onValidateGraph={graphState.validateGraph}
          onRestoreRevision={async (restoredGraph) => {
            graphState.changeWorkflowGraph(restoredGraph);
            await subflowsWorkspace.loadSubflowsForProject(workflowsWorkspace.detail?.workflow.project_id);
          }}
          isSavingGraph={graphSaveStatus === "saving"}
        />
      ) : null}

      <WorkflowSettingsDialog
        open={workflowSettingsDialogOpen}
        settings={workflowSettings}
        activeSection={workflowSettingsActiveSection}
        browserProfiles={selectedBrowserProfiles}
        selectedBrowserProfileId={workflowProfileDraftId}
        surface={workflowsWorkspace.detail?.workflow.surface ?? "web"}
        desktopTargets={selectedDesktopTargets}
        selectedDesktopTargetId={workflowsWorkspace.detail?.workflow.desktop_target_id ?? null}
        error={appError}
        hasUnsavedChanges={Object.values(workflowSettingsSaveStatuses).some(
          (status) => status === "unsaved",
        )}
        onOpenChange={(open) => {
          if (open) {
            setWorkflowSettingsDialogOpen(true);
            return;
          }
          settingsWorkspace.closeWorkflowSettingsDialog();
        }}
        onActiveSectionChange={settingsWorkspace.setWorkflowSettingsActiveSection}
        onDesktopTargetChange={(targetId) => {
          const workflowId = workflowsWorkspace.detail?.workflow.id;
          if (!workflowId) return;
          void (async () => {
            try {
              await setWorkflowDesktopTarget(workflowId, targetId);
              await workflowsWorkspace.performOpenWorkflow(workflowId);
              setAppError("");
            } catch (error) {
              setAppError(commandMessage(error));
            }
          })();
        }}
        onBrowserProfileChange={(profileId) => {
          setWorkflowProfileDraftId(profileId);
          const current = workflowSettings;
          const selectedProfile = selectedBrowserProfiles.find(
            (profile) => profile.id === profileId,
          );
          if (current && selectedProfile) {
            settingsWorkspace.changeWorkflowSettings({
              ...current,
              browser_launch: selectedProfile.browser_launch,
            });
          }
          setWorkflowSettingsSaveStatuses({
            ...workflowSettingsSaveStatuses,
            browser_launch: "unsaved",
          });
        }}
        onSettingsChange={settingsWorkspace.changeWorkflowSettings}
        onSaveSettings={async () => {
          await settingsWorkspace.saveWorkflowSettingsAndClose();
          if (workflowSettings) {
            setWorkflowSettingsSavedSnapshot(cloneWorkflowSettings(workflowSettings));
          }
          showToast("Workflow settings saved.");
        }}
        onDiscardChanges={settingsWorkspace.discardWorkflowSettingsChanges}
        saveStatuses={workflowSettingsSaveStatuses}
      />

      <UnsavedChangesDialog
        open={graphExitDialogOpen}
        onKeepEditing={clearGraphExitNavigation}
        onDiscardChanges={discardGraphExitChangesAndNavigate}
        onSaveAndClose={saveGraphExitChangesAndNavigate}
      />
    </>
  );
}

