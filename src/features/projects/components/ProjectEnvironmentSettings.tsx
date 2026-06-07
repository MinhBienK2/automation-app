import { useEffect, useState } from "react";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import type {
  ProjectEnvironment,
  ProjectEnvironmentInput,
} from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  projectEnvironments: ProjectEnvironment[];
  error: string;
  onUpdateProjectEnvironment: (
    environmentId: string,
    input: Partial<ProjectEnvironmentInput>,
  ) => Promise<void>;
  onResetProjectEnvironmentBrowserIdentity: (
    environmentId: string,
  ) => Promise<void>;
};

export function ProjectEnvironmentSettings({
  projectEnvironments,
  error,
  onUpdateProjectEnvironment,
  onResetProjectEnvironmentBrowserIdentity,
}: ProjectEnvironmentSettingsProps) {
  const projectSession =
    projectEnvironments.find((environment) => environment.is_default) ??
    projectEnvironments[0] ??
    null;
  const browserLaunch = projectSession?.browser_launch ?? null;
  const [seedDraft, setSeedDraft] = useState(browserLaunch?.fingerprint_seed ?? "");
  const [localError, setLocalError] = useState("");
  const [savingSeed, setSavingSeed] = useState(false);
  const [regeneratingIdentity, setRegeneratingIdentity] = useState(false);
  const savedSeed = browserLaunch?.fingerprint_seed ?? "";
  const seedChanged = seedDraft.trim() !== savedSeed;

  useEffect(() => {
    setSeedDraft(savedSeed);
    setLocalError("");
  }, [projectSession?.id, savedSeed]);

  async function saveFingerprintSeed() {
    if (!projectSession || !browserLaunch) return;
    const nextSeed = seedDraft.trim();
    if (!nextSeed) {
      setLocalError("Fingerprint seed is required.");
      return;
    }
    setLocalError("");
    setSavingSeed(true);
    try {
      await onUpdateProjectEnvironment(projectSession.id, {
        name: projectSession.name,
        description: projectSession.description,
        is_default: projectSession.is_default,
        browser_launch: {
          ...browserLaunch,
          fingerprint_seed: nextSeed,
        },
      });
    } finally {
      setSavingSeed(false);
    }
  }

  async function regenerateIdentity() {
    if (!projectSession) return;
    setLocalError("");
    setRegeneratingIdentity(true);
    try {
      await onResetProjectEnvironmentBrowserIdentity(projectSession.id);
    } finally {
      setRegeneratingIdentity(false);
    }
  }

  return (
    <section
      className="panel settings-panel settings-project-environments-panel"
      aria-label="Project identity"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project Settings</p>
          <h2>Project identity</h2>
        </div>
      </div>

      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
      {localError ? (
        <p className="field-error" role="alert">
          {localError}
        </p>
      ) : null}

      <SettingsFieldGroup title="Browser fingerprint">
        <label className="field project-session-seed-field">
          <span>Fingerprint seed</span>
          <Input
            aria-label="Fingerprint seed"
            className="project-session-code"
            value={seedDraft}
            disabled={!browserLaunch || savingSeed || regeneratingIdentity}
            onChange={(event) => setSeedDraft(event.target.value)}
          />
        </label>

        <div className="field project-session-value-row">
          <span>Identity</span>
          <strong className="project-session-code">
            {browserLaunch?.identity_id ?? "unavailable"}
          </strong>
        </div>

        <div className="project-session-actions">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              void saveFingerprintSeed();
            }}
            disabled={!browserLaunch || !seedChanged || savingSeed || regeneratingIdentity}
          >
            Save fingerprint seed
          </Button>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              void regenerateIdentity();
            }}
            disabled={!projectSession || savingSeed || regeneratingIdentity}
          >
            Regenerate identity
          </Button>
        </div>
      </SettingsFieldGroup>
    </section>
  );
}
