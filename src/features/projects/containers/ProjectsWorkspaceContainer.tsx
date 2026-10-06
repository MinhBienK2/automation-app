import type {
  BrowserProfile,
  DesktopTarget,
  IdentityLabOverview,
  IdentityLabTarget,
  Project,
  ProjectCollection,
  ProjectPackage,
  ProjectPackagePreview,
  ProjectStats,
  Workflow,
  WorkflowPackagePreview,
  WorkflowPackageSection,
  WorkflowRunSnapshot,
} from "../../../types/workflow";
import { ProjectsPage } from "../pages/ProjectsPage";
import { SubflowListPage } from "../../workflows/pages/SubflowListPage";
import { ProjectProfilesPanel } from "../components/ProjectProfilesPanel";
import { ProjectDesktopTargetsPanel } from "../components/ProjectDesktopTargetsPanel";
import { ProjectSettings } from "../components/ProjectSettings";
import { WorkflowListPage } from "../../workflows/pages/WorkflowListPage";
import { RecordingReviewDialog } from "../../workflows/components/dialogs/RecordingReviewDialog";
import { AppPackageDialogs } from "../../../app/AppPackageDialogs";
import { commandMessage } from "../../../lib/workflowUi";
import { createDesktopTarget, deleteDesktopTarget } from "../../../lib/api/workflowApi";

export type ProjectsWorkspaceContainerProps = {
  projects: Project[];
  selectedProject: Project | null;
  projectCollection: ProjectCollection;
  projectsBrowseMode: "list" | "detail";
  projectStats: ProjectStats | null;
  appError: string;
  setAppError: (error: string) => void;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { name: string; description?: string }) => Promise<void>;
  onImportProjectPackageFile: (file: File) => Promise<void>;
  onCollectionChange: (collection: ProjectCollection) => void;
  onDuplicateProject: (projectId: string) => Promise<void>;
  onExportProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;

  // Subflows
  subflowsWorkspace: {
    subflows: Array<{ id: string; name: string }>;
    subflowUsagesBySubflow: Record<string, number>;
    subflowsLoading: boolean;
    createProjectSubflow: (input: { name: string; description?: string | null }) => Promise<unknown>;
    updateProjectSubflow: (subflow: { id: string }, input: { name: string; description?: string | null }) => Promise<unknown>;
    duplicateProjectSubflow: (subflow: { id: string }) => Promise<unknown>;
    deleteProjectSubflow: (id: string) => Promise<unknown>;
    openSubflowDetail: (id: string, target: { type: "subflows" }) => Promise<void>;
    loadSubflowsForProject: () => Promise<void>;
    exportProjectSubflow: (subflow: { id: string; name: string }) => void;
    importProjectSubflowFile: (file: File) => Promise<void>;
  };

  // Profiles & Identity Lab
  selectedBrowserProfiles: BrowserProfile[];
  selectedProjectWorkflows: Workflow[];
  identityLabOverview: IdentityLabOverview | null;
  identityLabLoading: boolean;
  identityLabTarget: IdentityLabTarget;
  loadIdentityLabOverview: (target: IdentityLabTarget, projectId?: string) => Promise<void>;
  selectIdentity: (identityId: string) => void;
  openIdentityWorkflowSettings: (workflowId: string) => Promise<void>;
  closeIdentitySession: (workflowId: string, profileName: string, projectId?: string) => Promise<void>;
  resetIdentityFromLab: (workflowId: string, projectId?: string) => Promise<void>;
  openIdentityTarget: (target: IdentityLabTarget) => void;
  createBrowserProfile: (input: { name: string }) => Promise<unknown>;
  updateBrowserProfile: (profile: BrowserProfile, input: { name: string }) => Promise<unknown>;
  deleteBrowserProfile: (profileId: string, projectId?: string) => Promise<void>;

  // Desktop Targets
  selectedDesktopTargets: DesktopTarget[];
  loadDesktopTargets: (projectId: string | null) => Promise<void>;

  // Project Settings & Package
  updateProject: (id: string, input: { name: string; description?: string }) => Promise<unknown>;
  exportProjectPackageFile: (projectId?: string) => Promise<void>;

  // Workflows List & Workspace
  workflowsWorkspace: {
    workflowDialogMode: "create" | "edit" | null;
    workflowNameDraft: string;
    selectedProfileIdDraft: string | null;
    surfaceDraft: "web" | "desktop";
    selectedDesktopTargetIdDraft: string | null;
    setWorkflowNameDraft: (name: string) => void;
    setSelectedProfileIdDraft: (profileId: string | null) => void;
    setSurfaceDraft: (surface: "web" | "desktop") => void;
    setSelectedDesktopTargetIdDraft: (targetId: string | null) => void;
    submitWorkflowDialog: () => Promise<void>;
    openCreateWorkflowDialog: () => void;
    duplicateWorkflow: (workflow: Workflow) => Promise<void>;
    closeWorkflowDialog: () => void;
    openWorkflow: (id: string) => Promise<void>;
    deleteWorkflow: (workflow: Workflow) => void;
    deleteWorkflowCandidate: Workflow | null;
    confirmDeleteWorkflow: () => Promise<void>;
    cancelDeleteWorkflow: () => void;
    workflowDialogBusy: boolean;
  };
  openWorkflowSettings: (workflow: Workflow, section: "general") => Promise<void>;
  runSnapshots: Record<string, WorkflowRunSnapshot>;
  runWorkspace: {
    startingWorkflowId: string | null;
    runSavedWorkflow: (workflow: Workflow) => Promise<void>;
    stopRun: (runId: string) => Promise<void>;
  };
  openExportPackageDialog: (workflow: Workflow) => void;
  importWorkflowPackageFile: (file: File) => Promise<void>;

  // Recording
  recordingWorkspace: {
    recordingSession: unknown;
    recordingDraft: { mode?: string } | null;
    recordingWorkflowName: string;
    recordingBusy: boolean;
    startWorkflowRecording: (options: { profileId: string | null; surface: "web" | "desktop" }) => Promise<void>;
    setRecordingWorkflowName: (name: string) => void;
    stopWorkflowRecording: () => Promise<void>;
    discardWorkflowRecording: () => Promise<void>;
    saveReviewedRecording: (options: { workflow_name: string; add_terminal_success: boolean; save_mode: string }) => Promise<void>;
    updateRecordingStep: (index: number, step: unknown) => void;
  };

  // App Package Dialogs
  packageDialogs: {
    workflowPackageSections: WorkflowPackageSection[];
    exportPackageWorkflow: Workflow | null;
    exportPackageIncludeFlow: boolean;
    exportPackageSections: WorkflowPackageSection[];
    closeExportPackageDialog: () => void;
    submitExportPackage: () => Promise<void>;
    setExportPackageIncludeFlow: (include: boolean) => void;
    setExportPackageSections: (sections: WorkflowPackageSection[]) => void;
    importPackagePreview: WorkflowPackagePreview | null;
    importPackageIncludeFlow: boolean;
    importPackageSections: WorkflowPackageSection[];
    closeImportPackageDialog: () => void;
    submitImportPackage: () => Promise<void>;
    setImportPackageIncludeFlow: (include: boolean) => void;
    setImportPackageSections: (sections: WorkflowPackageSection[]) => void;
    isImportProjectPackageOpen: boolean;
    importProjectPackagePreview: ProjectPackagePreview | null;
    closeImportProjectPackageDialog: () => void;
    submitImportProjectPackage: (pack: ProjectPackage) => Promise<void>;
    isPackageActionBusy: boolean;
  };
};

export function ProjectsWorkspaceContainer(props: ProjectsWorkspaceContainerProps) {
  const {
    projects,
    selectedProject,
    projectCollection,
    projectsBrowseMode,
    projectStats,
    appError,
    setAppError,
    onSelectProject,
    onCreateProject,
    onImportProjectPackageFile,
    onCollectionChange,
    onDuplicateProject,
    onExportProject,
    onDeleteProject,
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
    loadDesktopTargets,
    updateProject,
    exportProjectPackageFile,
    workflowsWorkspace,
    openWorkflowSettings,
    runSnapshots,
    runWorkspace,
    openExportPackageDialog,
    importWorkflowPackageFile,
    recordingWorkspace,
    packageDialogs,
  } = props;

  return (
    <>
      <ProjectsPage
        projects={projects}
        selectedProject={selectedProject}
        activeCollection={projectCollection}
        browseMode={projectsBrowseMode}
        error={selectedProject ? "" : appError}
        projectStats={projectStats}
        onSelectProject={onSelectProject}
        onCreateProject={onCreateProject}
        onImportProjectPackageFile={onImportProjectPackageFile}
        onCollectionChange={onCollectionChange}
        onDuplicateProject={onDuplicateProject}
        onExportProject={onExportProject}
        onDeleteProject={onDeleteProject}
      >
        {projectCollection === "subflows" ? (
          <SubflowListPage
            subflows={subflowsWorkspace.subflows}
            subflowUsagesBySubflow={subflowsWorkspace.subflowUsagesBySubflow}
            loading={subflowsWorkspace.subflowsLoading}
            error={appError}
            onCreateSubflow={subflowsWorkspace.createProjectSubflow}
            onUpdateSubflow={subflowsWorkspace.updateProjectSubflow}
            onDuplicateSubflow={subflowsWorkspace.duplicateProjectSubflow}
            onDeleteSubflow={subflowsWorkspace.deleteProjectSubflow}
            onOpenSubflow={(subflowId) => {
              void subflowsWorkspace.openSubflowDetail(subflowId, { type: "subflows" });
            }}
            onRefresh={() => {
              void subflowsWorkspace.loadSubflowsForProject();
            }}
            onExportSubflow={subflowsWorkspace.exportProjectSubflow}
            onImportSubflowFile={subflowsWorkspace.importProjectSubflowFile}
          />
        ) : projectCollection === "profiles" ? (
          <ProjectProfilesPanel
            project={selectedProject}
            browserProfiles={selectedBrowserProfiles}
            workflows={selectedProjectWorkflows}
            overview={identityLabOverview}
            loading={identityLabLoading}
            error={appError}
            onRefresh={() => loadIdentityLabOverview(identityLabTarget, selectedProject?.id)}
            onSelectIdentity={selectIdentity}
            onOpenWorkflow={(workflowId) => {
              void workflowsWorkspace.openWorkflow(workflowId);
            }}
            onOpenWorkflowSettings={(workflowId) => {
              void openIdentityWorkflowSettings(workflowId);
            }}
            onCloseRetainedSession={(workflowId, profileName) => {
              void closeIdentitySession(workflowId, profileName, selectedProject?.id);
            }}
            onResetIdentity={(workflowId) => resetIdentityFromLab(workflowId, selectedProject?.id)}
            onOpenIdentityTarget={openIdentityTarget}
            onCreateBrowserProfile={createBrowserProfile}
            onUpdateBrowserProfile={updateBrowserProfile}
            onDeleteBrowserProfile={async (profileId) => {
              await deleteBrowserProfile(profileId, selectedProject?.id);
            }}
          />
        ) : projectCollection === "desktop-targets" ? (
          <ProjectDesktopTargetsPanel
            project={selectedProject}
            desktopTargets={selectedDesktopTargets}
            error={appError}
            onCreateDesktopTarget={async (projectId, input) => {
              try {
                await createDesktopTarget(projectId, input);
                await loadDesktopTargets(projectId);
                setAppError("");
              } catch (error) {
                setAppError(commandMessage(error));
              }
            }}
            onDeleteDesktopTarget={async (targetId) => {
              try {
                await deleteDesktopTarget(targetId);
                await loadDesktopTargets(selectedProject?.id ?? null);
                setAppError("");
              } catch (error) {
                setAppError(commandMessage(error));
              }
            }}
          />
        ) : projectCollection === "settings" ? (
          <ProjectSettings
            project={selectedProject}
            error={appError}
            onUpdateProject={updateProject}
            onDuplicateProject={onDuplicateProject}
            onExportProjectPackage={exportProjectPackageFile}
            onDeleteProject={onDeleteProject}
          />
        ) : (
          <WorkflowListPage
            workflows={selectedProjectWorkflows}
            workflowDialogMode={workflowsWorkspace.workflowDialogMode}
            workflowNameDraft={workflowsWorkspace.workflowNameDraft}
            browserProfiles={selectedBrowserProfiles}
            desktopTargets={selectedDesktopTargets}
            selectedProfileIdDraft={workflowsWorkspace.selectedProfileIdDraft}
            surfaceDraft={workflowsWorkspace.surfaceDraft}
            selectedDesktopTargetIdDraft={workflowsWorkspace.selectedDesktopTargetIdDraft}
            appError={appError}
            runSnapshots={runSnapshots}
            startingWorkflowId={runWorkspace.startingWorkflowId}
            onWorkflowNameDraftChange={workflowsWorkspace.setWorkflowNameDraft}
            onSelectedProfileIdDraftChange={workflowsWorkspace.setSelectedProfileIdDraft}
            onSurfaceDraftChange={workflowsWorkspace.setSurfaceDraft}
            onSelectedDesktopTargetIdDraftChange={workflowsWorkspace.setSelectedDesktopTargetIdDraft}
            onSubmitWorkflowDialog={workflowsWorkspace.submitWorkflowDialog}
            onOpenCreateWorkflow={workflowsWorkspace.openCreateWorkflowDialog}
            onOpenEditWorkflow={(workflow) => {
              void openWorkflowSettings(workflow, "general");
            }}
            onDuplicateWorkflow={workflowsWorkspace.duplicateWorkflow}
            onRunWorkflow={runWorkspace.runSavedWorkflow}
            onStopRun={(id) => runWorkspace.stopRun(id)}
            onOpenExportWorkflow={openExportPackageDialog}
            onImportWorkflowPackageFile={importWorkflowPackageFile}
            onRecordWorkflow={recordingWorkspace.startWorkflowRecording}
            onCloseWorkflowDialog={workflowsWorkspace.closeWorkflowDialog}
            onOpenWorkflow={(id) => {
              void workflowsWorkspace.openWorkflow(id);
            }}
            onDeleteWorkflow={workflowsWorkspace.deleteWorkflow}
            workflowDialogBusy={workflowsWorkspace.workflowDialogBusy}
          />
        )}
      </ProjectsPage>

      <RecordingReviewDialog
        open={Boolean(recordingWorkspace.recordingSession)}
        session={recordingWorkspace.recordingSession as never}
        draft={recordingWorkspace.recordingDraft as never}
        workflowName={recordingWorkspace.recordingWorkflowName}
        busy={recordingWorkspace.recordingBusy}
        error={appError}
        onWorkflowNameChange={recordingWorkspace.setRecordingWorkflowName}
        onStopRecording={recordingWorkspace.stopWorkflowRecording}
        onDiscard={() => {
          void recordingWorkspace.discardWorkflowRecording();
        }}
        onSave={() => {
          void recordingWorkspace.saveReviewedRecording({
            workflow_name: recordingWorkspace.recordingWorkflowName,
            add_terminal_success: true,
            save_mode: recordingWorkspace.recordingDraft?.mode === "replace_current_graph" ? "replace_graph" : "create_new",
          });
        }}
        onStepChange={recordingWorkspace.updateRecordingStep}
        onOpenChange={(open) => {
          if (!open) {
            void recordingWorkspace.discardWorkflowRecording();
          }
        }}
      />

      <AppPackageDialogs
        appError={appError}
        workflowPackageSections={packageDialogs.workflowPackageSections}
        exportPackageWorkflow={packageDialogs.exportPackageWorkflow}
        exportPackageIncludeFlow={packageDialogs.exportPackageIncludeFlow}
        exportPackageSections={packageDialogs.exportPackageSections}
        onCloseExportPackageDialog={packageDialogs.closeExportPackageDialog}
        onSubmitExportPackage={packageDialogs.submitExportPackage}
        onExportPackageIncludeFlowChange={packageDialogs.setExportPackageIncludeFlow}
        onExportPackageSectionsChange={packageDialogs.setExportPackageSections}
        importPackagePreview={packageDialogs.importPackagePreview}
        importPackageIncludeFlow={packageDialogs.importPackageIncludeFlow}
        importPackageSections={packageDialogs.importPackageSections}
        onCloseImportPackageDialog={packageDialogs.closeImportPackageDialog}
        onSubmitImportPackage={packageDialogs.submitImportPackage}
        onImportPackageIncludeFlowChange={packageDialogs.setImportPackageIncludeFlow}
        onImportPackageSectionsChange={packageDialogs.setImportPackageSections}
        isImportProjectPackageOpen={packageDialogs.isImportProjectPackageOpen}
        importProjectPackagePreview={packageDialogs.importProjectPackagePreview}
        onCloseImportProjectPackageDialog={packageDialogs.closeImportProjectPackageDialog}
        onSubmitImportProjectPackage={packageDialogs.submitImportProjectPackage}
        deleteWorkflowCandidate={workflowsWorkspace.deleteWorkflowCandidate}
        onConfirmDeleteWorkflow={() => {
          void workflowsWorkspace.confirmDeleteWorkflow();
        }}
        onCancelDeleteWorkflow={workflowsWorkspace.cancelDeleteWorkflow}
        isPackageActionBusy={packageDialogs.isPackageActionBusy}
        workflowDialogBusy={workflowsWorkspace.workflowDialogBusy}
      />
    </>
  );
}
