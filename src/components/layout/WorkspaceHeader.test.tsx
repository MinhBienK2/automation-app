import { render, screen } from "@testing-library/react";
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
];

function renderHeader(overrides: Partial<React.ComponentProps<typeof WorkspaceHeader>> = {}) {
  const props = {
    selectedProject: null,
    onViewAllProjects: vi.fn(),
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

  test("shows the selected project name as static text in the breadcrumb when one is selected", () => {
    renderHeader({ selectedProject: projects[0] });

    expect(screen.getByText("Tiktok Automation")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /tiktok automation/i })).not.toBeInTheDocument();
  });
});
