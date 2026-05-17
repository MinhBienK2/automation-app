 # Concurrent Isolated Workflow Runs

  ## Summary

  - Allow multiple different workflows to run concurrently from manual Run and schedules.
  - Keep isolation by blocking concurrent runs for the same workflow and blocking runs that would use an already-active persistent browser profile.
  - Do not add a global concurrency limit.
  - Keep batch runs globally exclusive in this version; batch row parallelism remains out of scope.
  - Add a Run Center plus row-level status/Stop controls so users can manage multiple live runs cleanly.

  ## Key Changes

  - Replace the single backend currentRunState/currentRunAbortController/currentRunId model with a run manager keyed by runId.
  - Each active workflow run gets its own AbortController, RunState, runner instance, evidence run id, timeout, and lifecycle cleanup.
  - Track active ownership by workflowId and persistent profile_name:
      - second run for the same workflow is rejected;
      - different workflows may run together;
      - different workflows sharing the same persistent profile are rejected to avoid profile/session interference;
      - temporary-profile workflows can run concurrently.
  - Keep retained browser sessions per workflow/profile instead of one singleton retained session. Starting a new full run closes only that workflow/
    profile’s retained session, not another workflow’s session.
  - run_workflow_from_node remains workflow-scoped and only reuses that workflow’s retained session; it is disabled while that same workflow is running.

  ## API / Contract Changes

  - Add a run snapshot type, e.g. WorkflowRunSnapshot, containing run_id, workflow_id, workflow_name, source, started_at, and state: RunState.
  - Add IPC/bridge wrapper listRunStates(): Promise<WorkflowRunSnapshot[]>.
  - Change stopRun to accept an optional runId; UI will always pass runId. If omitted and multiple runs are active, backend returns a clear command error.
  - Keep runWorkflow(workflowId) returning the newly started run snapshot/state with run_id available.
  - Update scheduler internals to use workflow/profile conflict checks instead of the old global hasActiveRun.
  - Update docs for run-state, execution semantics, lifecycle, command boundary, Electron IPC, frontend architecture, runner architecture, scheduler
    behavior, and README smoke checklist.

  ## UI Changes

  - App.tsx stores run snapshots in a map/list instead of one global runState.
  - Poll listRunStates() while any snapshot is running; terminal snapshots remain visible in the current app session.
  - Workflow list:
      - Run is disabled only for rows whose workflow is already running;
      - active rows show status/progress summary and a row-level Stop;
      - other workflows remain runnable.
  - Workflow detail:
      - uses the selected workflow’s active/latest run state for graph progress and issue display;
      - Run/Stop controls affect only that workflow’s current run;
      - other workflows running elsewhere do not disable this workflow.
  - Add a Run Center screen/view with active and recent session runs, showing workflow name, source manual/schedule, started time, current step/status, error
    summary, and Stop per active run.
  - Read DESIGN.md before implementation because this changes user-facing layout/styling.

  ## Test Plan

  - Follow TDD: write failing tests before production code.
  - Backend command tests:
      - two different workflows can start and progress concurrently;
      - same workflow cannot start twice;
      - profile conflict is rejected;
      - stopping one runId does not abort another run;
      - terminal evidence persists per run id.
  - Runner/session tests:
      - retained session for workflow A is not closed by starting workflow B;
      - run-from-selected only reuses the matching workflow/profile retained session.
  - Scheduler tests:
      - multiple due schedules for different isolated workflows start in one tick;
      - same workflow/profile conflicts are skipped with explicit reasons.
  - Frontend tests:
      - workflow list disables/stops only the active row;
      - detail run controls are scoped to the opened workflow;
      - Run Center renders multiple active runs and stops the selected run.
  - Contract checks:
      - npm test -- electron/backend/commands.test.ts
      - npm test -- electron/backend/scheduler.test.ts
      - npm test -- src/lib/workflowApi.test.ts
      - focused workflow page tests
      - npx tsc --noEmit
      - npm run build:electron

  ## Assumptions

  - “Chạy đồng thời” means different workflows, not multiple simultaneous runs of the same workflow.
  - No hard global run limit is added.
  - Batch remains globally exclusive for now.
  - Manual and scheduled workflow starts both participate in concurrent isolated execution.
