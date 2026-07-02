import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { RunVariablesDrawer } from "./RunVariablesDrawer";

describe("RunVariablesDrawer", () => {
  test("renders drawer title and variables", () => {
    render(
      <RunVariablesDrawer
        variables={{ username: "alice", role: "admin" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("Variables")).toBeInTheDocument();
    expect(screen.getByText("username")).toBeInTheDocument();
    expect(screen.getByText("alice")).toBeInTheDocument();
    expect(screen.getByText("role")).toBeInTheDocument();
    expect(screen.getByText("admin")).toBeInTheDocument();
  });

  test("shows live status by default", () => {
    render(
      <RunVariablesDrawer
        variables={{}}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Live/)).toBeInTheDocument();
    expect(screen.queryByText(/Quay lại Live/)).not.toBeInTheDocument();
  });

  test("shows snapshot status and Back to Live button when in snapshot mode", () => {
    const onBackToLiveMock = vi.fn();
    render(
      <RunVariablesDrawer
        variables={{}}
        isSnapshot={true}
        snapshotNodeName="Click Button Node"
        onBackToLive={onBackToLiveMock}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText(/Snapshot/)).toBeInTheDocument();
    expect(screen.getByText(/Click Button Node/)).toBeInTheDocument();
    
    const backBtn = screen.getByText(/Quay lại Live/);
    expect(backBtn).toBeInTheDocument();
    fireEvent.click(backBtn);
    expect(onBackToLiveMock).toHaveBeenCalledTimes(1);
  });

  test("filters variables based on search input", () => {
    render(
      <RunVariablesDrawer
        variables={{ first_name: "alice", last_name: "bob" }}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText("first_name")).toBeInTheDocument();
    expect(screen.getByText("last_name")).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Tìm kiếm biến/);
    fireEvent.change(searchInput, { target: { value: "last" } });

    expect(screen.queryByText("first_name")).not.toBeInTheDocument();
    expect(screen.getByText("last_name")).toBeInTheDocument();
  });
});
