import type { ProjectEnvironment } from "../../../types/workflow";

type ProjectEnvironmentSettingsProps = {
  projectEnvironments: ProjectEnvironment[];
  error: string;
};

export function ProjectEnvironmentSettings({
  projectEnvironments,
  error,
}: ProjectEnvironmentSettingsProps) {
  const projectSession =
    projectEnvironments.find((environment) => environment.is_default) ??
    projectEnvironments[0] ??
    null;
  const browserLaunch = projectSession?.browser_launch ?? null;

  return (
    <section
      className="panel settings-panel settings-project-environments-panel"
      aria-label="Project saved session"
    >
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="project-session-summary" aria-live="polite">
        <p>
          {`Fingerprint seed: ${
            browserLaunch?.fingerprint_seed ?? "unavailable"
          }`}
        </p>
        <p className="project-session-code">
          {`Identity: ${browserLaunch?.identity_id ?? "unavailable"}`}
        </p>
      </div>
    </section>
  );
}
