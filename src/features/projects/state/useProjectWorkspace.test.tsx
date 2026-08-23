import { renderHook, act } from "@testing-library/react";
import { beforeEach, describe, expect, test, vi } from "vitest";
import { useProjectWorkspace } from "./useProjectWorkspace";
import type { ProjectWorkspaceDeps } from "./useProjectWorkspace";
import {
  listProjects,
  listBrowserProfiles,
  listDesktopTargets,
  listSubflows,
  createProject,
  duplicateProject,
  deleteProject,
} from "../../../lib/api/workflowApi";

/**
 * Desktop Targets are per-project, and every path that changes which project is
 * selected has to say so. Browser Profiles are reloaded on all of them; the
 * Desktop Target list was added later and only wired into the initial load, so
 * switching projects left the previous project's applications on screen — and
 * offered them as the default in the create dialog.
 */

vi.mock("../../../lib/api/workflowApi", () => ({
  listProjects: vi.fn(),
  listBrowserProfiles: vi.fn(),
  listDesktopTargets: vi.fn(),
  listSubflows: vi.fn(),
  createProject: vi.fn(),
  updateProject: vi.fn(),
  duplicateProject: vi.fn(),
  deleteProject: vi.fn(),
}));

const PROJECTS = [
  { id: "project-a", name: "A" },
  { id: "project-b", name: "B" },
];

const TARGETS: Record<string, Array<Record<string, unknown>>> = {
  "project-a": [{ id: "target-a", project_id: "project-a", name: "Ledger" }],
  "project-b": [{ id: "target-b", project_id: "project-b", name: "Calculator" }],
};

function deps(): ProjectWorkspaceDeps {
  return {
    setAppError: vi.fn(),
    showToast: vi.fn(),
    loadWorkflows: vi.fn(async () => {}),
    setSubflows: vi.fn(),
    setSubflowsLoading: vi.fn(),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(listProjects).mockResolvedValue(PROJECTS as never);
  vi.mocked(listBrowserProfiles).mockResolvedValue([] as never);
  vi.mocked(listSubflows).mockResolvedValue([] as never);
  vi.mocked(listDesktopTargets).mockImplementation(
    async (projectId: string) => (TARGETS[projectId] ?? []) as never,
  );
});

describe("useProjectWorkspace, Desktop Targets follow the selected project", () => {
  test("selectProject loads the new project's targets", async () => {
    const { result } = renderHook(() => useProjectWorkspace(deps()));

    await act(async () => {
      await result.current.loadProjectModel();
    });
    expect(result.current.desktopTargets.map((t) => t.id)).toEqual(["target-a"]);

    await act(async () => {
      await result.current.selectProject("project-b");
    });

    expect(result.current.desktopTargets.map((t) => t.id)).toEqual(["target-b"]);
  });

  test("createProject clears the previous project's targets", async () => {
    vi.mocked(createProject).mockResolvedValue({ id: "project-c", name: "C" } as never);
    const { result } = renderHook(() => useProjectWorkspace(deps()));

    await act(async () => {
      await result.current.loadProjectModel();
    });
    await act(async () => {
      await result.current.createProject({ name: "C" });
    });

    // A brand new project owns no applications. Showing project A's would
    // offer the create dialog a target that does not belong to it.
    expect(result.current.desktopTargets).toEqual([]);
  });

  test("duplicateProject loads the copy's targets", async () => {
    vi.mocked(duplicateProject).mockResolvedValue({ id: "project-b", name: "B copy" } as never);
    const { result } = renderHook(() => useProjectWorkspace(deps()));

    await act(async () => {
      await result.current.loadProjectModel();
    });
    await act(async () => {
      await result.current.duplicateProject("project-a");
    });

    expect(result.current.desktopTargets.map((t) => t.id)).toEqual(["target-b"]);
  });

  test("deleteProject loads the surviving project's targets", async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined as never);
    vi.mocked(listProjects)
      .mockResolvedValueOnce(PROJECTS as never)
      .mockResolvedValueOnce([PROJECTS[1]] as never);
    const { result } = renderHook(() => useProjectWorkspace(deps()));

    await act(async () => {
      await result.current.loadProjectModel();
    });
    await act(async () => {
      await result.current.deleteProject("project-a");
    });

    expect(result.current.desktopTargets.map((t) => t.id)).toEqual(["target-b"]);
  });

  test("deleting the last project leaves no targets behind", async () => {
    vi.mocked(deleteProject).mockResolvedValue(undefined as never);
    vi.mocked(listProjects)
      .mockResolvedValueOnce(PROJECTS as never)
      .mockResolvedValueOnce([] as never);
    const { result } = renderHook(() => useProjectWorkspace(deps()));

    await act(async () => {
      await result.current.loadProjectModel();
    });
    await act(async () => {
      await result.current.deleteProject("project-a");
    });

    expect(result.current.desktopTargets).toEqual([]);
  });
});
