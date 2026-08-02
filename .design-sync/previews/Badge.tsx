import { Badge } from 'automation-app-ui';

export function Variants() {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
      <Badge variant="default">Workflow</Badge>
      <Badge variant="secondary">ops-bot-01</Badge>
      <Badge variant="outline">Draft</Badge>
      <Badge variant="success">Succeeded</Badge>
      <Badge variant="attention">Retrying</Badge>
      <Badge variant="failure">Failed</Badge>
      <Badge variant="destructive">Quota exceeded</Badge>
      <Badge variant="running">Running</Badge>
    </div>
  );
}

export function IdentityTags() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>Nightly inventory sync</span>
        <Badge variant="secondary">ops-bot-01</Badge>
        <Badge variant="outline">cron</Badge>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 13 }}>Invoice reconciliation</span>
        <Badge variant="secondary">finance-bot</Badge>
        <Badge variant="attention">needs review</Badge>
      </div>
    </div>
  );
}

export function StepCounts() {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <Badge variant="default">14 steps</Badge>
      <Badge variant="success">112 passed</Badge>
      <Badge variant="failure">9 failed</Badge>
    </div>
  );
}
