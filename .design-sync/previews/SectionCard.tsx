import { Badge, Button, SectionCard, StatusBadge } from 'automation-app-ui';
import { Pencil, Plus } from 'lucide-react';

export function ScheduleSection() {
  return (
    <SectionCard
      title="Schedules"
      actions={
        <Button variant="secondary" size="sm">
          <Plus size={14} /> New schedule
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 13 }}>Nightly inventory sync</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
              0 2 * * *
            </span>
          </div>
          <StatusBadge status="success" customText="Enabled" />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ display: 'grid', gap: 2 }}>
            <span style={{ fontSize: 13 }}>Weekly price audit</span>
            <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--fg-secondary)' }}>
              0 6 * * 1
            </span>
          </div>
          <StatusBadge status="stopped" customText="Paused" />
        </div>
      </div>
    </SectionCard>
  );
}

export function BrowserSettings() {
  return (
    <SectionCard
      title="Browser session"
      actions={
        <Button variant="ghost" size="sm">
          <Pencil size={14} /> Edit
        </Button>
      }
    >
      <div style={{ display: 'grid', gap: 10, fontSize: 13 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--fg-secondary)' }}>Viewport</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>1440 x 900</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--fg-secondary)' }}>Identity</span>
          <Badge variant="secondary">ops-bot-01</Badge>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
          <span style={{ color: 'var(--fg-secondary)' }}>Headless</span>
          <span>Off — visible window</span>
        </div>
      </div>
    </SectionCard>
  );
}

export function Untitled() {
  return (
    <SectionCard>
      <div style={{ display: 'grid', gap: 8 }}>
        <span style={{ fontSize: 15 }}>Supplier portal export</span>
        <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>
          Last run finished 14 minutes ago in 2m 05s. The export step downloaded
          stock-report.csv and uploaded it to the warehouse drive.
        </span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 }}>
          <StatusBadge status="success" />
          <Badge variant="secondary">ops-bot-02</Badge>
          <Badge variant="outline">12 steps</Badge>
        </div>
      </div>
    </SectionCard>
  );
}
