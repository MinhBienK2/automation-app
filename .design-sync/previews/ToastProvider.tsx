import { useEffect } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle, ToastProvider, useToast } from 'automation-app-ui';

function RunControls() {
  const toast = useToast();

  return (
    <Card style={{ maxWidth: 420 }}>
      <CardHeader>
        <CardTitle>Nightly inventory sync</CardTitle>
        <p style={{ fontSize: 13, color: 'var(--fg-secondary)', margin: 0 }}>
          Actions here raise notifications through the provider&apos;s{' '}
          <code style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>useToast</code> hook.
        </p>
      </CardHeader>
      <CardContent>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={() => toast.success('Workflow saved — 14 steps validated')}>
            Save workflow
          </Button>
          <Button variant="secondary" onClick={() => toast.info('Run #2841 queued')}>
            Queue run
          </Button>
          <Button
            variant="destructive"
            onClick={() => toast.error('Session for ops-bot-01 was rejected')}
          >
            Revoke session
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function ProviderAroundRunControls() {
  return (
    <ToastProvider>
      <RunControls />
    </ToastProvider>
  );
}

function RaiseOnMount() {
  const toast = useToast();

  useEffect(() => {
    toast.success('Workflow published — 14 steps validated');
    toast.info('Run #2841 queued on identity ops-bot-01');
    toast.error('Step 6 failed: selector not found within 30s');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ minHeight: 220, maxWidth: 200, fontSize: 13, color: 'var(--fg-secondary)' }}>
      Run notifications stack in the top-right corner.
    </div>
  );
}

export function RaisedNotifications() {
  return (
    <ToastProvider>
      <RaiseOnMount />
    </ToastProvider>
  );
}
