import * as React from 'react';
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from 'automation-app-ui';
import {
  CheckCircle2,
  Copy,
  Download,
  History,
  MoreHorizontal,
  Pause,
  Play,
  Settings,
  Trash2,
} from 'lucide-react';

// The menu keeps its open state internally, so a static preview opens it the
// same way a user would: focus + click the trigger once on mount.
function OpenOnMount({
  children,
  align = 'flex-end',
}: {
  children: React.ReactNode;
  align?: React.CSSProperties['justifyContent'];
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    const trigger = ref.current?.querySelector('button');
    if (!trigger) return;
    trigger.focus();
    trigger.click();
  }, []);
  return (
    <div
      ref={ref}
      style={{
        display: 'flex',
        justifyContent: align,
        minHeight: 240,
        paddingTop: 4,
      }}
    >
      {children}
    </div>
  );
}

export function WorkflowActions() {
  return (
    <OpenOnMount>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="icon" aria-label="More actions" type="button">
            <MoreHorizontal size={16} aria-hidden="true" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Warehouse portal sync</DropdownMenuLabel>
          <DropdownMenuItem>
            <Settings size={16} aria-hidden="true" />
            Workflow settings
          </DropdownMenuItem>
          <DropdownMenuItem>
            <CheckCircle2 size={16} aria-hidden="true" />
            Validate graph
          </DropdownMenuItem>
          <DropdownMenuItem>
            <History size={16} aria-hidden="true" />
            Revision history
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive">
            <Trash2 size={16} aria-hidden="true" />
            Delete workflow
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </OpenOnMount>
  );
}

export function RunMenuWithDisabledItems() {
  return (
    <OpenOnMount>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="secondary" size="sm" type="button">
            Run #4821
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Run actions</DropdownMenuLabel>
          <DropdownMenuItem>
            <Play size={16} aria-hidden="true" />
            Re-run from step 1
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <Pause size={16} aria-hidden="true" />
            Pause — run already finished
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Download size={16} aria-hidden="true" />
            Download trace
          </DropdownMenuItem>
          <DropdownMenuItem>
            <Copy size={16} aria-hidden="true" />
            Copy run id
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </OpenOnMount>
  );
}

export function ZoomLevelAlignStart() {
  return (
    <OpenOnMount align="flex-start">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" type="button">
            100%
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuItem>50%</DropdownMenuItem>
          <DropdownMenuItem>75%</DropdownMenuItem>
          <DropdownMenuItem>100%</DropdownMenuItem>
          <DropdownMenuItem>150%</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem>Fit graph to view</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </OpenOnMount>
  );
}
