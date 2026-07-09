import { ChevronLeft, ChevronRight } from "lucide-react";

export const PALETTE_ITEMS = [
  {
    category: "Action Nodes",
    nodes: [
      { type: "action", label: "Visit", actionType: "navigate" },
      { type: "action", label: "Click", actionType: "click" },
      { type: "action", label: "Input Text", actionType: "input_text" },
      { type: "action", label: "Press Key", actionType: "press_key" },
      { type: "action", label: "Wait", actionType: "wait" },
      { type: "action", label: "Execute JS", actionType: "execute_js" },
    ],
  },
  {
    category: "Logic Nodes",
    nodes: [
      { type: "if_else", label: "If/Else" },
      { type: "loop", label: "Loop" },
      { type: "try_catch", label: "Try/Catch" },
      { type: "call_subflow", label: "Call Subflow" },
    ],
  },
  {
    category: "Variables",
    nodes: [
      { type: "define_variables", label: "Define Variables" },
      { type: "set_variable", label: "Set Variable" },
    ],
  },
];

type WorkflowGraphPaletteSidebarProps = {
  isOpen: boolean;
  onToggle: (open: boolean) => void;
};

export function WorkflowGraphPaletteSidebar({
  isOpen,
  onToggle,
}: WorkflowGraphPaletteSidebarProps) {
  return (
    <>
      <aside className={`graph-palette-sidebar ${isOpen ? "open" : "collapsed"}`} aria-label="Node Palette">
        <div className="palette-header">
          <h3>Node Palette</h3>
          <button
            type="button"
            className="palette-toggle-btn"
            onClick={() => onToggle(false)}
            aria-label="Collapse palette"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
        </div>
        <div className="palette-content">
          {PALETTE_ITEMS.map((group) => (
            <div key={group.category} className="palette-group">
              <h4>{group.category}</h4>
              <div className="palette-grid">
                {group.nodes.map((node) => (
                  <div
                    key={node.label}
                    className="palette-node-item"
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData(
                        "application/reactflow",
                        JSON.stringify({
                          type: node.type,
                          label: node.label,
                          actionType: (node as any).actionType,
                        })
                      );
                      event.dataTransfer.effectAllowed = "move";
                    }}
                  >
                    <span className="palette-node-dot" />
                    <span>{node.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {!isOpen && (
        <button
          type="button"
          className="graph-palette-expand-trigger"
          onClick={() => onToggle(true)}
          aria-label="Expand palette"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      )}
    </>
  );
}
