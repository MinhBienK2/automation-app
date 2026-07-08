import * as React from "react";

function Label({ className, ...props }: React.ComponentProps<"label">) {
  const classes = [
    "grid gap-1.5 text-[13px] font-medium text-base-content/70",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <label data-slot="label" className={classes} {...props} />;
}

export { Label };
