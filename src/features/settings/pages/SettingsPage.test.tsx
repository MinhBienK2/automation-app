import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import type { Accent, Density, Theme } from "../../../app/useThemePreferences";

describe("SettingsPage Appearance Preferences", () => {
  const baseProps = {
    graphAutosaveEnabled: false,
    graphAutosaveDelayMs: 1000,
    maintenanceMessage: "",
    onGraphAutosaveEnabledChange: vi.fn(),
    onGraphAutosaveDelayMsChange: vi.fn(),
    onInstallBinary: vi.fn(),
    onCleanupProfiles: vi.fn(),
    theme: "dark" as Theme,
    accent: "cyan" as Accent,
    density: "normal" as Density,
    onThemeChange: vi.fn(),
    onAccentChange: vi.fn(),
    onDensityChange: vi.fn(),
  };

  test("renders the appearance settings section with correct options", () => {
    render(<SettingsPage {...baseProps} />);

    expect(screen.getByRole("group", { name: /theme/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /teal accent/i })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /density/i })).toBeInTheDocument();
  });

  test("marks active theme, accent, and density options as pressed", () => {
    render(
      <SettingsPage
        {...baseProps}
        theme="light"
        accent="purple"
        density="compact"
      />,
    );

    expect(screen.getByRole("button", { name: /^light$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /purple accent/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /^compact$/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("calls callbacks when options are selected", () => {
    render(<SettingsPage {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /^light$/i }));
    expect(baseProps.onThemeChange).toHaveBeenCalledWith("light");

    fireEvent.click(screen.getByRole("button", { name: /teal accent/i }));
    expect(baseProps.onAccentChange).toHaveBeenCalledWith("teal");

    fireEvent.click(screen.getByRole("button", { name: /^spacious$/i }));
    expect(baseProps.onDensityChange).toHaveBeenCalledWith("spacious");
  });

  test("renders autosave delay input and triggers callback on change", () => {
    const { rerender } = render(<SettingsPage {...baseProps} graphAutosaveEnabled={false} />);
    expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();

    rerender(<SettingsPage {...baseProps} graphAutosaveEnabled={true} graphAutosaveDelayMs={1000} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toBeInTheDocument();
    expect(input).toHaveValue(1);

    fireEvent.change(input, { target: { value: "2" } });
    expect(baseProps.onGraphAutosaveDelayMsChange).toHaveBeenCalledWith(2000);
  });
});

