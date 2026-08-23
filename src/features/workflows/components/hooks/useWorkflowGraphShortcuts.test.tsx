import { fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { describe, expect, test, vi } from "vitest";
import { useWorkflowGraphShortcuts } from "./useWorkflowGraphShortcuts";

describe("useWorkflowGraphShortcuts", () => {
  test("runs graph shortcuts only when the editor owns the active event target", () => {
    const onDuplicate = vi.fn();
    const onSetSpacePanActive = vi.fn();

    function Harness() {
      const editorRef = useRef<HTMLElement | null>(null);
      const isGraphShortcutActiveRef = useRef(false);
      useWorkflowGraphShortcuts({
        editorRef,
        isGraphShortcutActiveRef,
        isEditingDisabled: false,
        onSetSpacePanActive,
        onDeleteSelection: vi.fn(),
        onUndo: vi.fn(),
        onRedo: vi.fn(),
        onCopy: vi.fn(),
        onPaste: vi.fn(),
        onDuplicate,
        onSave: undefined,
        onValidate: undefined,
        onRun: undefined,
        onFitView: vi.fn(),
        onEscape: vi.fn(),
      });

      return (
        <section ref={editorRef} aria-label="Editor">
          <button type="button">Canvas</button>
          <input aria-label="Config field" />
        </section>
      );
    }

    render(<Harness />);

    fireEvent.pointerDown(screen.getByRole("button", { name: "Canvas" }));
    fireEvent.keyDown(window, { key: "d", ctrlKey: true });
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(screen.getByLabelText("Config field"), {
      key: "d",
      ctrlKey: true,
    });
    expect(onDuplicate).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { code: "Space", key: " " });
    expect(onSetSpacePanActive).toHaveBeenLastCalledWith(true);
    fireEvent.keyUp(window, { code: "Space", key: " " });
    expect(onSetSpacePanActive).toHaveBeenLastCalledWith(false);
  });
});
