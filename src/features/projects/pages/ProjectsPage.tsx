import { Folder, Plus, Search, Upload } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
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
import type { Project } from "../../../types/workflow";

export type ProjectCollection = "workflows" | "subflows" | "settings";

type ProjectsPageProps = {
  projects: Project[];
  selectedProject: Project | null;
  activeCollection: ProjectCollection;
  error: string;
  children: ReactNode;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { name: string; description?: string | null }) => Promise<void>;
  onImportProjectPackageFile: (file: File | null) => void;
  onCollectionChange: (collection: ProjectCollection) => void;
};

const projectCollections: Array<{ id: ProjectCollection; label: string }> = [
  { id: "workflows", label: "Workflows" },
  { id: "subflows", label: "Subflows" },
  { id: "settings", label: "Settings" },
];

export function ProjectsPage({
  projects,
  selectedProject,
  activeCollection,
  error,
  children,
  onSelectProject,
  onCreateProject,
  onImportProjectPackageFile,
  onCollectionChange,
}: ProjectsPageProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
  const [projectSearchDraft, setProjectSearchDraft] = useState("");
  const [projectError, setProjectError] = useState("");

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

  const activeCollectionLabel =
    projectCollections.find((collection) => collection.id === activeCollection)?.label ??
    "Workflows";
  const normalizedProjectSearch = projectSearchDraft.trim().toLocaleLowerCase();
  const visibleProjects = normalizedProjectSearch
    ? projects.filter((project) =>
        `${project.name} ${project.description ?? ""}`
          .toLocaleLowerCase()
          .includes(normalizedProjectSearch),
      )
    : projects;

  return (
    <section className="app-screen projects-screen" aria-label="Projects">
      <header className="app-header">
        <div>
          <h2>Project Workspace</h2>
          {selectedProject ? (
            <p className="muted">{selectedProject.name}</p>
          ) : (
            <p className="muted">Create or select a project to manage workflows and subflows.</p>
          )}
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Project summary">
            <span>{projects.length} projects</span>
          </div>
          <label className="workflow-import-button">
            <Upload aria-hidden="true" />
            Import project
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
          <Button shape="pill" type="button" onClick={() => setCreateDialogOpen(true)}>
            <Plus aria-hidden="true" />
            Create Project
          </Button>
        </div>
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
      </header>

      <div className="projects-workspace">
        <aside className="projects-list-panel panel" aria-label="Project list">
          <div className="projects-list-tools">
            <div className="projects-list-summary">
              <span>Projects</span>
              <small>
                {visibleProjects.length} of {projects.length}
              </small>
            </div>
            <div className="project-search">
              <Search aria-hidden="true" />
              <Label className="sr-only" htmlFor="project-search">
                Search projects
              </Label>
              <Input
                id="project-search"
                placeholder="Search projects"
                value={projectSearchDraft}
                onChange={(event) => setProjectSearchDraft(event.currentTarget.value)}
              />
            </div>
          </div>
          {projects.length === 0 ? (
            <div className="empty-state">
              <h2>No projects yet</h2>
              <p className="muted">Create a project before authoring workflows.</p>
            </div>
          ) : visibleProjects.length === 0 ? (
            <div className="empty-state">
              <h2>No matching projects</h2>
              <p className="muted">Try a different project name or description.</p>
            </div>
          ) : (
            <div className="projects-list-scroll">
              <div className="projects-list">
                {visibleProjects.map((project) => {
                  const active = selectedProject?.id === project.id;
                  return (
                    <div className="project-list-item" key={project.id}>
                      <button
                        className="project-row"
                        data-active={active ? "true" : "false"}
                        type="button"
                        onClick={() => onSelectProject(project.id)}
                      >
                        <Folder aria-hidden="true" />
                        <span>
                          <strong>{project.name}</strong>
                          {project.description ? <small>{project.description}</small> : null}
                        </span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </aside>

        <section className="projects-detail-panel" aria-label="Project detail">
          {selectedProject ? (
            <>
              <nav aria-label="Project sections" className="project-collection-tabs">
                {projectCollections.map((collection) => (
                  <Button
                    aria-current={activeCollection === collection.id ? "page" : undefined}
                    className="project-collection-item"
                    data-active={activeCollection === collection.id ? "true" : "false"}
                    key={collection.id}
                    type="button"
                    variant={activeCollection === collection.id ? "default" : "ghost"}
                    onClick={() => onCollectionChange(collection.id)}
                  >
                    {collection.label}
                  </Button>
                ))}
              </nav>
              <section
                aria-label={`${selectedProject.name} ${activeCollectionLabel}`}
                className="project-collection-panel"
              >
                {children}
              </section>
            </>
          ) : (
            <div className="empty-state panel">
              <h2>No project selected</h2>
              <p className="muted">Select a project to view its workflows, subflows, and settings.</p>
            </div>
          )}
        </section>
      </div>

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
