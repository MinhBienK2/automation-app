import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type {
  Project,
  ProjectPackage,
  ProjectPackagePreview,
  WorkflowDetail,
  WorkflowPackage,
  WorkflowPackagePreview,
  WorkflowSummary,
} from "../types/workflow";
import {
  exportWorkflowPackage,
  importProjectPackage,
  importWorkflowPackage,
  previewProjectPackage,
  previewWorkflowPackage,
  saveProjectPackageFile,
  saveWorkflowPackageFile,
} from "./workflowApi";
import {
  useAppPackageDialogs,
  workflowPackageSections,
} from "./useAppPackageDialogs";

vi.mock("./workflowApi", () => ({
  exportProjectPackage: vi.fn(),
  exportWorkflowPackage: vi.fn(),
  importProjectPackage: vi.fn(),
  importWorkflowPackage: vi.fn(),
  previewProjectPackage: vi.fn(),
  previewWorkflowPackage: vi.fn(),
  saveProjectPackageFile: vi.fn(),
  saveWorkflowPackageFile: vi.fn(),
}));

describe("useAppPackageDialogs", () => {
  beforeEach(() => {
    vi.mocked(exportWorkflowPackage).mockReset();
    vi.mocked(importProjectPackage).mockReset();
    vi.mocked(importWorkflowPackage).mockReset();
    vi.mocked(previewProjectPackage).mockReset();
    vi.mocked(previewWorkflowPackage).mockReset();
    vi.mocked(saveProjectPackageFile).mockReset();
    vi.mocked(saveWorkflowPackageFile).mockReset();
  });

  test("exports the selected workflow package and closes the export dialog after a file save", async () => {
    vi.mocked(exportWorkflowPackage).mockResolvedValue(workflowPackage());
    vi.mocked(saveWorkflowPackageFile).mockResolvedValue("/tmp/workflow-package.json");
    const hook = renderPackageHook();

    act(() => {
      hook.result.current.openExportPackageDialog(workflowSummary());
    });

    expect(hook.result.current.exportPackageWorkflow?.id).toBe("workflow-1");

    await act(async () => {
      await hook.result.current.submitExportPackage(formEvent());
    });

    expect(exportWorkflowPackage).toHaveBeenCalledWith("workflow-1", {
      include_flow: true,
      settings_sections: workflowPackageSections,
    });
    expect(saveWorkflowPackageFile).toHaveBeenCalledWith(workflowPackage());
    expect(hook.result.current.exportPackageWorkflow).toBeNull();
    expect(hook.setAppError).toHaveBeenLastCalledWith("");
  });

  test("previews and imports workflow packages into the current project", async () => {
    vi.mocked(previewWorkflowPackage).mockResolvedValue({
      ...workflowPackagePreview(),
      includes_flow: false,
      settings_sections: ["general"],
    });
    vi.mocked(importWorkflowPackage).mockResolvedValue(workflowDetail("workflow-imported"));
    const hook = renderPackageHook();

    await act(async () => {
      await hook.result.current.importWorkflowPackageFile(fileFor(workflowPackage()));
    });

    expect(previewWorkflowPackage).toHaveBeenCalledWith(workflowPackage());
    expect(hook.result.current.importPackagePreview?.workflow_name).toBe("Imported workflow");
    expect(hook.result.current.importPackageIncludeFlow).toBe(false);
    expect(hook.result.current.importPackageSections).toEqual(["general"]);

    await act(async () => {
      await hook.result.current.submitImportPackage(formEvent());
    });

    expect(importWorkflowPackage).toHaveBeenCalledWith(workflowPackage(), {
      include_flow: false,
      settings_sections: ["general"],
      target_project_id: "project-1",
    });
    expect(hook.onWorkflowImported).toHaveBeenCalledWith("workflow-imported");
    expect(hook.result.current.importPackagePreview).toBeNull();
  });

  test("previews and imports project packages through the project refresh callback", async () => {
    vi.mocked(previewProjectPackage).mockResolvedValue(projectPackagePreview());
    vi.mocked(importProjectPackage).mockResolvedValue(project());
    const hook = renderPackageHook();

    await act(async () => {
      await hook.result.current.importProjectPackageFile(fileFor(projectPackage()));
    });

    expect(previewProjectPackage).toHaveBeenCalledWith(projectPackage());
    expect(hook.result.current.importProjectPackagePreview?.project_name).toBe("Imported project");
    expect(hook.result.current.isImportProjectPackageOpen).toBe(true);

    await act(async () => {
      await hook.result.current.submitImportProjectPackage(formEvent());
    });

    expect(importProjectPackage).toHaveBeenCalledWith(projectPackage());
    expect(hook.onProjectImported).toHaveBeenCalledWith(project());
    expect(hook.setToastMessage).toHaveBeenCalledWith("Project imported.");
    expect(hook.result.current.isImportProjectPackageOpen).toBe(false);
  });
});

function renderPackageHook() {
  const setAppError = vi.fn();
  const setToastMessage = vi.fn();
  const onProjectImported = vi.fn(async () => undefined);
  const onWorkflowImported = vi.fn(async () => undefined);
  const result = renderHook(() =>
    useAppPackageDialogs({
      currentProjectId: () => "project-1",
      onProjectImported,
      onWorkflowImported,
      setAppError,
      setToastMessage,
    }),
  ).result;
  return {
    result,
    onProjectImported,
    onWorkflowImported,
    setAppError,
    setToastMessage,
  };
}

function formEvent() {
  return {
    preventDefault: vi.fn(),
  } as unknown as React.FormEvent;
}

function fileFor(value: unknown) {
  return new File([JSON.stringify(value)], "package.json", {
    type: "application/json",
  });
}

function workflowSummary(): WorkflowSummary {
  return {
    id: "workflow-1",
    name: "Workflow",
    step_count: 1,
    project_id: "project-1",
    environment_id: null,
    environment_name: null,
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
  };
}

function workflowPackage(): WorkflowPackage {
  return {
    kind: "workflow_package",
    version: 2,
    workflow: { name: "Imported workflow" },
    included_sections: ["general"],
    omitted_fields: [],
    flow: null,
    subflows: [],
    settings: null,
  };
}

function workflowPackagePreview(): WorkflowPackagePreview {
  return {
    workflow_name: "Imported workflow",
    includes_flow: true,
    subflows: [],
    settings_sections: ["general", "browser_launch"],
    omitted_fields: [],
  };
}

function workflowDetail(id: string): WorkflowDetail {
  return {
    workflow: {
      id,
      name: "Imported workflow",
      project_id: "project-1",
      environment_id: null,
      created_at: "2026-06-01T12:00:00.000Z",
      updated_at: "2026-06-01T12:00:00.000Z",
    },
    steps: [],
  };
}

function project(): Project {
  return {
    id: "project-imported",
    name: "Imported project",
    description: "",
    created_at: "2026-06-01T12:00:00.000Z",
    updated_at: "2026-06-01T12:00:00.000Z",
  };
}

function projectPackage(): ProjectPackage {
  return {
    kind: "project_package",
    version: 1,
    project: { name: "Imported project", description: "" },
    included_sections: [],
    omitted_fields: [],
    environments: [],
    subflows: [],
    workflows: [],
  };
}

function projectPackagePreview(): ProjectPackagePreview {
  return {
    project_name: "Imported project",
    workflows: [],
    subflows: [],
    environments: [],
    omitted_fields: [],
  };
}
