import { useState, useCallback } from "react";
import type {
  SubflowWorkspaceAPI,
  SubflowBackTarget,
} from "../../../shared/types/workspaceContracts";
import type {
  SubflowSummary,
  Subflow,
  WorkflowGraph,
  SubflowUsage,
} from "../../../types/workflow";
import {
  listSubflows,
  getSubflow,
  getSubflowGraph,
  getSubflowUsage,
  createSubflow as createSubflowCommand,
  deleteSubflow as deleteSubflowCommand,
  saveSubflowGraph,
  updateSubflow as updateSubflowCommand,
  duplicateSubflow as duplicateSubflowCommand,
  exportSubflow,
  importSubflow,
  saveSubflowPackageFile,
} from "../../../lib/workflowApi";
import { commandMessage } from "../../../lib/workflowUi";
import { hasEditableGraphChange, type GraphSaveStatus } from "../../../lib/appState";

export interface SubflowWorkspaceDeps {
  setAppError: (error: string) => void;
  ensureProjectId: () => Promise<string>;
  detail: any;
  requestGraphExitNavigation: (navigate: () => void | Promise<void>) => Promise<boolean> | boolean;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setScreen: (screen: any) => void;
  setProjectCollection: (collection: any) => void;
  openWorkflow: (id: string) => Promise<void>;
}

export function useSubflowWorkspace(deps: SubflowWorkspaceDeps): SubflowWorkspaceAPI {
  const {
    setAppError,
    ensureProjectId,
    detail: _detail,
    requestGraphExitNavigation,
    setSidebarCollapsed,
    setScreen,
    setProjectCollection,
    openWorkflow: _openWorkflow,
  } = deps;

  const [subflows, setSubflows] = useState<SubflowSummary[]>([]);
  const [subflowsLoading, setSubflowsLoading] = useState(false);
  const [selectedSubflow, setSelectedSubflow] = useState<Subflow | null>(null);
  const [selectedSubflowGraph, setSelectedSubflowGraph] = useState<WorkflowGraph | null>(null);
  const [selectedSubflowUsage, setSelectedSubflowUsage] = useState<SubflowUsage[]>([]);
  const [subflowBackTarget, setSubflowBackTarget] = useState<SubflowBackTarget>({ type: "subflows" });
  const [subflowGraphSaveStatus, setSubflowGraphSaveStatus] = useState<GraphSaveStatus>("saved");

  const loadSubflowsForProject = useCallback(async (projectId?: string | null) => {
    setSubflowsLoading(true);
    try {
      const resolvedProjectId = projectId ?? (await ensureProjectId());
      if (!resolvedProjectId) {
        setSubflows([]);
        setAppError("Project not found");
        return [];
      }
      const items = await listSubflows(resolvedProjectId);
      setSubflows(items);
      setAppError("");
      return items;
    } catch (error) {
      setAppError(commandMessage(error));
      return [];
    } finally {
      setSubflowsLoading(false);
    }
  }, [ensureProjectId, setAppError]);

  const performOpenSubflowDetail = useCallback(async (
    subflowId: string,
    backTarget: SubflowBackTarget = { type: "subflows" },
  ) => {
    setAppError("");
    try {
      const loadedSubflow = await getSubflow(subflowId);
      if (!loadedSubflow) {
        setAppError("Subflow not found");
        setScreen("projects");
        setProjectCollection("subflows");
        return;
      }
      const [graph, usage] = await Promise.all([
        getSubflowGraph(subflowId),
        getSubflowUsage(subflowId),
      ]);
      setSelectedSubflow(loadedSubflow);
      setSelectedSubflowGraph(graph);
      setSelectedSubflowUsage(usage);
      setSubflowBackTarget(backTarget);
      setSubflowGraphSaveStatus("saved");
      setSidebarCollapsed(true);
      setScreen("subflow-detail");
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [setScreen, setProjectCollection, setSelectedSubflow, setSelectedSubflowGraph, setSelectedSubflowUsage, setSubflowBackTarget, setSubflowGraphSaveStatus, setSidebarCollapsed, setAppError]);

  const openSubflowDetail = useCallback(async (
    subflowId: string,
    backTarget: SubflowBackTarget = { type: "subflows" },
  ) => {
    await requestGraphExitNavigation(() =>
      performOpenSubflowDetail(subflowId, backTarget),
    );
  }, [requestGraphExitNavigation, performOpenSubflowDetail]);

  const createProjectSubflow = useCallback(async (input: { name: string; description?: string | null }) => {
    setAppError("");
    const projectId = await ensureProjectId();
    if (!projectId) {
      setAppError("Project not found");
      return;
    }

    try {
      await createSubflowCommand(projectId, input);
      await loadSubflowsForProject(projectId);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [ensureProjectId, loadSubflowsForProject, setAppError]);

  const deleteProjectSubflow = useCallback(async (subflowId: string) => {
    setAppError("");
    try {
      await deleteSubflowCommand(subflowId);
      if (selectedSubflow) {
        await loadSubflowsForProject(selectedSubflow.project_id);
      }
      if (selectedSubflow?.id === subflowId) {
        setSelectedSubflow(null);
        setSelectedSubflowGraph(null);
        setSelectedSubflowUsage([]);
        setScreen("projects");
        setProjectCollection("subflows");
      }
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [selectedSubflow, loadSubflowsForProject, setScreen, setProjectCollection, setAppError]);

  const changeSubflowGraph = useCallback((nextGraph: WorkflowGraph) => {
    const hasEditableChange = hasEditableGraphChange(selectedSubflowGraph, nextGraph);
    setSelectedSubflowGraph(nextGraph);
    if (!hasEditableChange) return;
    setSubflowGraphSaveStatus("unsaved");
  }, [selectedSubflowGraph]);

  const saveCurrentSubflowGraph = useCallback(async () => {
    if (!selectedSubflow || !selectedSubflowGraph) return true;
    setAppError("");
    setSubflowGraphSaveStatus("saving");
    try {
      await saveSubflowGraph(selectedSubflow.id, selectedSubflowGraph);
      setSubflowGraphSaveStatus("saved");
      setSelectedSubflowUsage(await getSubflowUsage(selectedSubflow.id));
      await loadSubflowsForProject(selectedSubflow.project_id);
      return true;
    } catch (error) {
      setSubflowGraphSaveStatus("failed");
      setAppError(commandMessage(error));
      return false;
    }
  }, [selectedSubflow, selectedSubflowGraph, loadSubflowsForProject, setAppError]);

  const updateProjectSubflow = useCallback(async (
    subflow: SubflowSummary | Subflow,
    input: { name: string; description?: string | null },
  ) => {
    setAppError("");
    try {
      const updated = await updateSubflowCommand(subflow.id, input);
      if (selectedSubflow?.id === updated.id) {
        setSelectedSubflow(updated);
      }
      await loadSubflowsForProject(updated.project_id);
    } catch (error) {
      const message = commandMessage(error);
      setAppError(message);
      throw new Error(message);
    }
  }, [selectedSubflow, loadSubflowsForProject, setAppError]);

  const duplicateProjectSubflow = useCallback(async (subflow: SubflowSummary | Subflow) => {
    setAppError("");
    try {
      await duplicateSubflowCommand(subflow.id, `Copy of ${subflow.name}`);
      await loadSubflowsForProject(subflow.project_id);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [loadSubflowsForProject, setAppError]);

  const exportProjectSubflow = useCallback(async (subflowId: string) => {
    setAppError("");
    try {
      const exported = await exportSubflow(subflowId);
      await saveSubflowPackageFile(exported);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [setAppError]);

  const importProjectSubflowFile = useCallback(async (file: File | null) => {
    if (!file) return;
    setAppError("");
    const limitBytes = 5 * 1024 * 1024;
    if (file.size > limitBytes) {
      setAppError("Subflow package file must be 5 MB or smaller");
      return;
    }
    try {
      const text = await file.text();
      const exported = JSON.parse(text);
      const projectId = await ensureProjectId();
      if (!projectId) {
        setAppError("Project not found");
        return;
      }
      await importSubflow(projectId, exported);
      await loadSubflowsForProject(projectId);
    } catch (error) {
      setAppError(commandMessage(error));
    }
  }, [ensureProjectId, loadSubflowsForProject, setAppError]);

  return {
    subflows,
    subflowsLoading,
    selectedSubflow,
    selectedSubflowGraph,
    selectedSubflowUsage,
    subflowBackTarget,
    subflowGraphSaveStatus,
    setSubflows,
    setSubflowsLoading,
    setSelectedSubflow,
    setSelectedSubflowGraph,
    setSelectedSubflowUsage,
    setSubflowBackTarget,
    setSubflowGraphSaveStatus,
    loadSubflowsForProject,
    openSubflowDetail,
    createProjectSubflow,
    updateProjectSubflow,
    duplicateProjectSubflow,
    deleteProjectSubflow,
    changeSubflowGraph,
    saveCurrentSubflowGraph,
    exportProjectSubflow,
    importProjectSubflowFile,
  };
}
