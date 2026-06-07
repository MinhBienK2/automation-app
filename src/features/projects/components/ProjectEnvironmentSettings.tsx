import { Button } from "../../../components/ui/button";
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import type { ProjectEnvironment } from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  projectEnvironments: ProjectEnvironment[];
  error: string;
  onUpdateProjectEnvironment: (
    environmentId: string,
    input: {
      name?: string;
      description?: string | null;
      is_default?: boolean | null;
      browser_launch?: ProjectEnvironment["browser_launch"] | null;
    },
  ) => Promise<void>;
};

export function ProjectEnvironmentSettings({
  projectEnvironments,
  error,
  onUpdateProjectEnvironment,
}: ProjectEnvironmentSettingsProps) {
  const projectSession =
    projectEnvironments.find((environment) => environment.is_default) ??
    projectEnvironments[0] ??
    null;
  const browserLaunch = projectSession?.browser_launch ?? null;
  const storageLabel =
    browserLaunch?.session_mode === "persistent_profile"
      ? "Persistent browser profile"
      : "Temporary browser storage";

  async function makeDefaultSession() {
    if (!projectSession) return;
    await onUpdateProjectEnvironment(projectSession.id, {
      name: projectSession.name,
      description: projectSession.description,
      is_default: true,
      browser_launch: projectSession.browser_launch,
    });
  }

  return (
    <section
      className="panel settings-panel settings-project-environments-panel"
      aria-label="Project saved session"
    >
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Project Settings</p>
          <h2>Project saved session</h2>
        </div>
        {projectSession && !projectSession.is_default ? (
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void makeDefaultSession();
            }}
          >
            Make project saved session default
          </Button>
        ) : null}
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      {!projectSession ? (
        <p className="muted">No project saved session is available.</p>
      ) : (
        <div className="settings-form-grid">
          <SettingsFieldGroup
            title="Reuse choice"
            description="New workflows can reuse this project session or create a private workflow session."
          >
            <ProjectSessionValue label="Session name" value={projectSession.name} />
            <ProjectSessionValue
              label="Workflow create option"
              value="Use project saved session"
            />
            <ProjectSessionValue
              label="Default for project"
              value={projectSession.is_default ? "Yes" : "Not yet"}
            />
          </SettingsFieldGroup>

          {browserLaunch ? (
            <>
              <SettingsFieldGroup
                title="Fingerprint identity"
                description="Stable project-owned identity values reused by workflows that choose the project session."
              >
                <ProjectSessionValue
                  label="Fingerprint seed"
                  value={browserLaunch.fingerprint_seed}
                />
                <ProjectSessionValue
                  label="Identity id"
                  value={browserLaunch.identity_id}
                  monospace
                />
                <ProjectSessionValue
                  label="Display name"
                  value={browserLaunch.display_name}
                />
              </SettingsFieldGroup>

              <SettingsFieldGroup
                title="Saved browser data"
                description="Cookie, localStorage, sessionStorage, and login state persist through the profile when persistent storage is enabled."
              >
                <ProjectSessionValue label="Storage mode" value={storageLabel} />
                <ProjectSessionValue
                  label="Session reuse"
                  value={
                    browserLaunch.profile_name
                      ? "Available for reused project workflows"
                      : "Disabled until persistent storage is enabled"
                  }
                />
              </SettingsFieldGroup>
            </>
          ) : (
            <p className="muted">Project saved session identity is unavailable.</p>
          )}
        </div>
      )}
    </section>
  );
}

function ProjectSessionValue({
  label,
  monospace = false,
  value,
}: {
  label: string;
  monospace?: boolean;
  value: string;
}) {
  return (
    <div className="field">
      <span>{label}</span>
      <strong className={monospace ? "project-session-code" : undefined}>{value}</strong>
    </div>
  );
}
