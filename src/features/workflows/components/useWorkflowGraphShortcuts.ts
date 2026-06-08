import { useEffect, type MutableRefObject, type RefObject } from "react";

type UseWorkflowGraphShortcutsInput = {
  editorRef: RefObject<HTMLElement | null>;
  isGraphShortcutActiveRef: MutableRefObject<boolean>;
  isEditingDisabled: boolean;
  onSetSpacePanActive: (active: boolean) => void;
  onDeleteSelection: () => void;
  onUndo: () => void;
  onRedo: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onDuplicate: () => void;
  onSave?: () => void;
  onValidate?: () => void;
  onRun?: () => void;
  onFitView: () => void;
  onEscape: () => void;
};

export function shouldIgnoreGraphShortcut(event: KeyboardEvent) {
  const target = event.target;
  if (!(target instanceof Element)) return false;

  const tagName = target.tagName.toLowerCase();
  if (
    tagName === "input" ||
    tagName === "textarea" ||
    tagName === "select" ||
    target.getAttribute("contenteditable") === "true"
  ) {
    return true;
  }

  return Boolean(target.closest('[role="dialog"], .action-type-popover'));
}

export function useWorkflowGraphShortcuts({
  editorRef,
  isGraphShortcutActiveRef,
  isEditingDisabled,
  onSetSpacePanActive,
  onDeleteSelection,
  onUndo,
  onRedo,
  onCopy,
  onPaste,
  onDuplicate,
  onSave,
  onValidate,
  onRun,
  onFitView,
  onEscape,
}: UseWorkflowGraphShortcutsInput) {
  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      isGraphShortcutActiveRef.current =
        target instanceof Node && Boolean(editorRef.current?.contains(target));
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (!isGraphShortcutActiveRef.current) return;
      if (shouldIgnoreGraphShortcut(event)) return;

      if (event.code === "Space") {
        event.preventDefault();
        onSetSpacePanActive(true);
        return;
      }

      const usesModifier = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();

      if (!usesModifier && (event.key === "Delete" || event.key === "Backspace")) {
        if (isEditingDisabled) return;
        event.preventDefault();
        onDeleteSelection();
        return;
      }

      if (usesModifier && key === "z" && !event.shiftKey) {
        if (isEditingDisabled) return;
        event.preventDefault();
        onUndo();
        return;
      }

      if (usesModifier && ((key === "z" && event.shiftKey) || key === "y")) {
        if (isEditingDisabled) return;
        event.preventDefault();
        onRedo();
        return;
      }

      if (usesModifier && key === "c") {
        if (isEditingDisabled) return;
        event.preventDefault();
        onCopy();
        return;
      }

      if (usesModifier && key === "v") {
        if (isEditingDisabled) return;
        event.preventDefault();
        onPaste();
        return;
      }

      if (usesModifier && key === "d") {
        if (isEditingDisabled) return;
        event.preventDefault();
        onDuplicate();
        return;
      }

      if (usesModifier && key === "s" && onSave) {
        event.preventDefault();
        onSave();
        return;
      }

      if (usesModifier && event.key === "Enter" && event.shiftKey && onValidate) {
        event.preventDefault();
        onValidate();
        return;
      }

      if (
        usesModifier &&
        event.key === "Enter" &&
        !event.shiftKey &&
        !isEditingDisabled &&
        onRun
      ) {
        event.preventDefault();
        onRun();
        return;
      }

      if ((!usesModifier && key === "f") || (usesModifier && event.key === "0")) {
        event.preventDefault();
        onFitView();
        return;
      }

      if (!usesModifier && event.key === "Escape") {
        event.preventDefault();
        onEscape();
      }
    }

    function handleKeyUp(event: KeyboardEvent) {
      if (!isGraphShortcutActiveRef.current) return;
      if (event.code === "Space") {
        event.preventDefault();
        onSetSpacePanActive(false);
      }
    }

    function stopPanMode() {
      onSetSpacePanActive(false);
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", stopPanMode);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", stopPanMode);
    };
  });
}
