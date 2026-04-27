type AppSidebarProps = {
  collapsed: boolean;
  onBackToList: () => void;
  onToggle: () => void;
};

function WorkflowNavIcon() {
  return (
    <svg
      aria-hidden="true"
      className="sidebar-item-icon"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      <path
        d="M4 4.5h10M4 9h10M4 13.5h10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function SidebarToggleIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="sidebar-toggle-icon"
      data-testid="sidebar-toggle-icon"
      fill="none"
      height="18"
      viewBox="0 0 18 18"
      width="18"
    >
      {collapsed ? (
        <path
          d="M7 4.5 11.5 9 7 13.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ) : (
        <path
          d="M11 4.5 6.5 9l4.5 4.5"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      )}
    </svg>
  );
}

export function AppSidebar({ collapsed, onBackToList, onToggle }: AppSidebarProps) {
  return (
    <aside aria-label="Application sidebar" className="app-sidebar">
      <div className="sidebar-brand">
        <span className="sidebar-mark">W</span>
        <span className="sidebar-title">Workflow Manager</span>
      </div>
      <nav aria-label="Main navigation" className="sidebar-nav">
        <button
          className="sidebar-nav-item sidebar-nav-item-active"
          type="button"
          onClick={onBackToList}
        >
          <WorkflowNavIcon />
          <span>Workflows</span>
        </button>
      </nav>
      <button
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        aria-expanded={!collapsed}
        className="sidebar-toggle"
        type="button"
        onClick={onToggle}
      >
        <SidebarToggleIcon collapsed={collapsed} />
      </button>
    </aside>
  );
}
