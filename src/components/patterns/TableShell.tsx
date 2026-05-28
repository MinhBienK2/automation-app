import type { ReactNode } from "react";

type TableShellProps = {
  title: string;
  toolbar?: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  state?: ReactNode;
};

export function TableShell({
  title,
  toolbar,
  children,
  detail,
  state,
}: TableShellProps) {
  return (
    <section
      className={detail ? "table-shell table-shell-with-detail" : "table-shell"}
      aria-label={title}
    >
      <div className="table-shell-main">
        <header className="table-shell-header">
          <h2>{title}</h2>
        </header>
        {toolbar}
        {state ?? <div className="table-shell-body">{children}</div>}
      </div>
      {detail ? <div className="table-shell-detail">{detail}</div> : null}
    </section>
  );
}
