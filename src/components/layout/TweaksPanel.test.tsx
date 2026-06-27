import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { TweaksPanel } from "./TweaksPanel";
import type { Accent, Density, Theme } from "../../app/useThemePreferences";

describe("TweaksPanel", () => {
  const baseProps = {
    theme: "dark" as Theme,
    accent: "cyan" as Accent,
    density: "normal" as Density,
    onThemeChange: vi.fn(),
    onAccentChange: vi.fn(),
    onDensityChange: vi.fn(),
  };

  test("renders the toggle button collapsed by default", () => {
    render(<TweaksPanel {...baseProps} />);

    const toggle = screen.getByRole("button", { name: /appearance settings/i });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  test("opens the panel when the toggle is clicked", () => {
    render(<TweaksPanel {...baseProps} />);

    const toggle = screen.getByRole("button", { name: /appearance settings/i });
    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: /theme/i })).toBeInTheDocument();
  });

  test("calls onThemeChange when a theme option is selected", () => {
    render(<TweaksPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /appearance settings/i }));
    fireEvent.click(screen.getByRole("button", { name: /^light$/i }));

    expect(baseProps.onThemeChange).toHaveBeenCalledWith("light");
  });

  test("calls onAccentChange when an accent swatch is selected", () => {
    render(<TweaksPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /appearance settings/i }));
    fireEvent.click(screen.getByRole("button", { name: /teal accent/i }));

    expect(baseProps.onAccentChange).toHaveBeenCalledWith("teal");
  });

  test("calls onDensityChange when a density option is selected", () => {
    render(<TweaksPanel {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /appearance settings/i }));
    fireEvent.click(screen.getByRole("button", { name: /^spacious$/i }));

    expect(baseProps.onDensityChange).toHaveBeenCalledWith("spacious");
  });

  test("marks the active theme, accent, and density options as pressed", () => {
    render(
      <TweaksPanel
        {...baseProps}
        theme="light"
        accent="purple"
        density="compact"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /appearance settings/i }));

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
});
