import { Copy, Download, MoreVertical, Trash, Upload } from "lucide-react";
import { useMemo, useState, useEffect, type FormEvent, type ReactNode } from "react";
import { Button } from "../../../components/ui/button";
import { Badge } from "../../../components/ui/badge";
import { Alert } from "../../../components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { WorkspaceHeader } from "../../../components/layout/WorkspaceHeader";
import type { Project } from "../../../types/workflow";
import { SearchInput } from "../../../components/ui/search-input";
import { ConfirmDialog } from "../../../components/ui/confirm-dialog";
import { FormField } from "../../../components/ui/form-field";

export type { ProjectCollection } from "../../../shared/types/workspaceContracts";
import type { ProjectCollection } from "../../../shared/types/workspaceContracts";

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
  browseMode?: "grid" | "detail";
  children: ReactNode;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { name: string; description?: string | null }) => Promise<void>;
  onImportProjectPackageFile: (file: File | null) => void;
  onCollectionChange: (collection: ProjectCollection) => void;
  onDuplicateProject?: (projectId: string) => Promise<void>;
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
  { id: "desktop-targets", label: "Desktop Targets" },
  { id: "settings", label: "Settings" },
];

export function ProjectsPage({
  projects,
  selectedProject,
  activeCollection,
  error,
  projectStats,
  browseMode,
  children,
  onSelectProject,
  onCreateProject,
  onImportProjectPackageFile,
  onCollectionChange,
  onDuplicateProject,
  onExportProject,
  onDeleteProject,
}: ProjectsPageProps) {
  const [browsing, setBrowsing] = useState(true);

  useEffect(() => {
    if (browseMode !== undefined) {
      setBrowsing(browseMode === "grid");
    }
  }, [browseMode]);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteProjectCandidateId, setDeleteProjectCandidateId] = useState<string | null>(null);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
  const [projectError, setProjectError] = useState("");
  const [gridSearchDraft, setGridSearchDraft] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [duplicatingProjectId, setDuplicatingProjectId] = useState<string | null>(null);

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
    setCreateDialogOpen(true);
  }

  async function submitProject(event: FormEvent) {
    event.preventDefault();
    const name = projectNameDraft.trim();
    if (!name) {
      setProjectError("Project name is required");
      return;
    }
    setCreating(true);
    try {
      await onCreateProject({
        name,
        description: projectDescriptionDraft.trim() || null,
      });
      setCreateDialogOpen(false);
      setProjectNameDraft("");
      setProjectDescriptionDraft("");
      setProjectError("");
    } catch (err: any) {
      setProjectError(err.message || "Failed to create project");
    } finally {
      setCreating(false);
    }
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
        onViewAllProjects={() => setBrowsing(true)}
        selectedProject={browsing ? null : selectedProject}
      />

      {browsing || !selectedProject ? (
        <div className="project-grid-view mt-4">
          <div className="project-grid-header flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between mb-6">
            <SearchInput
              value={gridSearchDraft}
              onChange={setGridSearchDraft}
              placeholder="Search projects..."
              label="Search projects"
              className="flex-grow max-w-md"
            />

            <div className="flex items-center gap-3">
              <label
                className="btn btn-secondary btn-sm cursor-pointer relative inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Project</span>
                <input
                  aria-label="Project package file"
                  className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                  type="file"
                  accept="application/json,.json"
                  onChange={(event) => {
                    onImportProjectPackageFile(event.currentTarget.files?.[0] ?? null);
                    event.currentTarget.value = "";
                  }}
                />
              </label>
              <Button
                type="button"
                onClick={openCreateDialog}
                className="btn-primary btn-sm inline-flex items-center"
              >
                Create Project
              </Button>
            </div>
          </div>
          {projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg bg-base-200 border border-dashed border-base-300 text-secondary">
              <h2 className="text-sm font-bold text-base-content mb-1">No projects yet</h2>
              <p className="text-xs">Create a project before authoring workflows.</p>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-lg bg-base-200 border border-dashed border-base-300 text-secondary">
              <h2 className="text-sm font-bold text-base-content mb-1">No matching projects</h2>
              <p className="text-xs">Try a different project name or description.</p>
            </div>
          ) : (
            <ul aria-label="Projects" className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" role="list">
              {visibleProjects.map((project) => {
                const stat = projectStats?.[project.id] ?? {
                  workflows: 0,
                  subflows: 0,
                  profiles: 0,
                };
                const initials = project.name.slice(0, 2).toUpperCase();
                const isDuplicating = duplicatingProjectId === project.id;
                return (
                  <li key={project.id}>
                    <div
                      className={`card bg-base-200 border border-base-300 card-body p-5 hover:border-primary transition-colors cursor-pointer relative group ${
                        openActionMenuId === project.id ? "border-primary" : ""
                      } ${duplicatingProjectId ? "opacity-60 cursor-not-allowed" : ""}`}
                      role="button"
                      tabIndex={0}
                      aria-label={project.name}
                      onClick={() => {
                        if (duplicatingProjectId) return;
                        handleSelectProject(project.id);
                      }}
                      onKeyDown={(e) => {
                        if (duplicatingProjectId) return;
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleSelectProject(project.id);
                        }
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                          {isDuplicating ? (
                            <span className="loading loading-spinner loading-xs text-primary" />
                          ) : (
                            initials
                          )}
                        </div>
                        <span className="font-bold text-base-content text-sm truncate">{project.name}</span>
                      </div>
                      <p className="text-secondary text-xs line-clamp-2 mt-2 flex-grow">
                        {project.description ?? "No description"}
                      </p>
                      <div className="grid grid-cols-3 gap-2 mt-4 pt-3 border-t border-base-300/60 text-center">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-base-content">{stat.workflows}</span>
                          <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">Workflows</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-base-content">{stat.subflows}</span>
                          <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">Subflows</span>
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-sm text-base-content">{stat.profiles}</span>
                          <span className="text-[10px] text-secondary font-medium uppercase tracking-wider">Profiles</span>
                        </div>
                      </div>
                      <div className="absolute top-4 right-4" onClick={(e) => e.stopPropagation()}>
                        <div className="action-menu-wrapper relative">
                          <button
                            className="w-7 h-7 rounded-full flex items-center justify-center border border-base-300 bg-base-100 hover:bg-base-300 text-secondary hover:text-base-content transition-colors cursor-pointer"
                            type="button"
                            aria-label="More actions"
                            disabled={duplicatingProjectId !== null}
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenActionMenuId(openActionMenuId === project.id ? null : project.id);
                            }}
                          >
                            <MoreVertical size={14} />
                          </button>
                          {openActionMenuId === project.id && (
                            <div className="absolute right-0 mt-1 p-1 bg-base-200 border border-base-300 rounded-lg shadow-lg w-32 z-50 flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
                              {onDuplicateProject && (
                                <button
                                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-base-content hover:bg-base-300 rounded-md text-left w-full cursor-pointer transition-colors"
                                  type="button"
                                  disabled={duplicatingProjectId !== null}
                                  onClick={async () => {
                                    setOpenActionMenuId(null);
                                    setDuplicatingProjectId(project.id);
                                    try {
                                      await onDuplicateProject(project.id);
                                    } finally {
                                      setDuplicatingProjectId(null);
                                    }
                                  }}
                                >
                                  <Copy className="h-3.5 w-3.5 shrink-0" />
                                  <span>Duplicate</span>
                                </button>
                              )}
                              {onExportProject && (
                                <button
                                  className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-base-content hover:bg-base-300 rounded-md text-left w-full cursor-pointer transition-colors"
                                  type="button"
                                  onClick={() => {
                                    onExportProject(project.id);
                                    setOpenActionMenuId(null);
                                  }}
                                >
                                  <Download className="h-3.5 w-3.5 shrink-0" />
                                  <span>Export</span>
                                </button>
                              )}
                              {onDeleteProject && (
                                <>
                                  <div className="divider my-0.5" />
                                  <button
                                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-error hover:bg-error/10 rounded-md text-left w-full cursor-pointer transition-colors"
                                    type="button"
                                    onClick={() => {
                                      setDeleteProjectCandidateId(project.id);
                                      setOpenActionMenuId(null);
                                    }}
                                  >
                                    <Trash className="h-3.5 w-3.5 shrink-0" />
                                    <span>Delete</span>
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
        <section aria-label="Project detail" className="projects-detail-panel mt-4">
          <nav aria-label="Project sections" className="tabs tabs-bordered w-full mb-4">
            {projectCollections.map((collection) => {
              const count = collection.stat
                ? selectedStats?.[collection.stat] ?? 0
                : null;
              const isActive = activeCollection === collection.id;
              return (
                <button
                  aria-current={isActive ? "page" : undefined}
                  className={`tab font-semibold text-xs pb-3 ${isActive ? "tab-active text-primary border-primary" : "text-secondary"}`}
                  key={collection.id}
                  type="button"
                  onClick={() => onCollectionChange(collection.id)}
                >
                  <span>{collection.label}</span>
                  {count !== null && count > 0 ? (
                    <Badge aria-hidden="true" variant="secondary" className="badge-sm ml-1.5 font-bold">
                      {count}
                    </Badge>
                  ) : null}
                </button>
              );
            })}
          </nav>
          <section
            aria-label={`${selectedProject.name} ${activeCollectionLabel}`}
            className="project-collection-panel"
          >
            {children}
          </section>
        </section>
      )}

      {error ? (
        <Alert variant="error" className="text-xs p-3 mt-4">
          {error}
        </Alert>
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
          <form className="flex flex-col gap-4 mt-2" onSubmit={submitProject}>
            <FormField label="Project name" htmlFor="project-name">
              <Input
                autoFocus
                id="project-name"
                value={projectNameDraft}
                onChange={(event) => setProjectNameDraft(event.currentTarget.value)}
                placeholder="Staging abuse lab"
                className="input-sm border-base-300"
              />
            </FormField>
            <FormField label="Description" htmlFor="project-description">
              <Input
                id="project-description"
                value={projectDescriptionDraft}
                onChange={(event) => setProjectDescriptionDraft(event.currentTarget.value)}
                placeholder="Owned staging workflows"
                className="input-sm border-base-300"
              />
            </FormField>
            {projectError ? <p className="text-error text-xs font-semibold">{projectError}</p> : null}
            <DialogFooter className="form-actions flex gap-2">
              <Button type="submit" disabled={creating} loading={creating} className="btn-primary">
                Create
              </Button>
              <Button variant="secondary" type="button" disabled={creating} onClick={closeProjectDialog}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteProjectCandidateId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteProjectCandidateId(null);
        }}
        title="Delete Project?"
        description="This will permanently delete the project and all workflows, subflows, and browser profiles inside it. This action cannot be undone."
        confirmText="Delete"
        variant="destructive"
        onConfirm={() => {
          if (deleteProjectCandidateId && onDeleteProject) {
            onDeleteProject(deleteProjectCandidateId);
          }
        }}
      />
    </section>
  );
}
