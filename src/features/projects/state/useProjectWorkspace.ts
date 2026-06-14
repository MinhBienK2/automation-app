import { useState, useCallback } from "react";
import type {
  ProjectWorkspaceAPI,
} from "../../../shared/types/workspaceContracts";
import type {
  Project,
  BrowserProfile,
} from "../../../types/workflow";
import {
  listProjects,
  listBrowserProfiles,
  createProject as createProjectCommand,
  updateProject as updateProjectCommand,
  duplicateProject as duplicateProjectCommand,
  deleteProject as deleteProjectCommand,
  listSubflows,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";

export interface ProjectWorkspaceDeps {
  setAppError: (error: string) => void;
  showToast: (message: string) => void;
  loadWorkflows: () => Promise<void>;
  setSubflows: (subflows: any[]) => void;
  setSubflowsLoading: (loading: boolean) => void;
}

export function useProjectWorkspace(deps: ProjectWorkspaceDeps): ProjectWorkspaceAPI {
  const { setAppError, showToast, loadWorkflows, setSubflows, setSubflowsLoading } = deps;

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectCollection, setProjectCollectionState] = useState<"workflows" | "subflows" | "profiles" | "settings">("workflows");
  const [browserProfiles, setBrowserProfiles] = useState<BrowserProfile[]>([]);

  const loadProjectModel = useCallback(async () => {
    try {
      const loadedProjects = await listProjects();
      setProjects(loadedProjects);
      const projectId =
        selectedProjectId && loadedProjects.some((project) => project.id === selectedProjectId)
          ? selectedProjectId
          : loadedProjects[0]?.id ?? null;
      setSelectedProjectId(projectId);
      if (!projectId) {
        setBrowserProfiles([]);
        return { projects: loadedProjects, browserProfiles: [] };
      }
      const environments = await listBrowserProfiles(projectId);
      setBrowserProfiles(environments);
      return { projects: loadedProjects, browserProfiles: environments };
    } catch (error) {
      setAppError(commandMessage(error));
      return { projects: [], browserProfiles: [] };
    }
  }, [selectedProjectId, setAppError]);

  const currentProjectId = useCallback(() => {
    return (
      selectedProjectId ??
      projects[0]?.id ??
      browserProfiles[0]?.project_id ??
      null
    );
  }, [selectedProjectId, projects, browserProfiles]);

  const ensureProjectId = useCallback(async () => {
    const existingProjectId = currentProjectId();
    if (existingProjectId) return existingProjectId;
    const loaded = await loadProjectModel();
    const projectId = loaded.projects[0]?.id ?? null;
    setSelectedProjectId(projectId);
    if (!projectId) {
      throw new Error("No projects available");
    }
    return projectId;
  }, [currentProjectId, loadProjectModel]);

  const loadSubflowsForProject = useCallback(async (projectId: string) => {
    setSubflowsLoading(true);
    try {
      const items = await listSubflows(projectId);
      setSubflows(items);
      setAppError("");
      return items;
    } catch (error) {
      setAppError(commandMessage(error));
      return [];
    } finally {
      setSubflowsLoading(false);
    }
  }, [setSubflows, setSubflowsLoading, setAppError]);

  const setProjectCollection = useCallback((collection: "workflows" | "subflows" | "profiles" | "settings") => {
    setProjectCollectionState(collection);
    const projectId = currentProjectId();
    if (projectId && (collection === "subflows" || collection === "settings" || collection === "profiles")) {
      void loadSubflowsForProject(projectId);
    }
  }, [currentProjectId, loadSubflowsForProject]);

  const selectProject = useCallback(async (projectId: string) => {
    setAppError("");
    if (projectId !== selectedProjectId) {
      setProjectCollectionState("workflows");
    }
    setSelectedProjectId(projectId);
    try {
      const environments = await listBrowserProfiles(projectId);
      setBrowserProfiles(environments);
      await loadSubflowsForProject(projectId);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [selectedProjectId, loadSubflowsForProject, setAppError]);

  const createProject = useCallback(async (input: { name: string; description?: string | null }) => {
    setAppError("");
    try {
      const project = await createProjectCommand(input);
      setSelectedProjectId(project.id);
      setProjectCollectionState("workflows");
      setProjects(await listProjects());
      await loadWorkflows();
      setBrowserProfiles(await listBrowserProfiles(project.id));
      const subflowItems = await listSubflows(project.id);
      setSubflows(subflowItems);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [loadWorkflows, setSubflows, setAppError]);

  const updateProject = useCallback(async (
    projectId: string,
    input: { name?: string; description?: string | null },
  ) => {
    setAppError("");
    try {
      const project = await updateProjectCommand(projectId, input);
      setSelectedProjectId(project.id);
      setProjects(await listProjects());
      showToast("Project updated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [showToast, setAppError]);

  const duplicateProject = useCallback(async (projectId: string) => {
    setAppError("");
    try {
      const project = await duplicateProjectCommand(projectId);
      setSelectedProjectId(project.id);
      setProjectCollectionState("settings");
      setProjects(await listProjects());
      setBrowserProfiles(await listBrowserProfiles(project.id));
      const subflowItems = await listSubflows(project.id);
      setSubflows(subflowItems);
      await loadWorkflows();
      showToast("Project duplicated.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [loadWorkflows, setSubflows, showToast, setAppError]);

  const deleteProject = useCallback(async (projectId: string) => {
    setAppError("");
    try {
      await deleteProjectCommand(projectId);
      const loadedProjects = await listProjects();
      const nextProjectId = loadedProjects[0]?.id ?? null;
      setProjects(loadedProjects);
      setSelectedProjectId(nextProjectId);
      if (nextProjectId) {
        setBrowserProfiles(await listBrowserProfiles(nextProjectId));
        const subflowItems = await listSubflows(nextProjectId);
        setSubflows(subflowItems);
      } else {
        setBrowserProfiles([]);
        setSubflows([]);
      }
      await loadWorkflows();
      showToast("Project deleted.");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [loadWorkflows, setSubflows, showToast, setAppError]);

  return {
    projects,
    selectedProjectId,
    projectCollection,
    browserProfiles,
    setSelectedProjectId,
    setProjectCollection,
    setBrowserProfiles,
    setProjects,
    loadProjectModel,
    currentProjectId,
    ensureProjectId,
    selectProject,
    createProject,
    updateProject,
    duplicateProject,
    deleteProject,
  };
}
