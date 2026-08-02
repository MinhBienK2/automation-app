import { IconButton } from 'automation-app-ui';
import { Braces, Copy, Pencil, Play, RefreshCw, Trash2 } from 'lucide-react';

export function RunAction() {
  return (
    <IconButton label="Run workflow" tooltip="Run all 14 steps in a fresh session">
      <Play size={15} />
    </IconButton>
  );
}

export function VariantRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconButton label="Run workflow">
        <Play size={15} />
      </IconButton>
      <IconButton variant="secondary" label="Revalidate selectors">
        <RefreshCw size={15} />
      </IconButton>
      <IconButton variant="ghost" label="Insert variable">
        <Braces size={15} />
      </IconButton>
      <IconButton variant="destructive" label="Delete workflow">
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

export function StepToolbar() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <IconButton variant="ghost" label="Edit step">
        <Pencil size={15} />
      </IconButton>
      <IconButton variant="ghost" label="Duplicate step">
        <Copy size={15} />
      </IconButton>
      <IconButton variant="ghost" label="Remove step">
        <Trash2 size={15} />
      </IconButton>
    </div>
  );
}

export function LoadingAndDisabled() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <IconButton loading label="Saving workflow">
        <Play size={15} />
      </IconButton>
      <IconButton disabled variant="secondary" label="Revalidate selectors">
        <RefreshCw size={15} />
      </IconButton>
    </div>
  );
}
