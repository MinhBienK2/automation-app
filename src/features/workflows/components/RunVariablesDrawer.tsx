import { useState, useMemo } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PrettyVariableViewer } from "./PrettyVariableViewer";

type RunVariablesDrawerProps = {
  open: boolean;
  variables: Record<string, unknown>;
  onClose: () => void;
  isSnapshot?: boolean;
  snapshotNodeName?: string | null;
  onBackToLive?: () => void;
  highlightedKeys?: Set<string>;
};

export function RunVariablesDrawer({
  open,
  variables,
  onClose,
  isSnapshot = false,
  snapshotNodeName = null,
  onBackToLive,
  highlightedKeys = new Set(),
}: RunVariablesDrawerProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredVariables = useMemo(() => {
    if (!searchQuery.trim()) return variables;
    const query = searchQuery.toLowerCase().trim();
    return Object.entries(variables).reduce((acc, [key, val]) => {
      if (key.toLowerCase().includes(query)) {
        acc[key] = val;
      }
      return acc;
    }, {} as Record<string, unknown>);
  }, [variables, searchQuery]);

  return (
    <aside className={open ? "run-variables-drawer open" : "run-variables-drawer"} aria-label="Variables">
      <header className="run-variables-header">
        <div>
          <h2>Variables</h2>
          <div className="run-variables-status" data-mode={isSnapshot ? "snapshot" : "live"}>
            {isSnapshot ? (
              <>
                <span style={{ color: "var(--accent)", fontWeight: "bold" }}>◉ Snapshot</span>
                {snapshotNodeName && <span style={{ color: "var(--fg-secondary)", fontSize: "11px" }}>({snapshotNodeName})</span>}
              </>
            ) : (
              <span style={{ color: "var(--success)", fontWeight: "bold" }}>● Live (Latest)</span>
            )}
          </div>
        </div>
        <Button
          className="run-variables-close"
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
          aria-label="Close variables"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </Button>
      </header>

      <div className="run-variables-search-container">
        <input
          type="text"
          className="run-variables-search-input"
          placeholder="Search variables..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
        {isSnapshot && onBackToLive && (
          <button
            type="button"
            className="run-variables-back-live"
            onClick={onBackToLive}
          >
            <RotateCcw className="h-3 w-3" />
            Back to Live
          </button>
        )}
      </div>

      <div className="run-variables-content">
        {Object.keys(filteredVariables).length > 0 ? (
          <PrettyVariableViewer
            variables={filteredVariables}
            highlightedKeys={highlightedKeys}
          />
        ) : (
          <p className="pretty-var-empty" style={{ padding: "8px" }}>
            {searchQuery ? "No matching variables found." : "No variables available."}
          </p>
        )}
      </div>
    </aside>
  );
}
