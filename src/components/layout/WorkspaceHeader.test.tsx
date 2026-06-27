import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { WorkspaceHeader } from "./WorkspaceHeader";
import type { Project } from "../../types/workflow";

const projects: Project[] = [
  {
    id: "project-1",
    name: "Tiktok Automation",
    description: "desc-1",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "project-2",
    name: "Facebook CRM",
    description: "desc-2",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  },
];

function renderHeader(overrides: Partial<React.ComponentProps<typeof WorkspaceHeader>> = {}) {
  const props = {
    projects,
    selectedProject: null,
    onSelectProject: vi.fn(),
    onViewAllProjects: vi.fn(),
    onCreateProject: vi.fn(),
    ...overrides,
  };
  return { ...props, result: render(<WorkspaceHeader {...props} />) };
}

describe("WorkspaceHeader", () => {
  test("renders the Projects breadcrumb and a text label for All Projects", () => {
    renderHeader();

    expect(screen.getByRole("button", { name: "Projects" })).toBeInTheDocument();
    expect(screen.getByText("All Projects")).toBeInTheDocument();
  });

  test("shows the selected project name in the trigger when one is selected", () => {
    renderHeader({ selectedProject: projects[0] });

    expect(
      screen.getByRole("button", { name: /tiktok automation/i }),
    ).toBeInTheDocument();
  });

  test("opens a searchable project dropdown when the trigger is clicked", () => {
    renderHeader({ selectedProject: projects[0] });

    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));

    const menu = screen.getByRole("listbox", { name: /select project/i });
    expect(within(menu).getByPlaceholderText(/search projects/i)).toBeInTheDocument();
    expect(within(menu).getByRole("option", { name: /tiktok automation/i }))
      .toBeInTheDocument();
    expect(within(menu).getByRole("option", { name: /facebook crm/i }))
      .toBeInTheDocument();
  });

  test("filters the project list by the search query", () => {
    renderHeader({ selectedProject: projects[0] });
    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));

    const menu = screen.getByRole("listbox", { name: /select project/i });
    fireEvent.change(within(menu).getByPlaceholderText(/search projects/i), {
      target: { value: "facebook" },
    });

    expect(within(menu).queryByRole("option", { name: /tiktok automation/i }))
      .not.toBeInTheDocument();
    expect(within(menu).getByRole("option", { name: /facebook crm/i }))
      .toBeInTheDocument();
  });

  test("selects a project and closes the dropdown", () => {
    const onSelectProject = vi.fn();
    renderHeader({ selectedProject: projects[0], onSelectProject });

    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));
    fireEvent.click(
      screen.getByRole("option", { name: /facebook crm/i }),
    );

    expect(onSelectProject).toHaveBeenCalledWith("project-2");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  test("offers create and view-all actions in the dropdown footer", () => {
    const onSelectProject = vi.fn();
    const onViewAllProjects = vi.fn();
    const onCreateProject = vi.fn();
    renderHeader({ selectedProject: projects[0], onSelectProject, onViewAllProjects, onCreateProject });

    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));

    fireEvent.click(screen.getByRole("button", { name: /create project/i }));
    expect(onCreateProject).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));
    fireEvent.click(screen.getByRole("button", { name: /view all projects/i }));
    expect(onViewAllProjects).toHaveBeenCalledOnce();
  });
});
