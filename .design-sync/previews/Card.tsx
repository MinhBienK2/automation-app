import { Badge, Card, CardContent, CardHeader, CardTitle, StatusBadge } from 'automation-app-ui';
import { Clock, GitBranch, MousePointerClick } from 'lucide-react';

export function WorkflowSummary() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <CardTitle>Nightly inventory sync</CardTitle>
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
          Signs in to the supplier portal, exports the stock report and uploads it to the
          warehouse drive.
        </p>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <StatusBadge status="success" />
          <Badge variant="secondary">ops-bot-01</Badge>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 16,
            fontSize: 12,
            color: 'var(--fg-secondary)',
            alignItems: 'center',
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={13} /> 14 steps
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Clock size={13} /> 4m 12s avg
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export function StepDetail() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardHeader>
        <CardTitle>Step 6 — Click element</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'grid', gap: 6, fontSize: 13 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--fg-secondary)' }}>Selector</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
              button[data-test=&quot;export&quot;]
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--fg-secondary)' }}>Wait for</span>
            <span>Navigation complete</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
            <span style={{ color: 'var(--fg-secondary)' }}>Timeout</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>30000ms</span>
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: 'var(--accent)',
          }}
        >
          <MousePointerClick size={13} /> Runs in the shared browser session
        </div>
      </CardContent>
    </Card>
  );
}

export function ContentOnly() {
  return (
    <Card style={{ maxWidth: 380 }}>
      <CardContent style={{ paddingTop: 16 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 28, lineHeight: 1 }}>128</span>
          <span style={{ fontSize: 13, color: 'var(--fg-secondary)' }}>runs this week</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Badge variant="success">112 succeeded</Badge>
          <Badge variant="failure">9 failed</Badge>
          <Badge variant="secondary">7 stopped</Badge>
        </div>
      </CardContent>
    </Card>
  );
}
