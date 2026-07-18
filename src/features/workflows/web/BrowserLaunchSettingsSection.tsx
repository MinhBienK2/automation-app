import { Select } from "../../../components/ui/select";
import { SettingsFieldGroup } from "../../../components/ui/settings-field-group";
import type { BrowserProfile } from "../../../types/workflow";

type BrowserLaunchSettingsSectionProps = {
  browserProfiles: BrowserProfile[];
  selectedBrowserProfileId: string | null;
  onBrowserProfileChange?: (profileId: string) => void;
};

export function BrowserLaunchSettingsSection({
  browserProfiles,
  selectedBrowserProfileId,
  onBrowserProfileChange,
}: BrowserLaunchSettingsSectionProps) {
  const selectedProfile =
    browserProfiles.find((profile) => profile.id === selectedBrowserProfileId) ??
    browserProfiles[0] ??
    null;
  return (
    <div className="settings-form-grid">
      <SettingsFieldGroup
        title="Browser Profile"
        description="Select the project-managed browser profile used when this workflow runs."
      >
        <label className="field">
          <span>Browser profile</span>
          <Select
            aria-label="Browser profile"
            value={selectedProfile?.id ?? ""}
            disabled={browserProfiles.length === 0 || !onBrowserProfileChange}
            onChange={(event) => onBrowserProfileChange?.(event.currentTarget.value)}
          >
            {browserProfiles.length === 0 ? (
              <option value="">No profiles available</option>
            ) : null}
            {browserProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </Select>
        </label>
        {selectedProfile ? (
          <p className="workflow-settings-hint settings-field-group-wide">
            Profile settings are managed in Project Settings.
          </p>
        ) : null}
      </SettingsFieldGroup>
    </div>
  );
}
