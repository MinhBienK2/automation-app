import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { PrettyVariableViewer } from "./PrettyVariableViewer";

describe("PrettyVariableViewer", () => {
  test("renders primitive boolean values as user-friendly text", () => {
    render(<PrettyVariableViewer variables={{ is_active: true, is_blocked: false }} />);
    expect(screen.getByText("is_active")).toBeInTheDocument();
    expect(screen.getByText(/ĐÚNG|Đúng/)).toBeInTheDocument();
    expect(screen.getByText("is_blocked")).toBeInTheDocument();
    expect(screen.getByText(/SAI|Sai/)).toBeInTheDocument();
  });

  test("renders null or undefined values as user-friendly empty label", () => {
    render(<PrettyVariableViewer variables={{ empty_val: null }} />);
    expect(screen.getByText("empty_val")).toBeInTheDocument();
    expect(screen.getByText(/(Trống|Chưa có dữ liệu)/)).toBeInTheDocument();
  });

  test("renders formatted numbers", () => {
    render(<PrettyVariableViewer variables={{ price: 1250000 }} />);
    expect(screen.getByText("price")).toBeInTheDocument();
    expect(screen.getByText("1,250,000")).toBeInTheDocument();
  });

  test("renders array elements with clean numbering and cards", () => {
    render(<PrettyVariableViewer variables={{ items: ["apple", "banana"] }} />);
    // Check array name and count
    expect(screen.getByText(/items/)).toBeInTheDocument();
    expect(screen.getByText(/2 phần tử/)).toBeInTheDocument();
    // Check items formatting
    expect(screen.getByText(/Phần tử 1/)).toBeInTheDocument();
    expect(screen.getByText("apple")).toBeInTheDocument();
    expect(screen.getByText(/Phần tử 2/)).toBeInTheDocument();
    expect(screen.getByText("banana")).toBeInTheDocument();
  });

  test("renders nested objects with proper keys", () => {
    render(<PrettyVariableViewer variables={{ profile: { name: "John", age: 30 } }} />);
    expect(screen.getByText(/profile/)).toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
    expect(screen.getByText("John")).toBeInTheDocument();
    expect(screen.getByText("age")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });
});
