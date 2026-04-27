import type { WorkflowSummary } from "../../types/workflow";

type WorkflowListPageProps = {
  workflows: WorkflowSummary[];
  newWorkflowName: string;
  appError: string;
  onNewWorkflowNameChange: (name: string) => void;
  onCreateWorkflow: (event: React.FormEvent) => void;
  onOpenWorkflow: (id: string) => void;
  onDeleteWorkflow: (id: string) => void;
};

export function WorkflowListPage({
  workflows,
  newWorkflowName,
  appError,
  onNewWorkflowNameChange,
  onCreateWorkflow,
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
        <div className="header-stats" aria-label="Workflow summary">
          <span>{workflows.length} workflows</span>
          <span>{totalSteps} steps</span>
        </div>
      </header>

      <div className="workflow-list-layout">
        <form className="create-form panel" onSubmit={onCreateWorkflow}>
          <div>
            <h2>Create Workflow</h2>
            <p className="muted">Start with a named workflow, then add browser steps.</p>
          </div>
          <label>
            New workflow name
            <input
              value={newWorkflowName}
              onChange={(event) => onNewWorkflowNameChange(event.currentTarget.value)}
              placeholder="Login flow"
            />
          </label>
          {appError ? <p className="field-error">{appError}</p> : null}
          <button className="primary-button" type="submit">
            Create
          </button>
        </form>

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
      </div>
    </section>
  );
}
