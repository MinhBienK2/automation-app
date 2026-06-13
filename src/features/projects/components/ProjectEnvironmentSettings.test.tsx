import { render, screen, within } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { ProjectEnvironmentSettings } from "./ProjectEnvironmentSettings";
import type { Project } from "../../../types/workflow";

const project: Project = {
  id: "project-1",
  name: "Main",
  description: "Owned staging workflows",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

function renderProjectSettings() {
  return render(
    <ProjectEnvironmentSettings
      project={project}
      error=""
      onUpdateProject={vi.fn()}
      onDuplicateProject={vi.fn()}
      onExportProjectPackage={vi.fn()}
      onDeleteProject={vi.fn()}
    />,
  );
}

describe("ProjectEnvironmentSettings", () => {
  test("keeps the project name save action inline and labels it Save", () => {
    renderProjectSettings();

    const projectNameControl = screen
      .getByLabelText("Project name")
      .closest(".project-name-control");

    expect(projectNameControl).not.toBeNull();
    expect(within(projectNameControl as HTMLElement).getByRole("button", {
      name: "Save",
    })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save project name" }))
      .not.toBeInTheDocument();
  });
});
