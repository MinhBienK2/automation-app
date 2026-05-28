import type { CommandSearchResult } from "../../types/workflow";
import type { CommandSearchResultGroup } from "../../lib/commandSearch";

type CommandPaletteProps = {
  query: string;
  groups: CommandSearchResultGroup[];
  loading: boolean;
  error?: string | null;
  activeResultId?: string | null;
  onSelect: (result: CommandSearchResult) => void;
};

export function CommandPalette({
  query,
  groups,
  loading,
  error,
  activeResultId,
  onSelect,
}: CommandPaletteProps) {
  const trimmed = query.trim();
  const resultCount = groups.reduce((total, group) => total + group.results.length, 0);

  return (
    <div
      className="command-palette"
      data-command-palette="true"
      role="dialog"
      aria-label="Mission Control command palette"
    >
      {trimmed.length < 2 ? (
        <div className="command-palette-state">
          <strong>Search Mission Control</strong>
          <p>Type at least 2 characters to search workflows, runs, evidence, schedules, and identities.</p>
        </div>
      ) : null}
      {loading ? (
        <div className="command-palette-state" role="status">
          Loading safe evidence and identity results...
        </div>
      ) : null}
      {error ? (
        <div className="command-palette-warning" role="status">
          {error}
        </div>
      ) : null}
      {trimmed.length >= 2 && !loading && resultCount === 0 ? (
        <div className="command-palette-state">
          <strong>No matching Mission Control records</strong>
          <p>Try a workflow name, run id, schedule name, evidence label, or identity display name.</p>
        </div>
      ) : null}
      {groups.length ? (
        <div className="command-palette-results">
          {groups.map((group) => (
            <section key={group.key} className="command-palette-group" aria-label={group.label}>
              <h3>{group.label}</h3>
              {group.results.map((result) => (
                <button
                  key={result.id}
                  type="button"
                  className="command-palette-result"
                  data-active={result.id === activeResultId ? "true" : undefined}
                  aria-label={`${result.type} ${result.label}${
                    result.context ? ` ${result.context}` : ""
                  }`}
                  onClick={() => onSelect(result)}
                >
                  <span>{result.type}</span>
                  <strong>{result.label}</strong>
                  {result.context ? <small>{result.context}</small> : null}
                </button>
              ))}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
