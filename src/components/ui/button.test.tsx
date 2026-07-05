import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { Button } from "./button";

describe("Button component", () => {
  test("renders children normally when not loading", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).not.toBeDisabled();
    expect(button.querySelector("svg")).not.toBeInTheDocument();
  });

  test("renders loader and is disabled when loading", () => {
    render(<Button loading>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    
    // It should render the loader icon
    const spinner = button.querySelector("svg");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("animate-spin");
  });

  test("renders only loader and hides children when loading and size is icon", () => {
    render(<Button loading size="icon">Click me</Button>);
    // When size is icon and loading is true, we hide original children to prevent overflow,
    // so the button text "Click me" should not be visible/accessible as the button name,
    // or the name will just be the loader/empty if no label is provided.
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toBeDisabled();
    expect(button).not.toHaveTextContent("Click me");

    const spinner = button.querySelector("svg");
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveClass("animate-spin");
  });

  test("is disabled when disabled prop is true", () => {
    render(<Button disabled>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toBeDisabled();
  });
});
