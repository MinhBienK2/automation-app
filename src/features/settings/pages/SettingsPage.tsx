import { useState, useEffect } from "react";
import { Button } from "../../../components/ui/button";
import { Alert } from "../../../components/ui/alert";
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
import { Label } from "../../../components/ui/label";
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
      <header className="app-header flex justify-between items-center mb-4 border-b border-base-300 pb-3">
        <div>
          <p className="eyebrow">Application</p>
          <h1 className="text-2xl font-bold">Setting</h1>
        </div>
        <div className="self-end pb-1">
          <span className="text-secondary text-xs font-semibold">
            v{pkg.version}
          </span>
        </div>
      </header>

      {/* Graph Persistence settings */}
      <section className="card bg-base-200 border border-base-300 card-body p-6 mb-6" aria-label="Workflow editing settings">
        <div className="panel-heading border-b border-base-300 pb-3 mb-4">
          <div>
            <p className="eyebrow">Workflow Editing</p>
            <h2 className="text-lg font-bold">Graph persistence</h2>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 p-4 bg-base-100 border border-base-300 rounded-lg">
          <div className="flex items-start sm:items-center gap-3 flex-grow min-w-0">
            <Switch
              id="graph-autosave-enabled"
              aria-labelledby="graph-autosave-enabled-label"
              checked={graphAutosaveEnabled}
              onCheckedChange={onGraphAutosaveEnabledChange}
              className="mt-1 sm:mt-0"
            />
            <div className="flex flex-col gap-0.5">
              <strong id="graph-autosave-enabled-label" className="text-sm font-semibold text-base-content">Autosave graph changes</strong>
              <span className="text-secondary text-xs">
                Save graph edits after changes. Turn this off to use manual Save.
              </span>
            </div>
          </div>

          {graphAutosaveEnabled && (
            <div className="flex items-center gap-3 flex-shrink-0 self-end sm:self-auto">
              <span className="font-semibold text-[10px] text-secondary uppercase tracking-wider">
                Delay
              </span>
              <div className="w-[80px]">
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
                  className="input-sm text-center"
                />
              </div>
              <span className="text-xs text-secondary font-medium">seconds</span>
            </div>
          )}
        </div>
      </section>

      {/* Appearance settings */}
      <section className="card bg-base-200 border border-base-300 card-body p-6 mb-6" aria-label="Appearance settings">
        <div className="panel-heading border-b border-base-300 pb-3 mb-4">
          <div>
            <p className="eyebrow">Interface</p>
            <h2 className="text-lg font-bold">Appearance</h2>
          </div>
        </div>

        <div className="flex flex-col gap-5 py-2">
          <div className="flex flex-col gap-2">
            <Label className="font-bold text-xs uppercase tracking-wider text-secondary">Theme</Label>
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

          <div className="flex flex-col gap-2">
            <Label className="font-bold text-xs uppercase tracking-wider text-secondary">Accent</Label>
            <div className="flex items-center gap-2 flex-wrap">
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
                  <button
                    key={swatch.accent}
                    aria-label={swatch.label}
                    aria-pressed={active}
                    className={`tweak-swatch ${swatch.className} ${
                      active ? "tweak-swatch-active" : ""
                    }`}
                    type="button"
                    onClick={() => onAccentChange(swatch.accent)}
                  />
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label className="font-bold text-xs uppercase tracking-wider text-secondary">Density</Label>
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

      {/* Maintenance settings */}
      <section className="card bg-base-200 border border-base-300 card-body p-6" aria-label="Maintenance">
        <div className="panel-heading border-b border-base-300 pb-3 mb-4">
          <div>
            <p className="eyebrow">Runtime</p>
            <h2 className="text-lg font-bold">Maintenance</h2>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 py-2 mb-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              void onInstallBinary();
            }}
            className="btn-sm"
          >
            Install CloakBrowser Binary
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              setCleanupDialogOpen(true);
            }}
            className="btn-sm"
          >
            Cleanup Orphaned Profiles
          </Button>
        </div>
        <p className="text-secondary text-xs mt-2 leading-relaxed">
          Maintenance commands only operate on the local lab runtime and orphaned
          inactive browser profiles.
        </p>
        {maintenanceMessage ? (
          <Alert variant="info" className="text-xs p-3 mt-4">
            {maintenanceMessage}
          </Alert>
        ) : null}
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
          <DialogFooter className="form-actions flex gap-2">
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
