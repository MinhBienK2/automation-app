import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ActionType } from "../../../types/workflow";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";

export type DesktopActionNodePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (actionType: ActionType) => void;
};

const desktopActionsList: Array<{ type: ActionType; label: string; description: string }> = [
  { type: "desktop_launch_app", label: "Launch Application", description: "Launch a desktop application by executable path and optional arguments." },
  { type: "desktop_click", label: "Mouse Click", description: "Click, double click, or right click at absolute x/y coordinates or on a window/element." },
  { type: "desktop_type_text", label: "Type Text", description: "Type text into a target application field or coordinate." },
  { type: "desktop_press_key", label: "Press Key", description: "Press a specific key on the keyboard." },
  { type: "desktop_hotkey", label: "Send Hotkey", description: "Press a keyboard hotkey combination (e.g. Ctrl+C)." },
  { type: "desktop_scroll", label: "Mouse Scroll", description: "Scroll the mouse wheel in a specified direction." },
  { type: "desktop_screenshot", label: "Take Screenshot", description: "Take a screenshot of the desktop." },
  { type: "desktop_wait", label: "Wait Duration", description: "Pause execution for a specific duration in milliseconds." },
];

export function DesktopActionNodePalette({
  open,
  onOpenChange,
  onSelectAction,
}: DesktopActionNodePaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredActions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return desktopActionsList;
    return desktopActionsList.filter(
      (a) => a.label.toLowerCase().includes(q) || a.description.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="add-step-palette max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Desktop Action</DialogTitle>
          <DialogDescription>
            Select a desktop automation action to add to your workflow.
          </DialogDescription>
        </DialogHeader>

        <div className="relative mt-2">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-secondary/70" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search desktop actions..."
            className="pl-9 input-sm"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4 max-h-96 overflow-y-auto pr-1">
          {filteredActions.map((action) => (
            <button
              key={action.type}
              type="button"
              onClick={() => {
                onSelectAction(action.type);
                onOpenChange(false);
              }}
              className="flex flex-col text-left p-3.5 rounded-lg border border-base-300 hover:border-primary hover:bg-base-200 cursor-pointer transition-all gap-1 group"
            >
              <span className="font-bold text-sm text-base-content group-hover:text-primary transition-all">
                {action.label}
              </span>
              <span className="text-xs text-secondary leading-relaxed">
                {action.description}
              </span>
            </button>
          ))}
          {filteredActions.length === 0 && (
            <div className="text-center text-xs text-secondary py-8 col-span-2">
              No matching desktop actions found.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
