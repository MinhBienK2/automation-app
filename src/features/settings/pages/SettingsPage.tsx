import { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import pkg from "../../../../package.json";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Switch } from "../../../components/ui/switch";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { Input } from "../../../components/ui/input";
import type { Accent, Density, Theme } from "../../../app/useThemePreferences";

type SettingsPageProps = {
  graphAutosaveEnabled: boolean;
  graphAutosaveDelayMs: number;
  maintenanceMessage: string;
  onGraphAutosaveEnabledChange: (enabled: boolean) => void;
  onGraphAutosaveDelayMsChange: (delayMs: number) => void;
  onInstallBinary: () => void | Promise<void>;
  onCleanupProfiles: () => void | Promise<void>;
  theme: Theme;
  accent: Accent;
  density: Density;
  onThemeChange: (theme: Theme) => void;
  onAccentChange: (accent: Accent) => void;
  onDensityChange: (density: Density) => void;
};

export function SettingsPage({
  graphAutosaveEnabled,
  graphAutosaveDelayMs,
  maintenanceMessage,
  onGraphAutosaveEnabledChange,
  onGraphAutosaveDelayMsChange,
  onInstallBinary,
  onCleanupProfiles,
  theme,
  accent,
  density,
  onThemeChange,
  onAccentChange,
  onDensityChange,
}: SettingsPageProps) {
  const [cleanupDialogOpen, setCleanupDialogOpen] = useState(false);
  const [cleanupPending, setCleanupPending] = useState(false);
  const [localDelaySec, setLocalDelaySec] = useState(() => (graphAutosaveDelayMs / 1000).toString());

  useEffect(() => {
    setLocalDelaySec((graphAutosaveDelayMs / 1000).toString());
  }, [graphAutosaveDelayMs]);

  async function confirmCleanupProfiles() {
    setCleanupPending(true);
    try {
      await onCleanupProfiles();
      setCleanupDialogOpen(false);
    } finally {
      setCleanupPending(false);
    }
  }

  return (
    <section className="app-screen settings-screen" aria-label="Settings">
      <header className="app-header">
        <div>
          <p className="eyebrow">Application</p>
          <h1>Setting</h1>
        </div>
        <div style={{ alignSelf: "flex-end", paddingBottom: "4px" }}>
          <span style={{ color: "#667d8d", fontSize: "0.875rem", fontWeight: 500 }}>
            v{pkg.version}
          </span>
        </div>
      </header>

      <section className="panel settings-panel" aria-label="Workflow editing settings">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2>Graph persistence</h2>
          </div>
        </div>

        <div
          className="switch-field"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "24px",
            padding: "var(--space-md)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-md)", flexGrow: 1, minWidth: 0 }}>
            <Switch
              id="graph-autosave-enabled"
              aria-labelledby="graph-autosave-enabled-label"
              checked={graphAutosaveEnabled}
              onCheckedChange={onGraphAutosaveEnabledChange}
            />
            <span className="switch-field-copy" style={{ gap: "2px" }}>
              <strong id="graph-autosave-enabled-label" style={{ fontSize: "13.5px" }}>Autosave graph changes</strong>
              <small style={{ color: "var(--fg-muted)" }}>
                Save graph edits after changes. Turn this off to use manual Save.
              </small>
            </span>
          </div>

          {graphAutosaveEnabled && (
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <span
                style={{
                  fontWeight: 500,
                  fontSize: "11px",
                  color: "var(--fg-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                Delay
              </span>
              <div style={{ width: "70px" }}>
                <Input
                  type="number"
                  min={1}
                  step="0.1"
                  value={localDelaySec}
                  onChange={(e) => {
                    const val = e.target.value;
                    setLocalDelaySec(val);
                    const sec = Number(val);
                    if (!isNaN(sec) && sec >= 1) {
                      onGraphAutosaveDelayMsChange(sec * 1000);
                    }
                  }}
                  onBlur={() => {
                    const sec = Math.max(1, Number(localDelaySec) || 1);
                    setLocalDelaySec(sec.toString());
                    onGraphAutosaveDelayMsChange(sec * 1000);
                  }}
                  style={{ height: "34px", textAlign: "center" }}
                />
              </div>
              <span style={{ fontSize: "13px", color: "var(--fg-secondary)" }}>s</span>
            </div>
          )}
        </div>
      </section>

      <section className="panel settings-panel" aria-label="Appearance settings">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Interface</p>
            <h2>Appearance</h2>
          </div>
        </div>

        <div className="settings-maintenance-actions" style={{ display: "flex", flexDirection: "column", gap: "1rem", padding: "0" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="tweak-label" style={{ fontWeight: 600 }}>Theme</span>
            <SegmentedControl
              ariaLabel="Theme"
              onValueChange={onThemeChange}
              options={[
                { label: "Dark", value: "dark" },
                { label: "Light", value: "light" },
              ]}
              value={theme}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="tweak-label" style={{ fontWeight: 600 }}>Accent</span>
            <div className="tweak-swatches">
              {(
                [
                  { accent: "cyan", className: "tweak-swatch-cyan", label: "Cyan accent" },
                  { accent: "teal", className: "tweak-swatch-teal", label: "Teal accent" },
                  { accent: "purple", className: "tweak-swatch-purple", label: "Purple accent" },
                  { accent: "orange", className: "tweak-swatch-orange", label: "Orange accent" },
                ] as const
              ).map((swatch) => {
                const active = swatch.accent === accent;
                return (
                  <Button
                    key={swatch.accent}
                    aria-label={swatch.label}
                    aria-pressed={active}
                    className={`tweak-swatch ${swatch.className} ${
                      active ? "tweak-swatch-active" : ""
                    }`}
                    type="button"
                    variant="ghost"
                    onClick={() => onAccentChange(swatch.accent)}
                  />
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span className="tweak-label" style={{ fontWeight: 600 }}>Density</span>
            <SegmentedControl
              ariaLabel="Density"
              onValueChange={onDensityChange}
              options={[
                { label: "Compact", value: "compact" },
                { label: "Normal", value: "normal" },
                { label: "Spacious", value: "spacious" },
              ]}
              value={density}
            />
          </div>
        </div>
      </section>

      <section className="panel settings-panel" aria-label="Maintenance">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2>Maintenance</h2>
          </div>
        </div>

        <div className="settings-maintenance-actions">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void onInstallBinary();
            }}
          >
            Install CloakBrowser Binary
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCleanupDialogOpen(true);
            }}
          >
            Cleanup Orphaned Profiles
          </Button>
        </div>
        <p className="muted">
          Maintenance commands only operate on the local lab runtime and orphaned
          inactive browser profiles.
        </p>
        {maintenanceMessage ? <p role="status">{maintenanceMessage}</p> : null}
      </section>

      <Dialog
        open={cleanupDialogOpen}
        onOpenChange={(open) => {
          if (!cleanupPending) setCleanupDialogOpen(open);
        }}
      >
        <DialogContent className="workflow-dialog">
          <DialogHeader>
            <p className="eyebrow">Maintenance</p>
            <DialogTitle>Cleanup orphaned profiles</DialogTitle>
            <DialogDescription>
              This deletes local inactive browser profile directories that are no
              longer referenced by a workflow or project browser profile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="form-actions">
            <Button
              type="button"
              variant="secondary"
              disabled={cleanupPending}
              onClick={() => setCleanupDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={cleanupPending}
              onClick={() => {
                void confirmCleanupProfiles();
              }}
            >
              Cleanup Profiles
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </section>
  );
}
