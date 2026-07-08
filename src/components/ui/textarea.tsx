import * as React from "react";

function Textarea({
  className,
  ...props
}: React.ComponentProps<"textarea">) {
  const classes = ["textarea textarea-bordered w-full", className]
    .filter(Boolean)
    .join(" ");
  return <textarea data-slot="textarea" className={classes} {...props} />;
}

export { Textarea };
