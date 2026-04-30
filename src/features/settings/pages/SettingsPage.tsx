type SettingsPageProps = {
  graphAutosaveEnabled: boolean;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
};

export function SettingsPage({
  graphAutosaveEnabled,
  onGraphAutosaveEnabledChange,
}: SettingsPageProps) {
  return (
    <section className="app-screen settings-screen" aria-label="Settings">
      <header className="app-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>Settings</h1>
        </div>
      </header>

      <section className="panel settings-panel" aria-label="Workflow editing settings">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2>Graph persistence</h2>
          </div>
        </div>

        <label className="settings-toggle" htmlFor="graph-autosave-enabled">
          <input
            id="graph-autosave-enabled"
            aria-label="Autosave graph changes"
            aria-describedby="graph-autosave-description"
            type="checkbox"
            checked={graphAutosaveEnabled}
            onChange={(event) => onGraphAutosaveEnabledChange(event.target.checked)}
          />
          <span>
            <strong>Autosave graph changes</strong>
            <small id="graph-autosave-description">
              Save graph edits after changes. Turn this off to use manual Save.
            </small>
          </span>
        </label>
      </section>
    </section>
  );
}
