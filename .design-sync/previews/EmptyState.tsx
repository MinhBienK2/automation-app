import { Button, EmptyState } from 'automation-app-ui';
import { CalendarClock, Plus, SearchX, Workflow } from 'lucide-react';

export function Default() {
  return (
    <EmptyState
      icon={Workflow}
      title="No workflows yet"
      description="Workflows describe the browser steps this app replays. Create one to record a login, a form fill, or a nightly export."
      action={
        <Button>
          <Plus size={14} /> New workflow
        </Button>
      }
    />
  );
}

export function NoResults() {
  return (
    <EmptyState
      icon={SearchX}
      title="No runs match these filters"
      description="Nothing was recorded in the selected window. Widen the date range or clear the status filter to see earlier runs."
      action={<Button variant="ghost">Clear filters</Button>}
    />
  );
}

export function WithoutIcon() {
  return (
    <EmptyState
      title="This project has no schedules"
      description="Schedules trigger a workflow on a recurring cadence without anyone opening the app."
      action={
        <Button variant="secondary">
          <CalendarClock size={14} /> Add schedule
        </Button>
      }
    />
  );
}

export function WithoutAction() {
  return (
    <EmptyState
      icon={CalendarClock}
      title="Nothing scheduled for today"
      description="The next queued run starts tomorrow at 02:00. Runs appear here as soon as they are dispatched."
    />
  );
}
