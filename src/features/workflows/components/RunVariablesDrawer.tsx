import { useState, useMemo } from "react";
import { X, RotateCcw } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { PrettyVariableViewer } from "./PrettyVariableViewer";

type RunVariablesDrawerProps = {
  variables: Record<string, unknown>;
  onClose: () => void;
  isSnapshot?: boolean;
  snapshotNodeName?: string | null;
  onBackToLive?: () => void;
  highlightedKeys?: Set<string>;
};

export function RunVariablesDrawer({
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
    <aside className="run-variables-drawer" aria-label="Variables">
      <header className="run-variables-header">
        <div>
          <h2>Variables</h2>
          <div className="run-variables-status" data-mode={isSnapshot ? "snapshot" : "live"}>
            {isSnapshot ? (
              <>
                <span style={{ color: "#32d3e6", fontWeight: "bold" }}>◉ Snapshot</span>
                {snapshotNodeName && <span style={{ color: "#9aaebd", fontSize: "11px" }}>({snapshotNodeName})</span>}
              </>
            ) : (
              <span style={{ color: "#39d98a", fontWeight: "bold" }}>● Live (Mới nhất)</span>
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
          placeholder="Tìm kiếm biến..."
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
            Quay lại Live
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
            {searchQuery ? "Không tìm thấy biến phù hợp." : "Chưa có biến nào."}
          </p>
        )}
      </div>
    </aside>
  );
}
