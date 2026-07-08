import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Button } from "./button";

describe("Button component", () => {
  test("renders children normally when not loading", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.className).toContain("btn");
  });

  test("renders a daisyUI loading spinner and is disabled when loading", () => {
    render(<Button loading>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();

    expect(button.querySelector(".loading")).toBeInTheDocument();
  });

  test("renders only the spinner and hides children when loading and size is icon", () => {
    render(<Button loading size="icon">Click me</Button>);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).not.toHaveTextContent("Click me");

    expect(button.querySelector(".loading")).toBeInTheDocument();
  });

  test("is disabled when disabled prop is true", () => {
    render(<Button disabled>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeDisabled();
  });
});
