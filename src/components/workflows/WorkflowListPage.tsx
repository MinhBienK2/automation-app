import type { WorkflowSummary } from "../../types/workflow";

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  workflowDialogMode: "create" | "edit" | null;
  workflowNameDraft: string;
  appError: string;
  onWorkflowNameDraftChange: (name: string) => void;
  onSubmitWorkflowDialog: (event: React.FormEvent) => void;
  onOpenCreateWorkflow: () => void;
  onOpenEditWorkflow: (workflow: WorkflowSummary) => void;
  onCloseWorkflowDialog: () => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
};

export function WorkflowListPage({
  workflows,
  workflowDialogMode,
  workflowNameDraft,
  appError,
  onWorkflowNameDraftChange,
  onSubmitWorkflowDialog,
  onOpenCreateWorkflow,
  onOpenEditWorkflow,
  onCloseWorkflowDialog,
  onOpenWorkflow,
  onDeleteWorkflow,
}: WorkflowListPageProps) {
  const totalSteps = workflows.reduce(
    (total, workflow) => total + workflow.step_count,
    0,
  );

  return (
    <section className="app-screen workflow-list-screen">
      <header className="app-header">
        <div>
          <p className="eyebrow">Workflow Automation Manager</p>
          <h1>Workflows</h1>
        </div>
        <div className="page-header-actions">
          <div className="header-stats" aria-label="Workflow summary">
            <span>{workflows.length} workflows</span>
            <span>{totalSteps} steps</span>
          </div>
          <button className="primary-button" type="button" onClick={onOpenCreateWorkflow}>
            Create Workflow
          </button>
        </div>
      </header>

      <section className="workflow-library" aria-label="Workflow list">
        {workflows.length === 0 ? (
          <div className="empty-state panel">
            <h2>No workflows yet</h2>
            <p className="muted">Create one to begin building automation steps.</p>
          </div>
        ) : (
          workflows.map((workflow) => (
            <article className="workflow-card" key={workflow.id}>
              <div className="workflow-card-main">
                <div>
                  <h2>{workflow.name}</h2>
                  <p className="muted">{workflow.step_count} steps</p>
                </div>
                <small>Updated {workflow.updated_at}</small>
              </div>
              <div className="row-actions">
                <button
                  className="primary-button"
                  type="button"
                  onClick={() => onOpenWorkflow(workflow.id)}
                >
                  View Details
                </button>
                <button
                  type="button"
                  aria-label={`Edit ${workflow.name}`}
                  onClick={() => onOpenEditWorkflow(workflow)}
                >
                  Edit
                </button>
                <button
                  className="secondary-danger"
                  type="button"
                  onClick={() => onDeleteWorkflow(workflow.id)}
                >
                  Delete
                </button>
              </div>
            </article>
          ))
        )}
      </section>

      {workflowDialogMode ? (
        <div className="modal-backdrop">
          <section
            aria-modal="true"
            aria-label={workflowDialogMode === "create" ? "Create Workflow" : "Edit Workflow"}
            className="workflow-dialog"
            role="dialog"
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">Workflow</p>
                <h2>
                  {workflowDialogMode === "create" ? "Create Workflow" : "Edit Workflow"}
                </h2>
              </div>
              <button className="ghost-button" type="button" onClick={onCloseWorkflowDialog}>
                Close
              </button>
            </div>

            <form className="workflow-dialog-form" onSubmit={onSubmitWorkflowDialog}>
              <label>
                {workflowDialogMode === "create" ? "New workflow name" : "Workflow name"}
                <input
                  autoFocus
                  value={workflowNameDraft}
                  onChange={(event) =>
                    onWorkflowNameDraftChange(event.currentTarget.value)
                  }
                  placeholder="Login flow"
                />
              </label>
              {appError ? <p className="field-error">{appError}</p> : null}
              <div className="form-actions">
                <button className="primary-button" type="submit">
                  {workflowDialogMode === "create" ? "Create" : "Save Changes"}
                </button>
                <button type="button" onClick={onCloseWorkflowDialog}>
                  Cancel
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
