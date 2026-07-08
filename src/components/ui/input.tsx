import * as React from "react";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  const classes = ["input input-bordered w-full", className]
    .filter(Boolean)
    .join(" ");
  return (
    <input type={type} data-slot="input" className={classes} {...props} />
  );
}

export { Input };
