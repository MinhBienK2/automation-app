import { Folder, Plus } from "lucide-react";
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

export type ProjectTab = "workflows" | "subflows" | "settings";

type ProjectsPageProps = {
  projects: Project[];
  selectedProject: Project | null;
  activeTab: ProjectTab;
  error: string;
  children: ReactNode;
  onSelectProject: (projectId: string) => void;
  onCreateProject: (input: { name: string; description?: string | null }) => Promise<void>;
  onTabChange: (tab: ProjectTab) => void;
};

const projectTabs: Array<{ id: ProjectTab; label: string }> = [
  { id: "workflows", label: "Workflows" },
  { id: "subflows", label: "Subflows" },
  { id: "settings", label: "Settings" },
];

export function ProjectsPage({
  projects,
  selectedProject,
  activeTab,
  error,
  children,
  onSelectProject,
  onCreateProject,
  onTabChange,
}: ProjectsPageProps) {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [projectNameDraft, setProjectNameDraft] = useState("");
  const [projectDescriptionDraft, setProjectDescriptionDraft] = useState("");
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

  const activeTabLabel =
    projectTabs.find((tab) => tab.id === activeTab)?.label ?? "Workflows";

  return (
    <section className="app-screen projects-screen" aria-label="Projects">
      <header className="app-header">
        <div>
          <p className="eyebrow">Project Workspace</p>
          <h1>Projects</h1>
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
          {projects.length === 0 ? (
            <div className="empty-state">
              <h2>No projects yet</h2>
              <p className="muted">Create a project before authoring workflows.</p>
            </div>
          ) : (
            <div className="projects-list">
              {projects.map((project) => {
                const active = selectedProject?.id === project.id;
                return (
                  <button
                    className="project-row"
                    data-active={active ? "true" : "false"}
                    key={project.id}
                    type="button"
                    onClick={() => onSelectProject(project.id)}
                  >
                    <Folder aria-hidden="true" />
                    <span>
                      <strong>{project.name}</strong>
                      {project.description ? <small>{project.description}</small> : null}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        <section className="projects-detail-panel" aria-label="Project detail">
          {selectedProject ? (
            <>
              <div className="projects-detail-header">
                <div>
                  <p className="eyebrow">Selected Project</p>
                  <h2>{selectedProject.name}</h2>
                </div>
                <nav
                  aria-label="Project sections"
                  className="project-tabs"
                  role="tablist"
                >
                  {projectTabs.map((tab) => (
                    <Button
                      aria-selected={activeTab === tab.id}
                      className="project-tab"
                      data-active={activeTab === tab.id ? "true" : "false"}
                      key={tab.id}
                      role="tab"
                      type="button"
                      variant={activeTab === tab.id ? "default" : "ghost"}
                      onClick={() => onTabChange(tab.id)}
                    >
                      {tab.label}
                    </Button>
                  ))}
                </nav>
              </div>

              <section
                aria-label={`${selectedProject.name} ${activeTabLabel}`}
                className="project-tab-panel"
                role="tabpanel"
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
