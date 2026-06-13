import { GraphShortcutGuide } from "../../workflows/components/GraphShortcutGuide";
import { XPathCookbook } from "../components/XPathCookbook";

export function SettingsHelpPage() {
  return (
    <section className="app-screen settings-screen" aria-label="Help">
      <header className="app-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>Help</h1>
        </div>
      </header>

      <section className="panel settings-panel graph-shortcuts-panel" aria-label="Graph shortcuts">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2>Graph shortcuts</h2>
          </div>
        </div>

        <GraphShortcutGuide />
      </section>

      <XPathCookbook />
    </section>
  );
}
