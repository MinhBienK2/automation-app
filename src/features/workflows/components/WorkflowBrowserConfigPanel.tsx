import { Save } from "lucide-react";
import type {
  WorkflowBrowserChallengePolicy,
  WorkflowBrowserConfig,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import { Input } from "../../../components/ui/input";
import { Label } from "../../../components/ui/label";
import { Select } from "../../../components/ui/select";

type WorkflowBrowserConfigPanelProps = {
  config: WorkflowBrowserConfig;
  saveStatus: string;
  onChange: (config: WorkflowBrowserConfig) => void;
  onSave: () => void;
};

export function WorkflowBrowserConfigPanel({
  config,
  saveStatus,
  onChange,
  onSave,
}: WorkflowBrowserConfigPanelProps) {
  const update = (patch: Partial<WorkflowBrowserConfig>) => {
    onChange({ ...config, ...patch });
  };

  return (
    <section className="browser-config-panel panel" aria-label="Browser runtime config">
      <div className="browser-config-header">
        <div>
          <p className="eyebrow">Browser</p>
          <h2>Runtime config</h2>
        </div>
        <div className="browser-config-actions">
          <span>{saveStatus}</span>
          <Button type="button" variant="secondary" onClick={onSave}>
            <Save aria-hidden="true" />
            Save browser config
          </Button>
        </div>
      </div>

      <div className="browser-config-grid">
        <Label htmlFor="browser-profile-name">
          Profile name
          <Input
            id="browser-profile-name"
            value={config.profile_name ?? ""}
            onChange={(event) => update({ profile_name: nullableText(event.currentTarget.value) })}
          />
        </Label>

        <Label htmlFor="browser-user-agent">
          User agent
          <Input
            id="browser-user-agent"
            value={config.user_agent ?? ""}
            onChange={(event) => update({ user_agent: nullableText(event.currentTarget.value) })}
          />
        </Label>

        <Label htmlFor="browser-proxy-enabled" className="browser-config-toggle">
          <input
            id="browser-proxy-enabled"
            type="checkbox"
            checked={config.proxy_enabled}
            onChange={(event) => update({ proxy_enabled: event.currentTarget.checked })}
          />
          Proxy enabled
        </Label>

        <Label htmlFor="browser-proxy-server">
          Proxy server
          <Input
            id="browser-proxy-server"
            value={config.proxy_server ?? ""}
            onChange={(event) => update({ proxy_server: nullableText(event.currentTarget.value) })}
          />
        </Label>

        <Label htmlFor="browser-proxy-username">
          Proxy username
          <Input
            id="browser-proxy-username"
            value={config.proxy_username ?? ""}
            onChange={(event) => update({ proxy_username: nullableText(event.currentTarget.value) })}
          />
        </Label>

        <Label htmlFor="browser-proxy-password">
          Proxy password
          <Input
            id="browser-proxy-password"
            type="password"
            value={config.proxy_password ?? ""}
            onChange={(event) => update({ proxy_password: nullableText(event.currentTarget.value) })}
          />
        </Label>

        <Label htmlFor="browser-viewport-width">
          Viewport width
          <Input
            id="browser-viewport-width"
            inputMode="numeric"
            type="number"
            min={1}
            value={numberInputValue(config.viewport_width)}
            onChange={(event) =>
              update({ viewport_width: nullableNumber(event.currentTarget.value) })
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
            value={numberInputValue(config.viewport_height)}
            onChange={(event) =>
              update({ viewport_height: nullableNumber(event.currentTarget.value) })
            }
          />
        </Label>

        <Label htmlFor="browser-mobile" className="browser-config-toggle">
          <input
            id="browser-mobile"
            type="checkbox"
            checked={config.mobile}
            onChange={(event) => update({ mobile: event.currentTarget.checked })}
          />
          Mobile viewport
        </Label>

        <Label htmlFor="browser-touch" className="browser-config-toggle">
          <input
            id="browser-touch"
            type="checkbox"
            checked={config.touch}
            onChange={(event) => update({ touch: event.currentTarget.checked })}
          />
          Touch input
        </Label>

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
      </div>
    </section>
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
