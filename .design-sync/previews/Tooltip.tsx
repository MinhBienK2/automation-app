import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from 'automation-app-ui';
import { Braces, Play, RefreshCw } from 'lucide-react';

export function TooltipOnAction() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="default">
            <Play size={14} /> Run workflow
          </Button>
        </TooltipTrigger>
        <TooltipContent>Runs all 14 steps in a fresh browser session</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export function ToolbarTooltips() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <Braces size={14} /> Insert variable
            </Button>
          </TooltipTrigger>
          <TooltipContent>Insert a project environment variable</TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="sm">
              <RefreshCw size={14} /> Revalidate
            </Button>
          </TooltipTrigger>
          <TooltipContent>Re-check every selector against the last session</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function TooltipOnDisabledAction() {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="secondary" disabled>
            Schedule run
          </Button>
        </TooltipTrigger>
        <TooltipContent>Publish the workflow before scheduling it</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
