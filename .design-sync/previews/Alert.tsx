import { Alert } from 'automation-app-ui';

export function RunFailure() {
  return (
    <Alert variant="error" style={{ maxWidth: 460 }}>
      Run #2841 stopped at step 6 — the selector{' '}
      <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>
        button[data-test=&quot;export&quot;]
      </code>{' '}
      was not found within 30s.
    </Alert>
  );
}

export function SeverityScale() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 460 }}>
      <Alert variant="error">
        Session for identity ops-bot-01 was rejected by the supplier portal.
      </Alert>
      <Alert variant="warning">
        This schedule overlaps another run of Nightly inventory sync.
      </Alert>
      <Alert variant="info">
        Recording mode captures every click and input in the shared browser session.
      </Alert>
      <Alert variant="success">
        Workflow published — 14 steps validated with no blocking issues.
      </Alert>
    </div>
  );
}

export function WithoutIcon() {
  return (
    <Alert variant="warning" hideIcon style={{ maxWidth: 460 }}>
      3 environment variables referenced by this workflow are not defined in the
      Warehouse Ops project.
    </Alert>
  );
}

export function DetailedFailure() {
  return (
    <Alert variant="error" style={{ maxWidth: 460 }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Browser session crashed while uploading the stock report.</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, opacity: 0.85 }}>
          run 2841 · step 11 · chromium exited with code 133
        </span>
      </div>
    </Alert>
  );
}
