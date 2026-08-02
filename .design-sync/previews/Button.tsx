import { Button } from 'automation-app-ui';
import { Play, Plus, RotateCcw, Trash2 } from 'lucide-react';

const row: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'center',
};

export function Variants() {
  return (
    <div style={row}>
      <Button>Run workflow</Button>
      <Button variant="secondary">Save draft</Button>
      <Button variant="ghost">Cancel</Button>
      <Button variant="destructive">Delete run</Button>
    </div>
  );
}

export function Sizes() {
  return (
    <div style={row}>
      <Button size="sm">Small</Button>
      <Button>Default</Button>
      <Button size="lg">Large</Button>
      <Button size="icon" aria-label="Add step">
        <Plus size={16} />
      </Button>
    </div>
  );
}

export function WithIcons() {
  return (
    <div style={row}>
      <Button>
        <Play size={14} /> Run now
      </Button>
      <Button variant="secondary">
        <RotateCcw size={14} /> Retry
      </Button>
      <Button variant="destructive">
        <Trash2 size={14} /> Delete
      </Button>
    </div>
  );
}

export function States() {
  return (
    <div style={row}>
      <Button loading>Starting run</Button>
      <Button variant="secondary" loading>
        Saving
      </Button>
      <Button disabled>Run workflow</Button>
      <Button variant="ghost" disabled>
        Cancel
      </Button>
    </div>
  );
}

export function Pill() {
  return (
    <div style={row}>
      <Button shape="pill">Schedule run</Button>
      <Button shape="pill" variant="secondary">
        Duplicate
      </Button>
      <Button shape="pill" variant="ghost">
        More
      </Button>
    </div>
  );
}
