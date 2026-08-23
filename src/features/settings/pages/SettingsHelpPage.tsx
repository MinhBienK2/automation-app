import { GraphShortcutGuide } from "../../workflows/components/graph/GraphShortcutGuide";
import { XPathCookbook } from "../components/XPathCookbook";

export function SettingsHelpPage() {
  return (
    <section className="app-screen settings-screen" aria-label="Help">
      <header className="app-header mb-4">
        <div>
          <p className="eyebrow">Application</p>
          <h1 className="text-2xl font-bold">Help</h1>
        </div>
      </header>

      <section className="card bg-base-200 border border-base-300 card-body p-6 mb-6" aria-label="Graph shortcuts">
        <div className="panel-heading border-b border-base-300 pb-3 mb-4">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2 className="text-lg font-bold">Graph shortcuts</h2>
          </div>
        </div>

        <GraphShortcutGuide />
      </section>

      <XPathCookbook />
    </section>
  );
}
