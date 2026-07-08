import type { ComponentProps, ReactNode } from "react";
import { Button } from "./button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "./tooltip";

type IconButtonProps = Omit<
  ComponentProps<typeof Button>,
  "aria-label" | "children" | "size"
> & {
  children: ReactNode;
  label: string;
  tooltip?: string;
};

function IconButton({
  children,
  label,
  tooltip = label,
  className,
  ...props
}: IconButtonProps) {
  const classes = ["btn-square", className].filter(Boolean).join(" ");

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            {...props}
            className={classes}
            aria-label={label}
            data-tooltip={tooltip}
            size="icon"
            type={props.type ?? "button"}
          >
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{tooltip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export { IconButton };

