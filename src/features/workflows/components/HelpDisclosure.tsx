import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

type HelpDisclosureProps = {
  children: ReactNode;
  className?: string;
  defaultOpen?: boolean;
  summaryClassName?: string;
  title: ReactNode;
};

export function HelpDisclosure({
  children,
  className = "",
  defaultOpen = false,
  summaryClassName = "",
  title,
}: HelpDisclosureProps) {
  return (
    <details
      className={["help-disclosure", className].filter(Boolean).join(" ")}
      open={defaultOpen}
    >
      <summary
        className={["help-disclosure-summary", summaryClassName]
          .filter(Boolean)
          .join(" ")}
      >
        <ChevronRight className="help-disclosure-chevron" aria-hidden="true" />
        <span className="help-disclosure-title">{title}</span>
      </summary>
      <div className="help-disclosure-content">{children}</div>
    </details>
  );
}
