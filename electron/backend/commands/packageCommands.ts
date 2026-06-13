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
} from "../../../src/types/workflow.js";
import { commandError, summaryToWorkflow } from "../commandHelpers.js";
import type { CommandDeps } from "./types.js";
import { migrateWorkflowGraph } from "../graph/migration.js";

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
    exportProjectPackage(projectId: string): ProjectPackage {
      const project = requireProject(projectId);
      const environments = repository.listProjectEnvironments(project.id);
      const subflows = repository
        .listSubflows(project.id)
        .map((subflow) => repository.getSubflow(subflow.id))
        .filter((subflow): subflow is Subflow => Boolean(subflow));
      const workflows = repository
        .listWorkflows()
        .filter((workflow) => workflow.project_id === project.id)
        .map((workflow) => ({
          workflow,
          flow: getWorkflowGraph(workflow.id),
          settings: getSettings(workflow.id),
        }));
      return projectPackageService.exportProjectPackage({
        project,
        environments,
        subflows,
        workflows,
      });
    },

    previewProjectPackage(packageValue: ProjectPackage): ProjectPackagePreview {
      return projectPackageService.previewProjectPackage(packageValue);
    },

    importProjectPackage(packageValue: ProjectPackage): Project {
      return projectCascades.importProjectPackageCascade(packageValue);
    },

    exportWorkflow(workflowId: string): WorkflowExport {
      const workflow = requireWorkflow(workflowId);
      return {
        version: 1,
        workflow: summaryToWorkflow(workflow),
        steps: [],
        settings: repository.getWorkflowSettings(workflowId),
      };
    },

    importWorkflow(exported: WorkflowExport): WorkflowDetail {
      deps.context.database.exec("BEGIN IMMEDIATE");
      try {
        const workflow = createWorkflow(exported.workflow.name);
        if (exported.settings) {
          saveSettings(workflow.id, {
            ...exported.settings,
            workflow_id: workflow.id,
            general: {
              ...exported.settings.general,
              name: workflow.name,
            },
          });
        }
        deps.context.database.exec("COMMIT");
        return { workflow, steps: [] };
      } catch (error) {
        deps.context.database.exec("ROLLBACK");
        throw error;
      }
    },

    exportWorkflowPackage(
      workflowId: string,
      options: WorkflowPackageExportOptions,
    ): WorkflowPackage {
      const workflow = requireWorkflow(workflowId);
      const settings = getSettings(workflowId);
      const flow = options.include_flow ? getWorkflowGraph(workflowId) : null;
      return packageService.exportWorkflowPackage({
        workflowName: workflow.name,
        flow,
        settings,
        options,
        subflows: flow ? referencedSubflowsForWorkflowGraph(workflow, flow) : [],
      });
    },

    previewWorkflowPackage(packageValue: WorkflowPackage): WorkflowPackagePreview {
      return packageService.previewWorkflowPackage(packageValue);
    },

    importWorkflowPackage(
      packageValue: WorkflowPackage,
      options: WorkflowPackageImportOptions,
    ): WorkflowDetail {
      const preparedImport = packageService.prepareImport({ packageValue, options });
      const targetProjectId = options.target_project_id?.trim() || ensureDefaultProject().id;
      const importsBrowserLaunch =
        options.settings_sections.includes("browser_launch") &&
        Boolean(packageValue.settings?.browser_launch);

      deps.context.database.exec("BEGIN IMMEDIATE");
      try {
        let workflow = createWorkflow(preparedImport.importedName, {
          project_id: targetProjectId,
        });
        let importedProfile: any = null;
        if (importsBrowserLaunch && preparedImport.candidateSettings?.browser_launch) {
          importedProfile = repository.createProjectEnvironment(
            workflow.project_id ?? targetProjectId,
            {
              name: `${workflow.name} browser profile`,
              description: "Imported workflow browser profile",
              is_default: false,
              browser_launch: duplicateBrowserProfileLaunch(
                preparedImport.candidateSettings.browser_launch,
                workflow.id,
              ),
            },
          );
          workflow = repository.assignWorkflowProjectEnvironment(
            workflow.id,
            importedProfile.id,
          ) ?? workflow;
        }
        const subflowIdMap = new Map<string, string>();
        for (const subflow of preparedImport.subflows) {
          const createdSubflow = repository.createSubflow(
            workflow.project_id ?? targetProjectId,
            subflow.name,
            subflow.description,
            migrateWorkflowGraph(subflow.graph),
          );
          subflowIdMap.set(subflow.id, createdSubflow.id);
        }
        if (options.include_flow && preparedImport.flow) {
          repository.saveWorkflowGraph(
            workflow.id,
            remapCallSubflowIds(preparedImport.flow, subflowIdMap),
          );
        }

        if (preparedImport.candidateSettings) {
          const baseSettings = getSettings(workflow.id);
          saveSettings(workflow.id, {
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
        deps.context.database.exec("COMMIT");
        return { workflow, steps: [] };
      } catch (error) {
        deps.context.database.exec("ROLLBACK");
        throw error;
      }
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
