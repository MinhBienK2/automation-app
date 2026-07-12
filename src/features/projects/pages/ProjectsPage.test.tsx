import { render, screen, within, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ProjectsPage, type ProjectsPageProps } from "./ProjectsPage";
import type { Project } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Tiktok Automation",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const otherProject: Project = {
  id: "project-2",
  name: "Facebook CRM",
  description: "Lead ads sync",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const stats = {
  "project-1": { workflows: 4, subflows: 3, profiles: 2 },
  "project-2": { workflows: 1, subflows: 1, profiles: 1 },
};

function renderPage(overrides: Partial<ProjectsPageProps> = {}) {
  const props: ProjectsPageProps = {
    projects: [project, otherProject],
    selectedProject: project,
    activeCollection: "workflows",
    error: "",
    projectStats: stats,
    onSelectProject: vi.fn(),
    onCreateProject: vi.fn(),
    onImportProjectPackageFile: vi.fn(),
    onCollectionChange: vi.fn(),
    onDuplicateProject: vi.fn(),
    onExportProject: vi.fn(),
    onDeleteProject: vi.fn(),
    children: <section aria-label="Workflow Library">library</section>,
    ...overrides,
  };
  return { props, ...render(<ProjectsPage {...props} />) };
}

function openProjectDetail() {
  const grid = screen.getByRole("list", { name: /projects/i });
  fireEvent.click(within(grid).getByLabelText("Tiktok Automation"));
}

describe("ProjectsPage", () => {
  test("defaults to the projects grid when navigated to via the sidebar", () => {
    renderPage();

    expect(screen.getByRole("list", { name: /projects/i })).toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Project sections" })).not.toBeInTheDocument();
  });

  test("shows collection tabs and children after opening a project from the grid", () => {
    renderPage();

    openProjectDetail();

    const sections = screen.getByRole("navigation", { name: "Project sections" });
    expect(within(sections).getByRole("button", { name: "Workflows" }))
      .toHaveAttribute("aria-current", "page");
    expect(within(sections).getByRole("button", { name: "Subflows" }))
      .toBeInTheDocument();

    expect(
      screen.getByRole("region", { name: /tiktok automation workflows/i }),
    ).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: /projects/i })).not.toBeInTheDocument();
  });

  test("shows a card grid with stats and lets users open a project", () => {
    const { props } = renderPage();

    // Default view is the grid (no selected detail yet)
    expect(screen.getByText("All Projects")).toBeInTheDocument();

    const grid = screen.getByRole("list", { name: /projects/i });
    expect(within(grid).getByText("Tiktok Automation")).toBeInTheDocument();
    expect(within(grid).getByText("Facebook CRM")).toBeInTheDocument();
    expect(within(grid).getAllByText("4").length).toBeGreaterThan(0);
    expect(screen.queryByText("Active")).not.toBeInTheDocument();

    fireEvent.click(within(grid).getByText("Facebook CRM"));
    expect(props.onSelectProject).toHaveBeenCalledWith("project-2");
    expect(screen.queryByRole("list", { name: /projects/i })).not.toBeInTheDocument();
  });

  test("offers import and create actions in the projects list grid", async () => {
    const { props } = renderPage({ selectedProject: null });

    await userEvent.upload(
      screen.getByLabelText("Project package file"),
      new File(["{}"], "lab.project.json", { type: "application/json" }),
    );
    expect(props.onImportProjectPackageFile).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /^create project$/i }));
    expect(
      await screen.findByRole("dialog", { name: /create project/i }),
    ).toBeInTheDocument();
  });

  test("shows count badges on collection tabs reflecting selected project stats", () => {
    renderPage();

    // Must open a project first to see collection tabs
    openProjectDetail();

    const sections = screen.getByRole("navigation", { name: "Project sections" });
    const workflowsTab = within(sections).getByRole("button", { name: "Workflows" });
    const subflowsTab = within(sections).getByRole("button", { name: "Subflows" });
    const profilesTab = within(sections).getByRole("button", { name: "Profiles" });

    expect(within(workflowsTab).getByText("4")).toBeInTheDocument();
    expect(within(subflowsTab).getByText("3")).toBeInTheDocument();
    expect(within(profilesTab).getByText("2")).toBeInTheDocument();
  });

  test("shows action menu dropdown on project card in list and handles actions", async () => {
    const { props } = renderPage();

    const grid = screen.getByRole("list", { name: /projects/i });
    const card = within(grid).getAllByRole("listitem")[0];

    // Find and click the "More actions" button
    const actionsBtn = within(card).getByRole("button", { name: /more actions/i });
    expect(actionsBtn).toBeInTheDocument();
    fireEvent.click(actionsBtn);

    // Dropdown items should be visible
    const duplicateBtn = screen.getByRole("button", { name: /duplicate/i });
    const exportBtn = screen.getByRole("button", { name: /export/i });
    const deleteBtn = screen.getByRole("button", { name: /delete/i });

    expect(duplicateBtn).toBeInTheDocument();
    expect(exportBtn).toBeInTheDocument();
    expect(deleteBtn).toBeInTheDocument();

    // Test Duplicate callback
    fireEvent.click(duplicateBtn);
    expect(props.onDuplicateProject).toHaveBeenCalledWith("project-1");

    // Wait for duplication state to clear and re-enable action button
    await waitFor(() => {
      expect(actionsBtn).not.toBeDisabled();
    });

    // Reopen menu
    fireEvent.click(actionsBtn);
    
    // Test Export callback
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(props.onExportProject).toHaveBeenCalledWith("project-1");

    // Reopen menu
    fireEvent.click(actionsBtn);

    // Test Delete callback triggers confirmation dialog
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(props.onDeleteProject).not.toHaveBeenCalled();

    // Confirm dialog is open
    const confirmTitle = screen.getByRole("heading", { name: /delete project\?/i });
    expect(confirmTitle).toBeInTheDocument();

    // Clicking cancel should close the dialog and not trigger onDeleteProject
    const cancelBtn = screen.getByRole("button", { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(confirmTitle).not.toBeInTheDocument();
    expect(props.onDeleteProject).not.toHaveBeenCalled();

    // Reopen menu and click delete to confirm
    fireEvent.click(actionsBtn);
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    const confirmBtn = screen.getByRole("button", { name: /^delete$/i });
    fireEvent.click(confirmBtn);
    expect(props.onDeleteProject).toHaveBeenCalledWith("project-1");
  });
});
