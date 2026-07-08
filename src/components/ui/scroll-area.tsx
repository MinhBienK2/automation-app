import * as React from "react";

export interface ScrollAreaProps extends React.ComponentProps<"div"> {
  children?: React.ReactNode;
}

function ScrollArea({ className, children, ...props }: ScrollAreaProps) {
  const classes = ["overflow-auto", className].filter(Boolean).join(" ");
  return (
    <div data-slot="scroll-area" className={classes} {...props}>
      {children}
    </div>
  );
}

export { ScrollArea };
