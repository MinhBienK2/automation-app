import { render, screen, within } from "@testing-library/react";
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

describe("ProjectsPage", () => {
  test("shows collection tabs and children by default when a project is selected", () => {
    renderPage();

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

  test("shows a card grid with stats after View all projects is opened", () => {
    const { props } = renderPage();

    // Before click, header shows selected project name
    expect(screen.getByRole("button", { name: /tiktok automation/i })).toBeInTheDocument();

    // breadcrumb "Projects" opens the browse grid
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

    // Now header should show "All Projects"
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

  test("switches the selected project via the header dropdown search", () => {
    const { props } = renderPage();

    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));
    const menu = screen.getByRole("listbox", { name: /select project/i });
    fireEvent.change(within(menu).getByPlaceholderText(/search projects/i), {
      target: { value: "facebook" },
    });
    fireEvent.click(within(menu).getByRole("option", { name: /facebook crm/i }));

    expect(props.onSelectProject).toHaveBeenCalledWith("project-2");
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

    const sections = screen.getByRole("navigation", { name: "Project sections" });
    const workflowsTab = within(sections).getByRole("button", { name: "Workflows" });
    const subflowsTab = within(sections).getByRole("button", { name: "Subflows" });
    const profilesTab = within(sections).getByRole("button", { name: "Profiles" });

    expect(within(workflowsTab).getByText("4")).toBeInTheDocument();
    expect(within(subflowsTab).getByText("3")).toBeInTheDocument();
    expect(within(profilesTab).getByText("2")).toBeInTheDocument();
  });

  test("opens the create project dialog from the header dropdown", () => {
    renderPage();

    fireEvent.click(screen.getByRole("button", { name: /tiktok automation/i }));
    const menu = screen.getByRole("listbox", { name: /select project/i });
    fireEvent.click(within(menu).getByRole("button", { name: "Create project" }));

    expect(
      screen.getByRole("dialog", { name: /create project/i }),
    ).toBeInTheDocument();
  });

  test("shows action menu dropdown on project card in list and handles actions", () => {
    const { props } = renderPage();

    // Open projects grid
    fireEvent.click(screen.getByRole("button", { name: "Projects" }));

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

    // Reopen menu
    fireEvent.click(actionsBtn);
    
    // Test Export callback
    fireEvent.click(screen.getByRole("button", { name: /export/i }));
    expect(props.onExportProject).toHaveBeenCalledWith("project-1");

    // Reopen menu
    fireEvent.click(actionsBtn);

    // Test Delete callback
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(props.onDeleteProject).toHaveBeenCalledWith("project-1");
  });
});
