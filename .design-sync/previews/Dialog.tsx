import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Select,
  StatusBadge,
} from 'automation-app-ui';
import { MoreHorizontal } from 'lucide-react';

const row: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 16,
  paddingTop: 8,
  paddingBottom: 8,
  borderBottom: '1px solid var(--border)',
};

const key: React.CSSProperties = { color: 'var(--fg-secondary)' };
const val: React.CSSProperties = { color: 'var(--fg-primary)', fontFamily: 'var(--font-mono)' };

export function RunSummary() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Run #4821 — Warehouse portal sync</DialogTitle>
          <DialogDescription>
            Finished 6 minutes ago on the ops-eu identity, headless Chromium.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ paddingBottom: 12 }}>
            <StatusBadge status="success" />
          </div>
          <div style={row}>
            <span style={key}>Steps executed</span>
            <span style={val}>34 / 34</span>
          </div>
          <div style={row}>
            <span style={key}>Duration</span>
            <span style={val}>1m 12s</span>
          </div>
          <div style={row}>
            <span style={key}>Session</span>
            <span style={val}>sess_9f2c41ab</span>
          </div>
          <div style={{ ...row, borderBottom: 'none' }}>
            <span style={key}>Triggered by</span>
            <span style={val}>schedule · nightly-02:00</span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost">Close</Button>
          <Button variant="secondary">Download trace</Button>
          <Button>Re-run workflow</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ScheduleForm() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent style={{ maxWidth: 560 }}>
        <DialogHeader>
          <DialogTitle>New schedule</DialogTitle>
          <DialogDescription>
            Queue this workflow automatically. Runs are skipped while a previous run is
            still in flight.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField label="Schedule name">
            <Input defaultValue="Supplier sync — nightly" />
          </FormField>
          <FormField
            label="Cadence"
            description="Evaluated in the workspace timezone (Europe/Berlin)."
          >
            <Select defaultValue="nightly">
              <option value="hourly">Every hour</option>
              <option value="nightly">Nightly at 02:00</option>
              <option value="weekly">Weekly on Monday</option>
            </Select>
          </FormField>
          <FormField label="Identity">
            <Select defaultValue="ops-eu">
              <option value="ops-eu">ops-eu@internal.example</option>
              <option value="ops-us">ops-us@internal.example</option>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Create schedule</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SelectorInspector() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogContent style={{ maxWidth: 620 }}>
        <DialogHeader>
          <DialogTitle>Step 12 — Click “Export CSV”</DialogTitle>
          <DialogDescription>
            The recorded selector no longer matched a unique element on the last run.
          </DialogDescription>
        </DialogHeader>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: 12,
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--surface)',
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
          }}
        >
          <span style={{ color: 'var(--fg-secondary)' }}>recorded</span>
          <span>{'div.toolbar > button:nth-child(3)'}</span>
          <span style={{ color: 'var(--fg-secondary)', paddingTop: 4 }}>suggested</span>
          <span style={{ color: 'var(--accent)' }}>{'[data-testid="export-csv"]'}</span>
          <span style={{ color: 'var(--attention)', paddingTop: 4 }}>
            3 elements matched the recorded selector
          </span>
        </div>
        <DialogFooter>
          <Button variant="ghost">Keep recorded</Button>
          <Button>Apply suggestion</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function WithTrigger() {
  return (
    <Dialog open onOpenChange={() => {}}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <MoreHorizontal size={16} aria-hidden="true" />
          Workflow settings
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Workflow settings</DialogTitle>
          <DialogDescription>
            Applies to every future run of “Warehouse portal sync”.
          </DialogDescription>
        </DialogHeader>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <FormField label="Default timeout" description="Per browser step, in seconds.">
            <Input type="number" defaultValue={30} />
          </FormField>
          <FormField label="On step failure">
            <Select defaultValue="stop">
              <option value="stop">Stop the run</option>
              <option value="continue">Continue to the next step</option>
              <option value="retry">Retry once, then stop</option>
            </Select>
          </FormField>
        </div>
        <DialogFooter>
          <Button variant="ghost">Cancel</Button>
          <Button>Save settings</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
