import { useEffect, useState, type FormEvent } from "react";
import { GraphShortcutGuide } from "../../workflows/components/GraphShortcutGuide";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { SwitchField } from "../../../components/ui/switch";
import { getWorkspacePolicy, saveWorkspacePolicy } from "../../../lib/workflowApi";

type SettingsPageProps = {
  graphAutosaveEnabled: boolean;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
};

export function SettingsPage({
  graphAutosaveEnabled,
  onGraphAutosaveEnabledChange,
}: SettingsPageProps) {
  const [allowedOrigins, setAllowedOrigins] = useState("");
  const [maxConcurrency, setMaxConcurrency] = useState("1");
  const [policyStatus, setPolicyStatus] = useState<"loading" | "idle" | "saving" | "saved" | "failed">(
    "loading",
  );
  const [policyError, setPolicyError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const policy = await getWorkspacePolicy();
        if (cancelled) return;
        setAllowedOrigins(policy.allowedOrigins.join("\n"));
        setMaxConcurrency(String(policy.maxConcurrency));
        setPolicyStatus("idle");
      } catch (error) {
        if (cancelled) return;
        setPolicyError(error instanceof Error ? error.message : String(error));
        setPolicyStatus("failed");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function savePolicy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPolicyStatus("saving");
    setPolicyError("");
    try {
      const saved = await saveWorkspacePolicy({
        allowedOrigins: allowedOrigins
          .split(/[\n,]+/)
          .map((origin) => origin.trim())
          .filter(Boolean),
        maxConcurrency: Math.max(1, Number.parseInt(maxConcurrency, 10) || 1),
      });
      setAllowedOrigins(saved.allowedOrigins.join("\n"));
      setMaxConcurrency(String(saved.maxConcurrency));
      setPolicyStatus("saved");
    } catch (error) {
      setPolicyError(error instanceof Error ? error.message : String(error));
      setPolicyStatus("failed");
    }
  }

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

      <section className="panel settings-panel" aria-label="Workspace operator policy">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Operator Controls</p>
            <h2>Workspace policy</h2>
          </div>
        </div>

        <form className="workspace-policy-form" onSubmit={savePolicy}>
          <label className="workspace-policy-field" htmlFor="workspace-policy-origins">
            <span>Allowed origins</span>
            <textarea
              id="workspace-policy-origins"
              value={allowedOrigins}
              rows={4}
              onChange={(event) => setAllowedOrigins(event.target.value)}
            />
          </label>

          <label className="workspace-policy-field" htmlFor="workspace-policy-concurrency">
            <span>Max concurrency</span>
            <Input
              id="workspace-policy-concurrency"
              min={1}
              type="number"
              value={maxConcurrency}
              onChange={(event) => setMaxConcurrency(event.target.value)}
            />
          </label>

          <div className="workspace-policy-actions">
            <Button type="submit" disabled={policyStatus === "saving"}>
              Save policy
            </Button>
            {policyStatus === "loading" ? <span>Loading</span> : null}
            {policyStatus === "saving" ? <span>Saving</span> : null}
            {policyStatus === "saved" ? <span>Saved</span> : null}
            {policyStatus === "failed" && policyError ? <span>{policyError}</span> : null}
          </div>
        </form>
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
