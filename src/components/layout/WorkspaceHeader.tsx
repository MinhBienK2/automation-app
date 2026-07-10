import type { ReactNode } from "react";
import type { Project } from "../../types/workflow";

type WorkspaceHeaderProps = {
  selectedProject: Project | null;
  onViewAllProjects: () => void;
  actions?: ReactNode;
};

export function WorkspaceHeader({
  selectedProject,
  onViewAllProjects,
  actions,
}: WorkspaceHeaderProps) {
  return (
    <header className="workspace-header">
      <nav aria-label="Breadcrumb" className="breadcrumbs text-sm workspace-breadcrumb">
        <ul>
          <li>
            <button
              className="workspace-breadcrumb-link text-base-content hover:underline"
              type="button"
              onClick={onViewAllProjects}
            >
              Projects
            </button>
          </li>
          <li>
            {selectedProject ? (
              <span className="workspace-breadcrumb-current font-medium text-primary">
                {selectedProject.name}
              </span>
            ) : (
              <span className="workspace-breadcrumb-current font-medium text-primary">All Projects</span>
            )}
          </li>
        </ul>
      </nav>
      {actions ? <div className="workspace-header-actions">{actions}</div> : null}
    </header>
  );
}
