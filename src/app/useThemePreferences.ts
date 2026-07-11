import { useCallback, useEffect, useState } from "react";

export type Theme = "dark" | "light";
export type Accent = "cyan" | "teal" | "purple" | "orange";
export type Density = "compact" | "normal" | "spacious";

export type ThemePreferences = {
  theme: Theme;
  accent: Accent;
  density: Density;
  setTheme: (theme: Theme) => void;
  setAccent: (accent: Accent) => void;
  setDensity: (density: Density) => void;
};

const storageKey = "workflow-manager:theme:v1";

const defaultTheme: Theme = "dark";
const defaultAccent: Accent = "cyan";
const defaultDensity: Density = "normal";

const themes: readonly Theme[] = ["dark", "light"];
const accents: readonly Accent[] = ["cyan", "teal", "purple", "orange"];
const densities: readonly Density[] = ["compact", "normal", "spacious"];

type StoredPreferences = {
  theme?: unknown;
  accent?: unknown;
  density?: unknown;
};

function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value);
}

function isAccent(value: unknown): value is Accent {
  return typeof value === "string" && (accents as readonly string[]).includes(value);
}

function isDensity(value: unknown): value is Density {
  return (
    typeof value === "string" && (densities as readonly string[]).includes(value)
  );
}

function readStoredPreferences(): StoredPreferences {
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (!stored) return {};
    return JSON.parse(stored) as StoredPreferences;
  } catch {
    return {};
  }
}

function writeStoredPreferences(prefs: {
  theme: Theme;
  accent: Accent;
  density: Density;
}) {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(prefs));
  } catch {
    // Ignore persistence failures (e.g. storage disabled).
  }
}

function applyAttributes(
  theme: Theme,
  accent: Accent,
  density: Density,
) {
  document.documentElement.setAttribute("data-theme", theme);
  document.documentElement.setAttribute("data-accent", accent);
  document.documentElement.setAttribute("data-density", density);
}

export function useThemePreferences(): ThemePreferences {
  const [theme, setThemeState] = useState<Theme>(() => {
    const { theme: stored } = readStoredPreferences();
    return isTheme(stored) ? stored : defaultTheme;
  });
  const [accent, setAccentState] = useState<Accent>(() => {
    const { accent: stored } = readStoredPreferences();
    return isAccent(stored) ? stored : defaultAccent;
  });
  const [density, setDensityState] = useState<Density>(() => {
    const { density: stored } = readStoredPreferences();
    return isDensity(stored) ? stored : defaultDensity;
  });

  useEffect(() => {
    if (window.workflowApi?.getAppSettings) {
      window.workflowApi.getAppSettings().then((settings) => {
        if (settings) {
          if (isTheme(settings.theme)) setThemeState(settings.theme);
          if (isAccent(settings.accent)) setAccentState(settings.accent);
          if (isDensity(settings.density)) setDensityState(settings.density);
        }
      }).catch((err) => {
        console.error("Failed to load theme preferences from backend:", err);
      });
    }
  }, []);

  useEffect(() => {
    applyAttributes(theme, accent, density);
  }, [theme, accent, density]);

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next);
    writeStoredPreferences({
      theme: next,
      accent,
      density,
    });
    if (window.workflowApi?.saveAppSettings) {
      void window.workflowApi.saveAppSettings({ theme: next });
    }
  }, [accent, density]);

  const setAccent = useCallback((next: Accent) => {
    setAccentState(next);
    writeStoredPreferences({
      theme,
      accent: next,
      density,
    });
    if (window.workflowApi?.saveAppSettings) {
      void window.workflowApi.saveAppSettings({ accent: next });
    }
  }, [theme, density]);

  const setDensity = useCallback((next: Density) => {
    setDensityState(next);
    writeStoredPreferences({
      theme,
      accent,
      density: next,
    });
    if (window.workflowApi?.saveAppSettings) {
      void window.workflowApi.saveAppSettings({ density: next });
    }
  }, [theme, accent]);

  return {
    theme,
    accent,
    density,
    setTheme,
    setAccent,
    setDensity,
  };
}
