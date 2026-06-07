import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ProjectsPage } from "./ProjectsPage";
import type { Project } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Default Project",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("ProjectsPage", () => {
  test("renders the selected collection as the full right-column content without a duplicate project header", () => {
    const { container } = render(
      <ProjectsPage
        projects={[project]}
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
    expect(within(projectList).getByRole("navigation", {
      name: "Default Project collections",
    })).toBeInTheDocument();

    const detail = screen.getByRole("region", { name: "Project detail" });
    expect(within(detail).getByRole("region", {
      name: "Default Project Workflows",
    })).toBeInTheDocument();
    expect(within(detail).getByRole("heading", { name: "Workflows" })).toBeInTheDocument();
    expect(within(detail).queryByText("Selected Project")).not.toBeInTheDocument();
    expect(container.querySelector(".projects-detail-header")).not.toBeInTheDocument();
  });
});
