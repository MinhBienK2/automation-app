import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, test, vi } from "vitest";
import { WorkflowGraphEditorDialogs } from "./WorkflowGraphEditorDialogs";

const defaultProps = {
  isShortcutGuideOpen: false,
  isSelectionSubflowDialogOpen: false,
  isCreatingSelectionSubflow: false,
  selectionSubflowName: "",
  selectionSubflowError: null,
  onShortcutGuideOpenChange: vi.fn(),
  onSelectionSubflowDialogOpenChange: vi.fn(),
  onSelectionSubflowNameChange: vi.fn(),
  onResetSelectionSubflowDialog: vi.fn(),
  onCreateSubflowFromSelection: vi.fn(),
};

describe("WorkflowGraphEditorDialogs", () => {
  test("renders the graph shortcut guide dialog when opened", () => {
    render(<WorkflowGraphEditorDialogs {...defaultProps} isShortcutGuideOpen />);

    expect(screen.getByRole("dialog", { name: "Graph Shortcuts" })).toBeInTheDocument();
    expect(screen.getByText(/Mouse and keyboard controls/)).toBeInTheDocument();
  });

  test("delegates create-subflow dialog edits and mode actions", async () => {
    const onSelectionSubflowNameChange = vi.fn();
    const onCreateSubflowFromSelection = vi.fn();

    function DialogHarness() {
      const [selectionSubflowName, setSelectionSubflowName] = useState("Login");
      return (
        <WorkflowGraphEditorDialogs
          {...defaultProps}
          isSelectionSubflowDialogOpen
          selectionSubflowName={selectionSubflowName}
          selectionSubflowError="Subflow name is required."
          onSelectionSubflowNameChange={(value) => {
            onSelectionSubflowNameChange(value);
            setSelectionSubflowName(value);
          }}
          onCreateSubflowFromSelection={onCreateSubflowFromSelection}
        />
      );
    }

    render(<DialogHarness />);

    expect(
      screen.getByRole("dialog", { name: "Create subflow from selection" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Subflow name is required.");

    await userEvent.type(screen.getByLabelText("Subflow name"), " block");
    expect(onSelectionSubflowNameChange).toHaveBeenLastCalledWith("Login block");

    await userEvent.click(screen.getByRole("button", { name: "Create Only" }));
    expect(onCreateSubflowFromSelection).toHaveBeenCalledWith("create_only");

    await userEvent.click(screen.getByRole("button", { name: "Create & Replace" }));
    expect(onCreateSubflowFromSelection).toHaveBeenCalledWith("create_and_replace");
  });
});
