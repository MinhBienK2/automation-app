import * as React from "react";

const DropdownMenuContext = React.createContext<{
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

function DropdownMenu({
  children,
  ...props
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen }}>
      <div ref={containerRef} className="dropdown dropdown-end" {...props}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

function DropdownMenuTrigger({
  children,
  asChild,
  ...props
}: {
  children: React.ReactNode;
  asChild?: boolean;
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context) return <>{children}</>;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    context.setOpen(!context.open);
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

function DropdownMenuPortal({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function DropdownMenuContent({
  className,
  children,
  align = "end",
  ...props
}: {
  className?: string;
  children: React.ReactNode;
  align?: "start" | "end";
}) {
  const context = React.useContext(DropdownMenuContext);
  if (!context?.open) return null;

  const classes = [
    "dropdown-content menu bg-base-200 border border-base-300 rounded-box z-50 w-56 p-1 shadow-md",
    align === "end" ? "right-0" : "left-0",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ul className={classes} role="menu" {...props}>
      {children}
    </ul>
  );
}

function DropdownMenuItem({
  className,
  variant = "default",
  children,
  onClick,
  onSelect,
  disabled,
  ...props
}: {
  className?: string;
  variant?: "default" | "destructive";
  children: React.ReactNode;
  onClick?: (e: React.MouseEvent) => void;
  onSelect?: (e: any) => void;
  disabled?: boolean;
}) {
  const context = React.useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent) => {
    if (disabled) return;
    if (onClick) onClick(e);
    if (onSelect) onSelect(e);
    if (context) context.setOpen(false);
  };

  const itemClasses = [
    "flex w-full items-center gap-2 rounded-btn px-3 py-2 text-sm text-left transition-colors select-none",
    disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
    variant === "destructive" ? "text-error hover:bg-error/10" : "text-base-content hover:bg-base-300",
    className
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li role="none">
      <button
        type="button"
        className={itemClasses}
        role="menuitem"
        onClick={handleClick}
        disabled={disabled}
        {...props}
      >
        {children}
      </button>
    </li>
  );
}

function DropdownMenuSeparator({ className, ...props }: { className?: string }) {
  const classes = ["my-1 h-px bg-base-300", className].filter(Boolean).join(" ");
  return <li className={classes} role="separator" {...props} />;
}

function DropdownMenuLabel({
  className,
  children,
  ...props
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const classes = ["px-3 py-1.5 text-xs font-semibold text-secondary", className].filter(Boolean).join(" ");
  return <li className={classes} {...props}>{children}</li>;
}

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuPortal,
};

