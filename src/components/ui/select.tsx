import * as React from "react";

function Select({
  className,
  ...props
}: React.ComponentProps<"select">) {
  const classes = ["select select-bordered w-full", className]
    .filter(Boolean)
    .join(" ");
  return <select data-slot="select" className={classes} {...props} />;
}

export { Select };
