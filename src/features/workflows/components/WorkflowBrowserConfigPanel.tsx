import { useState } from "react";
import { Save } from "lucide-react";
import type {
  WorkflowBrowserChallengePolicy,
  WorkflowBrowserConfig,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";
import {
  applyBrowserDeviceProfile,
  browserDeviceProfileOptions,
  createDefaultBrowserProfileName,
  detectBrowserDeviceProfile,
  type BrowserDeviceProfileId,
} from "../lib/workflowSettings";

type WorkflowBrowserConfigPanelProps = {
  config: WorkflowBrowserConfig;
  saveStatus: string;
  onCancel?: () => void;
  onChange: (config: WorkflowBrowserConfig) => void;
  onSave: () => void | Promise<void>;
};

export function WorkflowBrowserConfigPanel({
  config,
  saveStatus,
  onCancel,
  onChange,
  onSave,
}: WorkflowBrowserConfigPanelProps) {
  const detectedDeviceProfile = detectBrowserDeviceProfile(config);
  const [selectedDeviceProfile, setSelectedDeviceProfile] =
    useState<BrowserDeviceProfileId | null>(null);
  const [reuseSession, setReuseSession] = useState(Boolean(config.profile_name));
  const deviceProfile = selectedDeviceProfile ?? detectedDeviceProfile;
  const update = (patch: Partial<WorkflowBrowserConfig>) => {
    onChange({ ...config, ...patch });
  };
  const updateDevice = (
    patch: Pick<
      Partial<WorkflowBrowserConfig>,
      "user_agent" | "viewport_width" | "viewport_height" | "mobile" | "touch"
    >,
  ) => {
    setSelectedDeviceProfile("custom");
    update(patch);
  };
  const updateDeviceProfile = (profileId: BrowserDeviceProfileId) => {
    setSelectedDeviceProfile(profileId);
    onChange(applyBrowserDeviceProfile(config, profileId));
  };
  const updateReuseSession = (enabled: boolean) => {
    setReuseSession(enabled);
    update({
      profile_name: enabled
        ? config.profile_name ?? createDefaultBrowserProfileName()
        : null,
    });
  };

  return (
    <form
      className="browser-config-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSave();
      }}
    >
      <div className="browser-config-status-row">
        <span>Save status</span>
        <strong>{saveStatus}</strong>
      </div>

      <fieldset className="browser-config-section">
        <legend>Launch</legend>
        <div className="browser-config-grid browser-config-grid-two">
          <Label htmlFor="browser-reuse-session" className="browser-config-toggle">
            <input
              id="browser-reuse-session"
              type="checkbox"
              checked={reuseSession}
              onChange={(event) => updateReuseSession(event.currentTarget.checked)}
            />
            Reuse login session
          </Label>

          <Label htmlFor="browser-profile-name">
            Profile name
            <Input
              id="browser-profile-name"
              placeholder="Generated when reuse is enabled"
              value={config.profile_name ?? ""}
              disabled={!reuseSession}
              onChange={(event) =>
                update({ profile_name: nullableText(event.currentTarget.value) })
              }
            />
          </Label>

          <Label htmlFor="browser-user-agent">
            User agent
            <Input
              id="browser-user-agent"
              placeholder="Select Custom user agent to edit"
              value={config.user_agent ?? ""}
              disabled={deviceProfile !== "custom"}
              onChange={(event) =>
                updateDevice({ user_agent: nullableText(event.currentTarget.value) })
              }
            />
          </Label>
        </div>
      </fieldset>

      <fieldset className="browser-config-section">
        <legend>Network</legend>
        <div className="browser-config-grid browser-config-grid-proxy">
          <Label htmlFor="browser-proxy-enabled" className="browser-config-toggle">
            <input
              id="browser-proxy-enabled"
              type="checkbox"
              checked={config.proxy_enabled}
              onChange={(event) => update({ proxy_enabled: event.currentTarget.checked })}
            />
            Proxy enabled
          </Label>

          <Label htmlFor="browser-proxy-server" className="browser-config-proxy-server">
            Proxy server
            <Input
              id="browser-proxy-server"
              placeholder="http://proxy.local:8080"
              value={config.proxy_server ?? ""}
              onChange={(event) =>
                update({ proxy_server: nullableText(event.currentTarget.value) })
              }
            />
            <span className="browser-config-hint">
              You can also paste a full proxy URL with credentials, e.g.
              http://agent:secret@proxy.local:8080
            </span>
          </Label>

          <Label htmlFor="browser-proxy-username">
            Proxy username
            <Input
              id="browser-proxy-username"
              placeholder="agent"
              value={config.proxy_username ?? ""}
              onChange={(event) =>
                update({ proxy_username: nullableText(event.currentTarget.value) })
              }
            />
          </Label>

          <Label htmlFor="browser-proxy-password">
            Proxy password
            <Input
              id="browser-proxy-password"
              placeholder="secret"
              type="password"
              value={config.proxy_password ?? ""}
              onChange={(event) =>
                update({ proxy_password: nullableText(event.currentTarget.value) })
              }
            />
          </Label>
        </div>
      </fieldset>

      <fieldset className="browser-config-section">
        <legend>Device</legend>
        <div className="browser-config-grid browser-config-grid-device">
          <Label htmlFor="browser-device-profile">
            Device profile
            <Select
              id="browser-device-profile"
              value={deviceProfile}
              onChange={(event) =>
                updateDeviceProfile(event.currentTarget.value as BrowserDeviceProfileId)
              }
            >
              {browserDeviceProfileOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </Select>
          </Label>

          <Label htmlFor="browser-viewport-width">
            Viewport width
            <Input
              id="browser-viewport-width"
              inputMode="numeric"
              type="number"
              min={1}
              placeholder="1280"
              value={numberInputValue(config.viewport_width)}
              onChange={(event) =>
                updateDevice({ viewport_width: nullableNumber(event.currentTarget.value) })
              }
            />
          </Label>

          <Label htmlFor="browser-viewport-height">
            Viewport height
            <Input
              id="browser-viewport-height"
              inputMode="numeric"
              type="number"
              min={1}
              placeholder="720"
              value={numberInputValue(config.viewport_height)}
              onChange={(event) =>
                updateDevice({ viewport_height: nullableNumber(event.currentTarget.value) })
              }
            />
          </Label>

          <Label htmlFor="browser-mobile" className="browser-config-toggle">
            <input
              id="browser-mobile"
              type="checkbox"
              checked={config.mobile}
              onChange={(event) => updateDevice({ mobile: event.currentTarget.checked })}
            />
            Mobile viewport
          </Label>

          <Label htmlFor="browser-touch" className="browser-config-toggle">
            <input
              id="browser-touch"
              type="checkbox"
              checked={config.touch}
              onChange={(event) => updateDevice({ touch: event.currentTarget.checked })}
            />
            Touch input
          </Label>
        </div>
      </fieldset>

      <fieldset className="browser-config-section">
        <legend>Challenge</legend>
        <Label htmlFor="browser-challenge-policy">
          Challenge policy
          <Select
            id="browser-challenge-policy"
            value={config.challenge_policy}
            onChange={(event) =>
              update({
                challenge_policy: event.currentTarget
                  .value as WorkflowBrowserChallengePolicy,
              })
            }
          >
            <option value="none">None</option>
            <option value="detect_only">Detect only</option>
            <option value="pause_for_human">Pause for human</option>
          </Select>
        </Label>
      </fieldset>

      <div className="browser-config-actions">
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
        <Button type="submit">
          <Save aria-hidden="true" />
          Save browser config
        </Button>
      </div>
    </form>
  );
}

function nullableText(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function numberInputValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function nullableNumber(value: string) {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}
