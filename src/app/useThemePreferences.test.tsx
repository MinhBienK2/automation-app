import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vitest";
import { useThemePreferences } from "./useThemePreferences";

const storageKey = "workflow-manager:theme:v1";

function setStoredPreferences(prefs: {
  theme?: string;
  accent?: string;
  density?: string;
}) {
  window.localStorage.setItem(storageKey, JSON.stringify(prefs));
}

describe("useThemePreferences", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    document.documentElement.removeAttribute("data-accent");
    document.documentElement.removeAttribute("data-density");
  });

  test("defaults to dark theme, cyan accent, normal density when no stored preferences", () => {
    const { result } = renderHook(() => useThemePreferences());

    expect(result.current.theme).toBe("dark");
    expect(result.current.accent).toBe("cyan");
    expect(result.current.density).toBe("normal");
  });

  test("applies data-theme, data-accent, data-density attributes to documentElement on mount", () => {
    renderHook(() => useThemePreferences());

    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(document.documentElement.getAttribute("data-accent")).toBe("cyan");
    expect(document.documentElement.getAttribute("data-density")).toBe("normal");
  });

  test("reads stored preferences from localStorage on mount", () => {
    setStoredPreferences({ theme: "light", accent: "purple", density: "compact" });

    const { result } = renderHook(() => useThemePreferences());

    expect(result.current.theme).toBe("light");
    expect(result.current.accent).toBe("purple");
    expect(result.current.density).toBe("compact");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    expect(document.documentElement.getAttribute("data-accent")).toBe("purple");
    expect(document.documentElement.getAttribute("data-density")).toBe("compact");
  });

  test("setTheme persists to localStorage and updates the data-theme attribute", () => {
    const { result } = renderHook(() => useThemePreferences());

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}",
    ) as { theme?: string };
    expect(stored.theme).toBe("light");
  });

  test("setAccent persists to localStorage and updates the data-accent attribute", () => {
    const { result } = renderHook(() => useThemePreferences());

    act(() => {
      result.current.setAccent("teal");
    });

    expect(result.current.accent).toBe("teal");
    expect(document.documentElement.getAttribute("data-accent")).toBe("teal");
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}",
    ) as { accent?: string };
    expect(stored.accent).toBe("teal");
  });

  test("setDensity persists to localStorage and updates the data-density attribute", () => {
    const { result } = renderHook(() => useThemePreferences());

    act(() => {
      result.current.setDensity("spacious");
    });

    expect(result.current.density).toBe("spacious");
    expect(document.documentElement.getAttribute("data-density")).toBe("spacious");
    const stored = JSON.parse(
      window.localStorage.getItem(storageKey) ?? "{}",
    ) as { density?: string };
    expect(stored.density).toBe("spacious");
  });

  test("falls back to defaults when stored preferences are invalid", () => {
    setStoredPreferences({ theme: "neon", accent: "mauve", density: "tiny" });

    const { result } = renderHook(() => useThemePreferences());

    expect(result.current.theme).toBe("dark");
    expect(result.current.accent).toBe("cyan");
    expect(result.current.density).toBe("normal");
  });
});
