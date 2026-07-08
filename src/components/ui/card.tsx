import * as React from "react";

function Card({ className, ...props }: React.ComponentProps<"div">) {
  const classes = ["card card-border bg-base-100 text-base-content", className]
    .filter(Boolean)
    .join(" ");
  return <div data-slot="card" className={classes} {...props} />;
}

function CardHeader({ className, ...props }: React.ComponentProps<"div">) {
  const classes = ["card-body grid gap-2 p-4", className]
    .filter(Boolean)
    .join(" ");
  return <div data-slot="card-header" className={classes} {...props} />;
}

function CardTitle({ className, ...props }: React.ComponentProps<"div">) {
  const classes = [
    "card-title text-xl font-normal leading-tight text-base-content",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <div data-slot="card-title" className={classes} {...props} />;
}

function CardContent({ className, ...props }: React.ComponentProps<"div">) {
  const classes = ["grid gap-4 p-4 pt-0", className]
    .filter(Boolean)
    .join(" ");
  return <div data-slot="card-content" className={classes} {...props} />;
}

export { Card, CardContent, CardHeader, CardTitle };
