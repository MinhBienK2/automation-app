type GraphShortcutGroup = {
  title: string;
  items: Array<{
    keys: string;
    description: string;
  }>;
};

const graphShortcutGroups: GraphShortcutGroup[] = [
  {
    title: "Navigation",
    items: [
      { keys: "Drag empty canvas", description: "Box select nodes and links" },
      { keys: "Hold Space + drag", description: "Pan the graph view" },
      { keys: "F", description: "Fit selected node or graph into view" },
      { keys: "Ctrl/Cmd + 0", description: "Fit graph into view" },
      { keys: "Mouse wheel / pinch", description: "Zoom the graph view" },
    ],
  },
  {
    title: "Selection",
    items: [
      { keys: "Click node or link", description: "Select a single graph item" },
      { keys: "Shift/Ctrl/Cmd + click", description: "Add or remove an item from selection" },
      { keys: "Esc", description: "Close graph menus or clear selection" },
    ],
  },
  {
    title: "Editing",
    items: [
      { keys: "Delete / Backspace", description: "Delete selected nodes or links" },
      { keys: "Ctrl/Cmd + C", description: "Copy selected graph fragment" },
      { keys: "Ctrl/Cmd + V", description: "Paste copied graph fragment" },
      { keys: "Ctrl/Cmd + D", description: "Duplicate selected nodes" },
      { keys: "Ctrl/Cmd + Z", description: "Undo graph edit" },
      { keys: "Ctrl/Cmd + Shift + Z / Ctrl/Cmd + Y", description: "Redo graph edit" },
    ],
  },
  {
    title: "Run and save",
    items: [
      { keys: "Ctrl/Cmd + S", description: "Save graph" },
      { keys: "Ctrl/Cmd + Enter", description: "Run workflow" },
      { keys: "Ctrl/Cmd + Shift + Enter", description: "Validate graph" },
    ],
  },
];

export function GraphShortcutGuide() {
  return (
    <div className="graph-shortcut-guide">
      {graphShortcutGroups.map((group) => (
        <section
          aria-label={`${group.title} shortcuts`}
          className="graph-shortcut-group"
          key={group.title}
        >
          <h3>{group.title}</h3>
          <dl>
            {group.items.map((item) => (
              <div className="graph-shortcut-row" key={item.keys}>
                <dt>
                  <kbd>{item.keys}</kbd>
                </dt>
                <dd>{item.description}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
