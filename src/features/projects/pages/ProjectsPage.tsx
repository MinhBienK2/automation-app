import { Copy, Download, MoreVertical, Search, Trash, Upload } from "lucide-react";
import { useMemo, useState, useEffect, type FormEvent, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { WorkspaceHeader } from "../../../components/layout/WorkspaceHeader";
import type { Project } from "../../../types/workflow";

export type ProjectCollection = "workflows" | "subflows" | "profiles" | "settings";

export type ProjectStats = {
  workflows: number;
  subflows: number;
  profiles: number;
};

export type ProjectsPageProps = {
  projects: Project[];
  selectedProject: Project | null;
  activeCollection: ProjectCollection;
  error: string;
  projectStats?: Record<string, ProjectStats>;
  children: ReactNode;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { name: string; description?: string | null }) => Promise<void>;
  onImportProjectPackageFile: (file: File | null) => void;
  onCollectionChange: (collection: ProjectCollection) => void;
  onDuplicateProject?: (projectId: string) => void;
  onExportProject?: (projectId: string) => void;
  onDeleteProject?: (projectId: string) => void;
};

const projectCollections: Array<{
  id: ProjectCollection;
  label: string;
  stat?: keyof ProjectStats;
}> = [
  { id: "workflows", label: "Workflows", stat: "workflows" },
  { id: "subflows", label: "Subflows", stat: "subflows" },
  { id: "profiles", label: "Profiles", stat: "profiles" },
  { id: "settings", label: "Settings" },
];

export function ProjectsPage({
  projects,
  selectedProject,
  activeCollection,
  error,
  projectStats,
  children,
  onSelectProject,
  onCreateProject,
  onImportProjectPackageFile,
  onCollectionChange,
  onDuplicateProject,
  onExportProject,
  onDeleteProject,
}: ProjectsPageProps) {
  const [browsing, setBrowsing] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
  const [projectError, setProjectError] = useState("");
  const [gridSearchDraft, setGridSearchDraft] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (openActionMenuId && !(event.target as HTMLElement).closest(".action-menu-wrapper")) {
        setOpenActionMenuId(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [openActionMenuId]);

  const activeCollectionLabel =
    projectCollections.find((collection) => collection.id === activeCollection)?.label ??
    "Workflows";

  const selectedStats = selectedProject
    ? (projectStats?.[selectedProject.id] ?? { workflows: 0, subflows: 0, profiles: 0 })
    : null;

  const visibleProjects = useMemo(() => {
    const normalized = gridSearchDraft.trim().toLocaleLowerCase();
    if (!normalized) return projects;
    return projects.filter((project) =>
      `${project.name} ${project.description ?? ""}`
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [projects, gridSearchDraft]);

  function handleSelectProject(projectId: string) {
    setBrowsing(false);
    onSelectProject(projectId);
  }

  function openCreateDialog() {
    setBrowsing(false);
    setCreateDialogOpen(true);
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    const name = projectNameDraft.trim();
    if (!name) {
      setProjectError("Project name is required");
      return;
    }
    await onCreateProject({
      name,
      description: projectDescriptionDraft.trim() || null,
    });
    setCreateDialogOpen(false);
    setProjectNameDraft("");
    setProjectDescriptionDraft("");
    setProjectError("");
  }

  function closeProjectDialog() {
    setCreateDialogOpen(false);
    setProjectNameDraft("");
    setProjectDescriptionDraft("");
    setProjectError("");
  }

  return (
    <section className="app-screen projects-screen" aria-label="Projects">
      <WorkspaceHeader
        onCreateProject={openCreateDialog}
        onSelectProject={handleSelectProject}
        onViewAllProjects={() => setBrowsing(true)}
        projects={projects}
        selectedProject={browsing ? null : selectedProject}
      />

      {browsing || !selectedProject ? (
        <div className="project-grid-view">
          <div className="project-grid-header">
            <div className="search-input-wrapper">
              <Search aria-hidden="true" />
              <Label className="sr-only" htmlFor="project-grid-search">
                Search projects
              </Label>
              <Input
                id="project-grid-search"
                className="text-input"
                placeholder="Search projects..."
                value={gridSearchDraft}
                onChange={(event) => setGridSearchDraft(event.currentTarget.value)}
              />
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <label
                className="btn"
                style={{
                  position: "relative",
                  cursor: "pointer",
                  borderRadius: "9999px",
                  padding: "5px 16px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Upload style={{ width: "12px", height: "12px" }} />
                Import Project
                <input
                  aria-label="Project package file"
                  className="workflow-package-file-input"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    onImportProjectPackageFile(event.currentTarget.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <button
                className="btn btn-primary"
                style={{
                  borderRadius: "9999px",
                  padding: "5px 16px",
                  display: "inline-flex",
                  alignItems: "center",
                }}
                type="button"
                onClick={openCreateDialog}
              >
                Create Project
              </button>
            </div>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state panel">
              <h2>No projects yet</h2>
              <p className="muted">Create a project before authoring workflows.</p>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="empty-state panel">
              <h2>No matching projects</h2>
              <p className="muted">Try a different project name or description.</p>
            </div>
          ) : (
            <ul aria-label="Projects" className="project-grid-layout" role="list">
              {visibleProjects.map((project) => {
                const stat = projectStats?.[project.id] ?? {
                  workflows: 0,
                  subflows: 0,
                  profiles: 0,
                };
                const initials = project.name.slice(0, 2).toUpperCase();
                return (
                  <li key={project.id}>
                    <div
                      className={`project-card${openActionMenuId === project.id ? " menu-open" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={project.name}
                      onClick={() => handleSelectProject(project.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectProject(project.id);
                        }
                      }}
                    >
                      <div className="project-card-top">
                        <div className="project-card-icon">{initials}</div>
                        <span className="project-card-name">{project.name}</span>
                      </div>
                      <p className="project-card-desc">
                        {project.description ?? "No description"}
                      </p>
                      <div className="project-card-stats">
                        <div className="project-card-stat">
                          <span className="project-card-stat-num">{stat.workflows}</span>
                          <span className="project-card-stat-label">Workflows</span>
                        </div>
                        <div className="project-card-stat">
                          <span className="project-card-stat-num">{stat.subflows}</span>
                          <span className="project-card-stat-label">Subflows</span>
                        </div>
                        <div className="project-card-stat">
                          <span className="project-card-stat-num">{stat.profiles}</span>
                          <span className="project-card-stat-label">Profiles</span>
                        </div>
                      </div>
                      <div className="project-card-footer">
                        <div className="action-menu-wrapper">
                          <button
                            className="btn-action-circle"
                            type="button"
                            aria-label="More actions"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === project.id ? null : project.id);
                            }}
                          >
                            <MoreVertical />
                          </button>
                          {openActionMenuId === project.id && (
                            <div className="action-dropdown" onClick={(e) => e.stopPropagation()}>
                              {onDuplicateProject && (
                                <button
                                  className="action-dropdown-item"
                                  type="button"
                                  onClick={() => {
                                    onDuplicateProject(project.id);
                                    setOpenActionMenuId(null);
                                  }}
                                >
                                  <Copy className="h-4 w-4" /> Duplicate
                                </button>
                              )}
                              {onExportProject && (
                                <button
                                  className="action-dropdown-item"
                                  type="button"
                                  onClick={() => {
                                    onExportProject(project.id);
                                    setOpenActionMenuId(null);
                                  }}
                                >
                                  <Download className="h-4 w-4" /> Export
                                </button>
                              )}
                              {onDeleteProject && (
                                <>
                                  <div className="action-dropdown-sep" />
                                  <button
                                    className="action-dropdown-item destructive"
                                    type="button"
                                    onClick={() => {
                                      onDeleteProject(project.id);
                                      setOpenActionMenuId(null);
                                    }}
                                  >
                                    <Trash className="h-4 w-4" /> Delete
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      ) : (
        <section aria-label="Project detail" className="projects-detail-panel">
          <div className="project-tabs-bar">
            <nav aria-label="Project sections" className="horizontal-tabs">
              {projectCollections.map((collection) => {
                const count = collection.stat
                  ? selectedStats?.[collection.stat] ?? 0
                  : null;
                const isActive = activeCollection === collection.id;
                return (
                  <button
                    aria-current={isActive ? "page" : undefined}
                    className={`h-tab ${isActive ? "active" : ""}`}
                    key={collection.id}
                    type="button"
                    onClick={() => onCollectionChange(collection.id)}
                  >
                    {collection.label}
                    {count !== null && count > 0 ? (
                      <span aria-hidden="true" className="tab-badge">
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          </div>
          <section
            aria-label={`${selectedProject.name} ${activeCollectionLabel}`}
            className="project-collection-panel"
          >
            {children}
          </section>
        </section>
      )}

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <Dialog
        open={createDialogOpen}
        onOpenChange={(open) => {
          if (!open) closeProjectDialog();
        }}
      >
        <DialogContent className="workflow-dialog">
          <DialogHeader>
            <p className="eyebrow">Project</p>
            <DialogTitle>Create Project</DialogTitle>
            <DialogDescription>
              Create a project to group workflows, subflows, and browser launch environments.
            </DialogDescription>
          </DialogHeader>
          <form className="workflow-dialog-form" onSubmit={submitProject}>
            <Label htmlFor="project-name">Project name</Label>
            <Input
              autoFocus
              id="project-name"
              value={projectNameDraft}
              onChange={(event) => setProjectNameDraft(event.currentTarget.value)}
              placeholder="Staging abuse lab"
            />
            <Label htmlFor="project-description">Description</Label>
            <Input
              id="project-description"
              value={projectDescriptionDraft}
              onChange={(event) => setProjectDescriptionDraft(event.currentTarget.value)}
              placeholder="Owned staging workflows"
            />
            {projectError ? <p className="field-error">{projectError}</p> : null}
            <DialogFooter className="form-actions">
              <Button shape="pill" type="submit">
                Create
              </Button>
              <Button variant="secondary" type="button" onClick={closeProjectDialog}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
