import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import { Button } from "../ui/button";
import type { Accent, Density, Theme } from "../../app/useThemePreferences";

type TweaksPanelProps = {
  theme: Theme;
  accent: Accent;
  density: Density;
  onThemeChange: (theme: Theme) => void;
  onAccentChange: (accent: Accent) => void;
  onDensityChange: (density: Density) => void;
};

const themeOptions: Array<{ label: string; value: Theme }> = [
  { label: "Dark", value: "dark" },
  { label: "Light", value: "light" },
];

const densityOptions: Array<{ label: string; value: Density }> = [
  { label: "Compact", value: "compact" },
  { label: "Normal", value: "normal" },
  { label: "Spacious", value: "spacious" },
];

const accentSwatches: Array<{
  accent: Accent;
  className: string;
  label: string;
}> = [
  { accent: "cyan", className: "tweaks-swatch-cyan", label: "Cyan accent" },
  { accent: "teal", className: "tweaks-swatch-teal", label: "Teal accent" },
  { accent: "purple", className: "tweaks-swatch-purple", label: "Purple accent" },
  { accent: "orange", className: "tweaks-swatch-orange", label: "Orange accent" },
];

function useOutsideDismiss(open: boolean, onClose: () => void) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!open) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("mousedown", handleClickOutside);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);
  return containerRef;
}

function TweaksSegmented<Value extends string>({
  ariaLabel,
  onChange,
  options,
  value,
}: {
  ariaLabel: string;
  onChange: (value: Value) => void;
  options: Array<{ label: string; value: Value }>;
  value: Value;
}) {
  return (
    <div
      aria-label={ariaLabel}
      className="tweak-btn-group"
      data-slot="segmented-control"
      role="group"
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Button
            aria-pressed={active}
            className="tweak-btn-group-btn"
            data-state={active ? "active" : "inactive"}
            key={option.value}
            type="button"
            variant={active ? "default" : "ghost"}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </Button>
        );
      })}
    </div>
  );
}

function TweaksPanelBody({
  theme,
  accent,
  density,
  onThemeChange,
  onAccentChange,
  onDensityChange,
}: TweaksPanelProps) {
  return (
    <div className="tweaks-panel-body">
      <div className="tweak-section">
        <span className="tweak-label">Theme</span>
        <TweaksSegmented
          ariaLabel="Theme"
          onChange={onThemeChange}
          options={themeOptions}
          value={theme}
        />
      </div>

      <div className="tweak-section">
        <span className="tweak-label">Accent</span>
        <div className="tweak-swatches">
          {accentSwatches.map((swatch) => {
            const active = swatch.accent === accent;
            return (
              <Button
                aria-label={swatch.label}
                aria-pressed={active}
                className={`tweak-swatch ${swatch.className} ${
                  active ? "tweak-swatch-active" : ""
                }`}
                key={swatch.accent}
                type="button"
                variant="ghost"
                onClick={() => onAccentChange(swatch.accent)}
              />
            );
          })}
        </div>
      </div>

      <div className="tweak-section">
        <span className="tweak-label">Density</span>
        <TweaksSegmented
          ariaLabel="Density"
          onChange={onDensityChange}
          options={densityOptions}
          value={density}
        />
      </div>
    </div>
  );
}

export function TweaksPanel({
  theme,
  accent,
  density,
  onThemeChange,
  onAccentChange,
  onDensityChange,
}: TweaksPanelProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useOutsideDismiss(open, () => setOpen(false));

  return (
    <div className="tweaks-container" ref={containerRef}>
      <Button
        aria-expanded={open}
        aria-label="Appearance settings"
        className="tweaks-toggle"
        type="button"
        variant="secondary"
        onClick={() => setOpen((prev) => !prev)}
      >
        <Settings aria-hidden="true" />
      </Button>
      <div className={`tweaks-panel ${open ? "tweaks-panel-open" : ""}`}>
        <TweaksPanelBody
          accent={accent}
          density={density}
          onAccentChange={onAccentChange}
          onDensityChange={onDensityChange}
          onThemeChange={onThemeChange}
          theme={theme}
        />
      </div>
    </div>
  );
}
