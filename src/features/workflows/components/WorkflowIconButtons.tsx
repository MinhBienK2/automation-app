import { Braces } from "lucide-react";
import { Button } from "../../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

type WorkflowIconButtonProps = {
  onClick: () => void;
  size?: "sm" | "md";
  label?: string;
  className?: string;
};

type VariableIconButtonProps = WorkflowIconButtonProps & {
  open?: boolean;
};

export function VariableIconButton({
  onClick,
  size = "sm",
  label = "Insert variable",
  className = "",
  open,
}: VariableIconButtonProps) {
  const buttonClass = size === "sm" ? "h-5 w-5 p-0" : "h-7 w-7 p-0";
  const iconSizeClass = size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger>
          <Button
            aria-expanded={open}
            aria-label={label}
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClick}
            className={`${buttonClass} text-[var(--app-text-muted)] hover:bg-[var(--app-surface-hover)] hover:text-[var(--app-accent-text)] ${className}`}
          >
            <Braces className={iconSizeClass} />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
