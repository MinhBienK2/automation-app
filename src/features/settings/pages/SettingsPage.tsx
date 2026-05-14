import { GraphShortcutGuide } from "../../workflows/components/GraphShortcutGuide";
import { SwitchField } from "../../../components/ui/switch";

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

        <SwitchField
          id="graph-autosave-enabled"
          label="Autosave graph changes"
          description="Save graph edits after changes. Turn this off to use manual Save."
          checked={graphAutosaveEnabled}
          onCheckedChange={onGraphAutosaveEnabledChange}
        />
      </section>

      <section className="panel settings-panel" aria-label="Graph shortcuts">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2>Graph shortcuts</h2>
          </div>
        </div>

        <GraphShortcutGuide />
      </section>
    </section>
  );
}
