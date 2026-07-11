import type {
  ProjectPackage,
  ProjectPackagePreview,
  Project,
  WorkflowExport,
  WorkflowDetail,
  WorkflowPackage,
  WorkflowPackageExportOptions,
  WorkflowPackagePreview,
  WorkflowPackageImportOptions,
  Subflow,
} from "../../../../src/types/workflow.js";
import { commandError, summaryToWorkflow } from "../../commandHelpers.js";
import type { CommandDeps } from "../types.js";
import { migrateWorkflowGraph } from "../../graph/migration.js";

export function createPackageCommands(deps: CommandDeps) {
  const {
    repository,
    projectPackageService,
    packageService,
    projectCascades,
    requireProject,
    requireWorkflow,
    getSettings,
    saveSettings,
    getWorkflowGraph,
    referencedSubflowsForWorkflowGraph,
    ensureDefaultProject,
    createWorkflow,
    duplicateBrowserProfileLaunch,
    remapCallSubflowIds,
  } = deps;

  return {
    async exportProjectPackage(projectId: string): Promise<ProjectPackage> {
      const project = await requireProject(projectId);
      const browser_profiles = await repository.listBrowserProfiles(project.id);
      
      const subflowsList = await repository.listSubflows(project.id);
      const subflows: Subflow[] = [];
      for (const sf of subflowsList) {
        const subflowDetail = await repository.getSubflow(sf.id);
        if (subflowDetail) {
          subflows.push(subflowDetail);
        }
      }

      const allWorkflows = await repository.listWorkflows();
      const projectWorkflows = allWorkflows.filter((w: any) => w.project_id === project.id);
      const workflows: any[] = [];
      for (const w of projectWorkflows) {
        const flow = await getWorkflowGraph(w.id);
        const settings = await getSettings(w.id);
        workflows.push({
          workflow: w,
          flow,
          settings,
        });
      }

      return projectPackageService.exportProjectPackage({
        project,
        browser_profiles,
        subflows,
        workflows,
      });
    },

    async previewProjectPackage(packageValue: ProjectPackage): Promise<ProjectPackagePreview> {
      return projectPackageService.previewProjectPackage(packageValue);
    },

    async importProjectPackage(packageValue: ProjectPackage): Promise<Project> {
      return projectCascades.importProjectPackageCascade(packageValue);
    },

    async exportWorkflow(workflowId: string): Promise<WorkflowExport> {
      const workflow = await requireWorkflow(workflowId);
      const settings = await repository.getWorkflowSettings(workflowId);
      return {
        version: 1,
        workflow: summaryToWorkflow(workflow),
        steps: [],
        settings,
      };
    },

    async importWorkflow(exported: WorkflowExport): Promise<WorkflowDetail> {
      return deps.context.database.transaction(async () => {
        const workflow = await createWorkflow(exported.workflow.name);
        if (exported.settings) {
          await saveSettings(workflow.id, {
            ...exported.settings,
            workflow_id: workflow.id,
            general: {
              ...exported.settings.general,
              name: workflow.name,
            },
          });
        }
        return { workflow, steps: [] };
      });
    },

    async exportWorkflowPackage(
      workflowId: string,
      options: WorkflowPackageExportOptions,
    ): Promise<WorkflowPackage> {
      const workflow = await requireWorkflow(workflowId);
      const settings = await getSettings(workflowId);
      const flow = options.include_flow ? await getWorkflowGraph(workflowId) : null;
      const subflows = flow ? await referencedSubflowsForWorkflowGraph(workflow, flow) : [];
      return packageService.exportWorkflowPackage({
        workflowName: workflow.name,
        flow,
        settings,
        options,
        subflows,
      });
    },

    async previewWorkflowPackage(packageValue: WorkflowPackage): Promise<WorkflowPackagePreview> {
      return packageService.previewWorkflowPackage(packageValue);
    },

    async importWorkflowPackage(
      packageValue: WorkflowPackage,
      options: WorkflowPackageImportOptions,
    ): Promise<WorkflowDetail> {
      const preparedImport = packageService.prepareImport({ packageValue, options });
      const defaultProj = await ensureDefaultProject();
      const targetProjectId = options.target_project_id?.trim() || defaultProj.id;
      const importsBrowserLaunch =
        options.settings_sections.includes("browser_launch") &&
        Boolean(packageValue.settings?.browser_launch);

      return deps.context.database.transaction(async () => {
        let workflow = await createWorkflow(preparedImport.importedName, {
          project_id: targetProjectId,
        });
        let importedProfile: any = null;
        if (importsBrowserLaunch && preparedImport.candidateSettings?.browser_launch) {
          importedProfile = await repository.createBrowserProfile(
            workflow.project_id ?? targetProjectId,
            {
              name: `${workflow.name} browser profile`,
              description: "Imported workflow browser profile",
              is_default: false,
              browser_launch: await duplicateBrowserProfileLaunch(
                preparedImport.candidateSettings.browser_launch,
                workflow.id,
              ),
            },
          );
          workflow = (await repository.assignWorkflowBrowserProfile(
            workflow.id,
            importedProfile.id,
          )) ?? workflow;
        }
        const subflowIdMap = new Map<string, string>();
        for (const subflow of preparedImport.subflows) {
          const createdSubflow = await repository.createSubflow(
            workflow.project_id ?? targetProjectId,
            subflow.name,
            subflow.description,
            migrateWorkflowGraph(subflow.graph),
          );
          subflowIdMap.set(subflow.id, createdSubflow.id);
        }
        if (options.include_flow && preparedImport.flow) {
          await repository.saveWorkflowGraph(
            workflow.id,
            remapCallSubflowIds(preparedImport.flow, subflowIdMap),
          );
        }

        if (preparedImport.candidateSettings) {
          const baseSettings = await getSettings(workflow.id);
          await saveSettings(workflow.id, {
            ...baseSettings,
            ...preparedImport.candidateSettings,
            workflow_id: workflow.id,
            browser_launch: importsBrowserLaunch
              ? importedProfile?.browser_launch ??
                preparedImport.candidateSettings.browser_launch
              : baseSettings.browser_launch,
            general: {
              ...preparedImport.candidateSettings.general,
              name: workflow.name,
            },
          });
        }
        return { workflow, steps: [] };
      });
    },

    async saveWorkflowPackageFile(packageValue: WorkflowPackage) {
      if (!deps.context.saveWorkflowPackageFile) {
        throw commandError("Workflow package file saving is not available");
      }
      return deps.context.saveWorkflowPackageFile(packageValue);
    },

    async saveProjectPackageFile(packageValue: ProjectPackage) {
      if (!deps.context.saveProjectPackageFile) {
        throw commandError("Project package file saving is not available");
      }
      return deps.context.saveProjectPackageFile(packageValue);
    },
  };
}
