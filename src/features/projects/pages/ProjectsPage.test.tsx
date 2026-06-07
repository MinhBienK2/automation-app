import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { ProjectsPage } from "./ProjectsPage";
import type { Project } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Main",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ProjectsPage", () => {
  test("keeps project filtering in the sidebar and collection navigation in the detail panel", async () => {
    const projects = [
      project,
      {
        id: "project-2",
        name: "Owned Staging",
        description: "Checkout and account integrity workflows",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
      {
        id: "project-3",
        name: "Archive Lab",
        description: "Legacy flows",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      },
    ];
    const { container } = render(
      <ProjectsPage
        projects={projects}
        selectedProject={project}
        activeCollection="workflows"
        error=""
        onSelectProject={vi.fn()}
        onCreateProject={vi.fn()}
        onCollectionChange={vi.fn()}
      >
        <section className="app-screen workflow-list-screen" aria-label="Workflow Library">
          <header className="app-header">
            <h2>Workflows</h2>
          </header>
        </section>
      </ProjectsPage>,
    );

    const projectList = screen.getByRole("complementary", { name: "Project list" });
    expect(within(projectList).queryByRole("navigation")).not.toBeInTheDocument();
    expect(within(projectList).getByLabelText("Search projects")).toBeInTheDocument();
    expect(within(projectList).getByRole("button", { name: /Owned Staging/ }))
      .toBeInTheDocument();

    const detail = screen.getByRole("region", { name: "Project detail" });
    const sections = within(detail).getByRole("navigation", { name: "Project sections" });
    expect(within(sections).getByRole("button", { name: "Workflows" }))
      .toHaveAttribute("aria-current", "page");
    expect(within(sections).getByRole("button", { name: "Subflows" })).toBeInTheDocument();
    expect(within(sections).getByRole("button", { name: "Settings" })).toBeInTheDocument();
    expect(within(detail).getByRole("region", {
      name: "Main Workflows",
    })).toBeInTheDocument();
    expect(within(detail).getByRole("heading", { name: "Workflows" })).toBeInTheDocument();
    expect(within(detail).queryByText("Selected Project")).not.toBeInTheDocument();
    expect(container.querySelector(".projects-detail-header")).not.toBeInTheDocument();

    await userEvent.type(within(projectList).getByLabelText("Search projects"), "archive");

    expect(within(projectList).queryByRole("button", { name: /Owned Staging/ }))
      .not.toBeInTheDocument();
    expect(within(projectList).getByRole("button", { name: /Archive Lab/ }))
      .toBeInTheDocument();
  });
});
