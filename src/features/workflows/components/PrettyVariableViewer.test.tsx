import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { PrettyVariableViewer } from "./PrettyVariableViewer";

describe("PrettyVariableViewer", () => {
  test("renders primitive boolean values as user-friendly text", () => {
    render(<PrettyVariableViewer variables={{ is_active: true, is_blocked: false }} />);
    expect(screen.getByText("is_active")).toBeInTheDocument();
    expect(screen.getByText(/TRUE|True/i)).toBeInTheDocument();
    expect(screen.getByText("is_blocked")).toBeInTheDocument();
    expect(screen.getByText(/FALSE|False/i)).toBeInTheDocument();
  });

  test("renders null or undefined values as user-friendly empty label", () => {
    render(<PrettyVariableViewer variables={{ empty_val: null }} />);
    expect(screen.getByText("empty_val")).toBeInTheDocument();
    expect(screen.getByText("(Empty)")).toBeInTheDocument();
  });

  test("renders formatted numbers", () => {
    render(<PrettyVariableViewer variables={{ price: 1250000 }} />);
    expect(screen.getByText("price")).toBeInTheDocument();
    expect(screen.getByText("1,250,000")).toBeInTheDocument();
  });

  test("renders array elements with clean numbering and cards", async () => {
    render(<PrettyVariableViewer variables={{ items: ["apple", "banana"] }} />);
    // Check array name and count
    expect(screen.getByText("items")).toBeInTheDocument();
    expect(screen.getByText(/2 items/)).toBeInTheDocument();

    const user = userEvent.setup();
    const toggleBtn = screen.getByRole("button", { name: /items/ });
    await user.click(toggleBtn);

    // Check items formatting
    expect(screen.getByText(/Item 1/)).toBeInTheDocument();
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText(/Item 2/)).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  test("renders nested objects with proper keys", async () => {
    render(<PrettyVariableViewer variables={{ profile: { name: "John", age: 30 } }} />);
    expect(screen.getByText(/profile/)).toBeInTheDocument();

    const user = userEvent.setup();
    const toggleBtn = screen.getByRole("button", { name: /profile/ });
    await user.click(toggleBtn);

    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("age")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  test("provides a copy button for primitive values and handles clipboard write", async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<PrettyVariableViewer variables={{ api_key: "secret-token-abc" }} />);
    
    const copyBtn = screen.getByTitle("Copy value");
    expect(copyBtn).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith("secret-token-abc");
  });

  test("provides a copy button for array values and copies JSON", async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<PrettyVariableViewer variables={{ tags: ["admin", "staff"] }} />);
    
    const copyBtn = screen.getByTitle("Copy value");
    expect(copyBtn).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(JSON.stringify(["admin", "staff"]));
  });

  test("provides a copy button for object values and copies JSON", async () => {
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue(undefined);

    render(<PrettyVariableViewer variables={{ meta: { version: 1 } }} />);
    
    const copyBtn = screen.getByTitle("Copy value");
    expect(copyBtn).toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(copyBtn);

    expect(writeTextSpy).toHaveBeenCalledWith(JSON.stringify({ version: 1 }));
  });
});
