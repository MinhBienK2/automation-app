import * as React from "react";

const DialogContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
  titleId: string;
} | null>(null);

function Dialog({
  children,
  open,
  onOpenChange,
}: {
  children: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = React.useState(false);
  const isOpen = open !== undefined ? open : internalOpen;
  const setOpen = onOpenChange !== undefined ? onOpenChange : setInternalOpen;
  const titleId = React.useId();

  return (
    <DialogContext.Provider value={{ open: isOpen, setOpen, titleId }}>
      {children}
    </DialogContext.Provider>
  );
}

function DialogTrigger({
  children,
  asChild,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const context = React.useContext(DialogContext);
  if (!context) return <>{children}</>;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    context.setOpen(true);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as any, {
      onClick: (e: React.MouseEvent) => {
        handleClick(e);
        if ((children.props as any).onClick) {
          (children.props as any).onClick(e);
        }
      },
      ...props
    });
  }

  return (
    <button type="button" onClick={handleClick} {...props}>
      {children}
    </button>
  );
}

function DialogContent({
  children,
  className,
  style,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const context = React.useContext(DialogContext);
  if (!context?.open) return null;

  const containerClasses = [
    "modal modal-open z-50 flex items-center justify-center"
  ]
    .filter(Boolean)
    .join(" ");

  const boxClasses = [
    "modal-box border border-base-300 bg-base-100 p-6 relative max-w-lg w-full shadow-lg",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={containerClasses}
      role="dialog"
      aria-modal="true"
      aria-labelledby={context.titleId}
    >
      <div className={boxClasses} style={style} {...props}>
        {children}
        <button
          type="button"
          aria-label="Close dialog"
          className="btn btn-sm btn-circle btn-ghost absolute right-4 top-4"
          onClick={() => context.setOpen(false)}
        >
          ✕
        </button>
      </div>
      <div className="modal-backdrop bg-black/50" onClick={() => context.setOpen(false)} />
    </div>
  );
}

function DialogHeader({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const classes = ["grid gap-1.5 text-left mb-4", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}

function DialogFooter({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const classes = ["flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-6", className].filter(Boolean).join(" ");
  return <div className={classes} {...props} />;
}

function DialogTitle({
  className,
  id,
  ...props
}: React.ComponentProps<"h2">) {
  const context = React.useContext(DialogContext);
  const classes = ["text-lg font-semibold leading-none tracking-tight text-base-content", className].filter(Boolean).join(" ");
  return <h2 id={id ?? context?.titleId} className={classes} {...props} />;
}

function DialogDescription({
  className,
  ...props
}: React.ComponentProps<"p">) {
  const classes = ["text-sm text-secondary mt-1.5", className].filter(Boolean).join(" ");
  return <p className={classes} {...props} />;
}

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
};

