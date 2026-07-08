import * as React from "react";

const TooltipContext = React.createContext<{
  content: string;
  setContent: (content: string) => void;
} | null>(null);

function TooltipProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Tooltip({ children }: { children: React.ReactNode }) {
  const [content, setContent] = React.useState("");
  return (
    <TooltipContext.Provider value={{ content, setContent }}>
      {children}
    </TooltipContext.Provider>
  );
}

function TooltipTrigger({ children }: { children: React.ReactNode; asChild?: boolean }) {
  const context = React.useContext(TooltipContext);
  const tipString = context?.content || "";

  return (
    <div className="tooltip" data-tip={tipString}>
      {children}
    </div>
  );
}

function TooltipContent({ children }: { children: React.ReactNode }) {
  const context = React.useContext(TooltipContext);

  const textContent = React.useMemo(() => {
    if (typeof children === "string") return children;
    if (typeof children === "number") return String(children);
    return "";
  }, [children]);

  React.useEffect(() => {
    if (context && textContent) {
      context.setContent(textContent);
    }
  }, [textContent, context]);

  return null;
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger };

