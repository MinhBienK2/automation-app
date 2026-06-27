import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Folder, Plus, Search } from "lucide-react";
import { Button } from "../ui/button";
import type { Project } from "../../types/workflow";

function useDismissOnOutside(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);
  return containerRef;
}

type WorkspaceHeaderProps = {
  projects: Project[];
  selectedProject: Project | null;
  onSelectProject: (projectId: string) => void;
  onViewAllProjects: () => void;
  onCreateProject: () => void;
  actions?: ReactNode;
};

export function WorkspaceHeader({
  projects,
  selectedProject,
  onSelectProject,
  onViewAllProjects,
  onCreateProject,
  actions,
}: WorkspaceHeaderProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useDismissOnOutside(open, () => setOpen(false));

  function close() {
    setSearch("");
    setOpen(false);
  }

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const visibleProjects = normalizedSearch
    ? projects.filter((project) =>
        `${project.name} ${project.description ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedSearch),
      )
    : projects;

  const triggerLabel = selectedProject?.name ?? "All Projects";

  return (
    <header className="workspace-header">
      <nav aria-label="Breadcrumb" className="workspace-breadcrumb">
        <button
          className="workspace-breadcrumb-link"
          type="button"
          onClick={() => {
            onViewAllProjects();
          }}
        >
          Projects
        </button>
        <span className="workspace-breadcrumb-separator">/</span>
        <div className="project-selector" ref={containerRef}>
          <Button
            aria-expanded={open}
            aria-haspopup="listbox"
            className="dropdown-trigger"
            type="button"
            variant="ghost"
            onClick={() => setOpen((prev) => !prev)}
          >
            {triggerLabel}
            <ChevronDown aria-hidden="true" />
          </Button>
          {open ? (
            <ProjectDropdownMenu
              onCreateProject={() => {
                onCreateProject();
                close();
              }}
              onSelectProject={(id) => {
                onSelectProject(id);
                close();
              }}
              onViewAllProjects={() => {
                onViewAllProjects();
                close();
              }}
              projects={visibleProjects}
              search={search}
              selectedProjectId={selectedProject?.id ?? null}
              onSearchChange={setSearch}
            />
          ) : null}
        </div>
      </nav>
      {actions ? <div className="workspace-header-actions">{actions}</div> : null}
    </header>
  );
}

type ProjectDropdownMenuProps = {
  projects: Project[];
  search: string;
  selectedProjectId: string | null;
  onSearchChange: (value: string) => void;
  onSelectProject: (id: string) => void;
  onViewAllProjects: () => void;
  onCreateProject: () => void;
};

function ProjectDropdownMenu({
  projects,
  search,
  selectedProjectId,
  onSearchChange,
  onSelectProject,
  onViewAllProjects,
  onCreateProject,
}: ProjectDropdownMenuProps) {
  return (
    <div className="project-dropdown-menu" role="listbox" aria-label="Select project">
      <div className="dropdown-search">
        <Search aria-hidden="true" />
        <input
          aria-label="Search projects"
          placeholder="Search projects"
          type="text"
          value={search}
          onChange={(event) => onSearchChange(event.currentTarget.value)}
        />
      </div>
      <div className="dropdown-list">
        {projects.length === 0 ? (
          <div className="dropdown-empty">No matching projects</div>
        ) : (
          projects.map((project) => {
            const active = selectedProjectId === project.id;
            return (
              <button
                aria-selected={active}
                className="dropdown-item"
                data-active={active ? "true" : "false"}
                key={project.id}
                role="option"
                type="button"
                onClick={() => onSelectProject(project.id)}
              >
                <span>{project.name}</span>
              </button>
            );
          })
        )}
      </div>
      <div className="dropdown-footer">
        <Button
          className="dropdown-action"
          data-variant="create"
          type="button"
          variant="ghost"
          onClick={onCreateProject}
        >
          <Plus aria-hidden="true" />
          Create project
        </Button>
        <Button
          className="dropdown-action"
          type="button"
          variant="ghost"
          onClick={onViewAllProjects}
        >
          <Folder aria-hidden="true" />
          View all projects
        </Button>
      </div>
    </div>
  );
}
