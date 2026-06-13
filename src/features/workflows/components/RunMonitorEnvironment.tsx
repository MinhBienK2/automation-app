import type { MouseEvent as ReactMouseEvent } from "react";

type RunMonitorEnvironmentProps = {
  initialVariables?: Array<{ name: string; value: string }> | null;
  traces: any[];
  stepIndex: number;
  trace?: any;
};

export function getVariablesStateAtStep(
  initialVariables: Array<{ name: string; value: string }> | null | undefined,
  traces: any[],
  stepIndex: number
): Record<string, unknown> {
  const state: Record<string, unknown> = {};
  if (initialVariables) {
    for (const v of initialVariables) {
      if (v.name.trim()) {
        state[v.name] = v.value;
      }
    }
  }
  for (let i = 0; i <= stepIndex; i++) {
    const trace = traces[i];
    if (!trace) continue;
    const summary = trace.output_summary;
    const values = trace.output_values ?? {};
    if (summary) {
      for (const key of summary.added_keys) {
        state[key] = values[key];
      }
      for (const key of summary.changed_keys) {
        state[key] = values[key];
      }
      for (const key of summary.removed_keys) {
        delete state[key];
      }
    }
  }
  return state;
}

export function formatVariableValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "object") {
    try {
      return JSON.stringify(val);
    } catch {
      return String(val);
    }
  }
  return String(val);
}

export function RunMonitorEnvironmentPanel({
  initialVariables,
  traces,
  stepIndex,
  trace,
  showAll,
  onToggleShowAll,
}: RunMonitorEnvironmentProps & { showAll: boolean; onToggleShowAll: (e: ReactMouseEvent) => void }) {
  if (!trace) {
    return (
      <div className="run-monitor-env-panel env-pending">
        Step is currently running or pending...
      </div>
    );
  }

  const summary = trace.output_summary;
  const values = trace.output_values ?? {};
  
  const added = summary?.added_keys ?? [];
  const changed = summary?.changed_keys ?? [];
  const removed = summary?.removed_keys ?? [];
  
  const hasChanges = added.length > 0 || changed.length > 0 || removed.length > 0;
  const prevVars = getVariablesStateAtStep(initialVariables, traces, stepIndex - 1);

  return (
    <div className="run-monitor-env-panel" onClick={(e) => e.stopPropagation()}>
      <div className="run-monitor-env-section-title">Environment changes</div>
      
      {hasChanges ? (
        <div className="run-monitor-env-changes-list">
          {added.map((key: string) => (
            <div key={key} className="run-monitor-env-item env-added">
              <span className="env-badge badge-added">added</span>
              <code className="env-key">{key}</code>
              <span className="env-separator">:</span>
              <code className="env-value">{formatVariableValue(values[key])}</code>
            </div>
          ))}
          {changed.map((key: string) => (
            <div key={key} className="run-monitor-env-item env-changed">
              <span className="env-badge badge-changed">changed</span>
              <code className="env-key">{key}</code>
              <span className="env-separator">:</span>
              <code className="env-value-old">{formatVariableValue(prevVars[key])}</code>
              <span className="env-arrow">→</span>
              <code className="env-value-new">{formatVariableValue(values[key])}</code>
            </div>
          ))}
          {removed.map((key: string) => (
            <div key={key} className="run-monitor-env-item env-removed">
              <span className="env-badge badge-removed">removed</span>
              <code className="env-key-removed">{key}</code>
            </div>
          ))}
        </div>
      ) : (
        <p className="run-monitor-env-empty">No environment changes at this step.</p>
      )}

      <button
        type="button"
        className="run-monitor-env-toggle"
        onClick={onToggleShowAll}
      >
        {showAll ? "Hide full environment" : "Show full environment"}
      </button>

      {showAll && (
        <div className="run-monitor-env-all-vars">
          <div className="run-monitor-env-section-title">Active Variables</div>
          {(() => {
            const currentVars = getVariablesStateAtStep(initialVariables, traces, stepIndex);
            const sortedKeys = Object.keys(currentVars).sort();
            if (sortedKeys.length === 0) {
              return <p className="run-monitor-env-empty">No active variables.</p>;
            }
            return (
              <div className="run-monitor-env-all-list">
                {sortedKeys.map((key) => {
                  const isAdded = added.includes(key);
                  const isChanged = changed.includes(key);
                  let badge = null;
                  let itemClass = "run-monitor-env-item";
                  if (isAdded) {
                    badge = <span className="env-badge badge-added">added</span>;
                    itemClass += " env-added";
                  } else if (isChanged) {
                    badge = <span className="env-badge badge-changed">changed</span>;
                    itemClass += " env-changed";
                  }
                  return (
                    <div key={key} className={itemClass}>
                      {badge}
                      <code className="env-key">{key}</code>
                      <span className="env-separator">:</span>
                      <code className="env-value">{formatVariableValue(currentVars[key])}</code>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
