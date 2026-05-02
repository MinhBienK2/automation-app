import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import type {
  ActionType,
  GraphNode,
  GraphNodeType,
  WorkflowGraph,
} from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { ScrollArea } from "../../../components/ui/scroll-area";
import { Tabs, TabsList, TabsTrigger } from "../../../components/ui/tabs";
import { graphNodeLabel } from "../lib/workflowGraph";
import { actionGroups, actionLabels, actionOptions } from "../../../lib/workflowUi";
import {
  graphNodeHelpContent,
  type GraphNodeHelpLanguage,
} from "../lib/graphNodeHelpContent";
import { StepHelpModal } from "./StepHelpModal";

export const logicNodeGroups: Array<{
  label: string;
  nodes: GraphNodeType[];
}> = [
  { label: "Branching", nodes: ["if", "switch"] },
  {
    label: "Loops",
    nodes: ["repeat_times", "repeat_for_each", "while", "repeat_until"],
  },
  { label: "Recovery", nodes: ["retry", "try_catch", "fallback"] },
  {
    label: "Flow Control",
    nodes: ["break_loop", "continue_loop", "stop_workflow"],
  },
  {
    label: "Safety",
    nodes: ["manual_approval", "rate_limit", "domain_allowlist"],
  },
];

export const variableNodeGroups = [
  { label: "Variables", nodes: ["set_variable", "transform_variable"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

export const outputNodeGroups = [
  { label: "Outputs", nodes: ["assert_output", "run_subworkflow"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

export const endNodeGroups = [
  { label: "End", nodes: ["end_failure", "stop_workflow"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

const graphNodeDescriptions: Partial<Record<GraphNodeType, string>> = {
  action: "Run a browser, data, session, network, or advanced action.",
  if: "Branch the workflow into True and False paths.",
  switch: "Route execution to a matching case or a default path.",
  repeat_times: "Run a loop path a fixed number of times.",
  repeat_for_each: "Run a loop path once for each item.",
  while: "Repeat while a condition stays true.",
  repeat_until: "Repeat until a condition becomes true or times out.",
  retry: "Retry a path and continue through success or failure.",
  try_catch: "Separate normal work, errors, and final cleanup.",
  fallback: "Try a primary path, then use a fallback path if needed.",
  break_loop: "Exit the current loop.",
  continue_loop: "Skip to the next loop iteration.",
  stop_workflow: "Stop execution with a success or failure status.",
  manual_approval: "Pause for a human checkpoint.",
  rate_limit: "Add safe pacing before continuing.",
  set_variable: "Store a workflow value.",
  transform_variable: "Create an output from an existing value.",
  assert_output: "Require an output value to match an expectation.",
  run_subworkflow: "Run another workflow from this graph.",
  domain_allowlist: "Restrict navigation to allowed domains.",
  end_failure: "End the graph as a failure.",
};

type GraphNodePaletteProps = {
  palette: {
    title: string;
    eyebrow: string;
    searchLabel: string;
    groups: Array<{ label: string; nodes: GraphNodeType[] }>;
  } | null;
  onOpenChange: (open: boolean) => void;
  onSelectNode: (nodeType: GraphNodeType) => void;
};

export function GraphNodePalette({
  palette,
  onOpenChange,
  onSelectNode,
}: GraphNodePaletteProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();
  const groups = palette?.groups ?? [];
  const nodeOptions = groups.flatMap((group) => group.nodes);

  const visibleNodes = useMemo(() => {
    const sourceNodes =
      activeCategory === "All"
        ? nodeOptions
        : groups.find((group) => group.label === activeCategory)?.nodes ?? [];

    if (!normalizedQuery) return sourceNodes;

    return nodeOptions.filter((nodeType) => {
      const label = graphNodeLabel(nodeType).toLowerCase();
      const description = (graphNodeDescriptions[nodeType] ?? "").toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [activeCategory, groups, nodeOptions, normalizedQuery]);

  function resetPalette() {
    setQuery("");
    setActiveCategory("All");
  }

  return (
    <Dialog
      open={Boolean(palette)}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetPalette();
      }}
    >
      <DialogContent className="add-step-palette">
        <DialogHeader>
          <p className="eyebrow">{palette?.eyebrow}</p>
          <DialogTitle>{palette?.title}</DialogTitle>
          <DialogDescription>
            Search or browse categories, then choose a node to add it to the graph.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label={palette?.searchLabel}
          placeholder="Search nodes..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="add-step-palette-body">
          <div aria-label="Node categories" className="action-category-list">
            {["All", ...groups.map((group) => group.label)].map((label) => (
              <Button
                aria-pressed={activeCategory === label && !normalizedQuery}
                className={
                  activeCategory === label && !normalizedQuery
                    ? "action-category action-category-active"
                    : "action-category"
                }
                key={label}
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveCategory(label);
                  setQuery("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <div aria-label="Node results" className="action-result-list">
            {visibleNodes.length === 0 ? (
              <p className="muted">No matching nodes</p>
            ) : (
              visibleNodes.map((nodeType) => (
                <Button
                  className="action-result"
                  data-value={nodeType}
                  key={nodeType}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSelectNode(nodeType);
                    resetPalette();
                  }}
                >
                  <span>{graphNodeLabel(nodeType)}</span>
                  <small>{graphNodeDescriptions[nodeType] ?? "Graph node"}</small>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NodeContextMenuProps = {
  node: GraphNode | null;
  x: number;
  y: number;
  onClose: () => void;
  onDuplicate: () => void;
  onHelp: () => void;
  onDelete: () => void;
};

export function NodeContextMenu({
  node,
  x,
  y,
  onClose,
  onDuplicate,
  onHelp,
  onDelete,
}: NodeContextMenuProps) {
  if (!node) return null;
  const canDelete = node.node_type !== "start";

  return (
    <div
      aria-label="Node actions"
      className="graph-node-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <button type="button" role="menuitem" onClick={onDuplicate}>
        Duplicate
      </button>
      <button type="button" role="menuitem" onClick={onHelp}>
        Help
      </button>
      <button type="button" role="menuitem" onClick={onDelete} disabled={!canDelete}>
        Delete
      </button>
    </div>
  );
}

type LinkContextMenuProps = {
  edge: { id: string } | null;
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
};

export function LinkContextMenu({
  edge,
  x,
  y,
  onClose,
  onDelete,
}: LinkContextMenuProps) {
  if (!edge) return null;

  return (
    <div
      aria-label="Link actions"
      className="graph-node-context-menu graph-link-context-menu"
      role="menu"
      style={{ left: x, top: y }}
      onMouseLeave={onClose}
    >
      <button type="button" role="menuitem" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
}

type NodeHelpDialogProps = {
  node: GraphNode | null;
  language: GraphNodeHelpLanguage;
  onOpenChange: (open: boolean) => void;
  onLanguageChange: (language: GraphNodeHelpLanguage) => void;
};

export function NodeHelpDialog({
  node,
  language,
  onOpenChange,
  onLanguageChange,
}: NodeHelpDialogProps) {
  const actionType = actionTypeForNodeHelp(node);
  if (actionType) {
    return (
      <StepHelpModal
        actionType={actionType}
        language={language}
        onClose={() => onOpenChange(false)}
        onLanguageChange={onLanguageChange}
      />
    );
  }

  const content = node ? graphNodeHelpContent[node.node_type][language] : null;

  return (
    <Dialog open={Boolean(node)} onOpenChange={onOpenChange}>
      <DialogContent className="step-help-dialog">
        <DialogHeader className="modal-header">
          <div>
            <p className="eyebrow">{language === "vi" ? "Trợ giúp node" : "Node Help"}</p>
            <DialogTitle>
              {content ? content.title : `${node ? graphNodeLabel(node.node_type) : "Node"} Help`}
            </DialogTitle>
            <DialogDescription className="sr-only">
              {content?.summary ?? ""}
            </DialogDescription>
          </div>
        </DialogHeader>

        <Tabs
          value={language}
          onValueChange={(value) => onLanguageChange(value as GraphNodeHelpLanguage)}
        >
          <TabsList className="help-language-switch" aria-label="Help language">
            <TabsTrigger
              className={language === "vi" ? "help-language-active" : ""}
              value="vi"
            >
              Tiếng Việt
            </TabsTrigger>
            <TabsTrigger
              className={language === "en" ? "help-language-active" : ""}
              value="en"
            >
              English
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {content ? (
          <ScrollArea className="step-help-body">
            <div
              className="step-help-body"
              style={{ overflow: "visible", paddingRight: 0 }}
            >
              <HelpSection title={language === "vi" ? "Node này làm gì?" : "What this node does"}>
                <p>{content.summary}</p>
              </HelpSection>

              <HelpSection title={language === "vi" ? "Khi nào dùng?" : "When to use it"}>
                <ul>
                  {content.useWhen.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </HelpSection>

              <HelpSection title={language === "vi" ? "Giải thích field và port" : "Field and port guide"}>
                <div className="help-field-list">
                  {content.fields.map((field) => (
                    <div className="help-field-item" key={field.name}>
                      <strong>{field.name}</strong>
                      <p>{field.description}</p>
                      <ul className="help-field-details">
                        {field.details.map((detail) => (
                          <li key={detail}>{detail}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </HelpSection>

              <HelpSection title={language === "vi" ? "Ví dụ" : "Examples"}>
                <ul>
                  {content.examples.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </HelpSection>

              <HelpSection title={language === "vi" ? "Dễ nhầm" : "Common mistakes"}>
                <ul>
                  {content.commonMistakes.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </HelpSection>
            </div>
          </ScrollArea>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function actionTypeForNodeHelp(node: GraphNode | null) {
  if (!node || node.node_type !== "action") return null;
  const config = node.config as { type?: unknown } | null;
  const actionType = typeof config?.type === "string" ? config.type : null;
  return actionType && actionOptions.includes(actionType as ActionType)
    ? (actionType as ActionType)
    : null;
}

function HelpSection({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  return (
    <section className="help-section">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

type ConnectionSummaryProps = {
  graph: WorkflowGraph;
  node: GraphNode;
};

export function ConnectionSummary({ graph, node }: ConnectionSummaryProps) {
  const incoming = graph.edges.filter((edge) => edge.target_node_id === node.id);
  const outgoing = graph.edges.filter((edge) => edge.source_node_id === node.id);
  const nodeLabels = new Map(graph.nodes.map((item) => [item.id, item.label]));

  return (
    <section className="graph-connection-summary" aria-label="Node connections">
      <h3>Connections</h3>
      {incoming.length ? (
        incoming.map((edge) => (
          <span key={edge.id}>
            Incoming from {nodeLabels.get(edge.source_node_id) ?? edge.source_node_id}
          </span>
        ))
      ) : (
        <span>No incoming link</span>
      )}
      {outgoing.length ? (
        outgoing.map((edge) => (
          <span key={edge.id}>
            {portLabel(node, edge.source_port)} to{" "}
            {nodeLabels.get(edge.target_node_id) ?? edge.target_node_id}
          </span>
        ))
      ) : (
        <span>No outgoing link</span>
      )}
    </section>
  );
}

type ActionNodePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (actionType: ActionType) => void;
};

export const hiddenActionPickerTypes = new Set<ActionType>([
  "if_condition",
  "repeat_times",
  "repeat_for_each",
  "retry_block",
  "stop_workflow",
]);

export const actionPickerGroups = actionGroups
  .filter((group) => group.label !== "Logic")
  .map((group) => ({
    ...group,
    actions: group.actions.filter((actionType) => !hiddenActionPickerTypes.has(actionType)),
  }))
  .filter((group) => group.actions.length > 0);

export const actionPickerOptions = actionPickerGroups.flatMap((group) => group.actions);

const commonActionTypes: ActionType[] = [
  "navigate",
  "click",
  "input_text",
  "wait",
  "extract_text",
  "take_screenshot",
];

export const actionDescriptions: Record<ActionType, string> = {
  navigate: "Open a page",
  wait: "Pause or wait for a condition",
  input_text: "Fill a field",
  clear_input: "Clear a field",
  click: "Click an element",
  scroll: "Move the page or an element",
  select_option: "Choose a native select option",
  set_checkbox: "Set checkbox state",
  press_key: "Press one key",
  hotkey: "Press a keyboard shortcut",
  hover: "Move over an element",
  double_click: "Double click an element",
  right_click: "Open a context click",
  drag_and_drop: "Drag one element to another",
  focus_element: "Focus an element",
  blur_element: "Remove focus from an element",
  type_sequence: "Type text as a sequence",
  set_clipboard: "Store clipboard text",
  paste_clipboard: "Paste stored clipboard text",
  check: "Check a checkbox",
  uncheck: "Uncheck a checkbox",
  toggle_checkbox: "Toggle a checkbox",
  select_radio: "Select a radio option",
  upload_file: "Upload a local file",
  submit_form: "Submit a form",
  select_custom_option: "Choose a custom dropdown option",
  set_contenteditable: "Fill editable content",
  extract_text: "Capture page text",
  extract_attribute: "Capture an element attribute",
  extract_input_value: "Capture a field value",
  extract_table: "Capture table data",
  extract_list: "Capture repeated items",
  take_screenshot: "Save visual evidence",
  go_back: "Go back in history",
  go_forward: "Go forward in history",
  reload: "Reload the page",
  open_new_tab: "Open a browser tab",
  switch_tab: "Change the active tab",
  close_tab: "Close a browser tab",
  switch_frame: "Target an iframe",
  accept_dialog: "Accept a browser dialog",
  dismiss_dialog: "Dismiss a browser dialog",
  set_download_directory: "Choose download location",
  wait_for_download: "Wait for a download",
  set_variable: "Store a workflow value",
  assert_element: "Require an element state",
  assert_text: "Require matching text",
  if_condition: "Run steps conditionally",
  repeat_times: "Repeat nested steps",
  repeat_for_each: "Repeat for each item",
  retry_block: "Retry a group of steps",
  stop_workflow: "Stop execution",
  use_profile: "Use a browser profile",
  save_session: "Save browser session",
  load_session: "Load browser session",
  set_cookie: "Set a browser cookie",
  clear_cookies: "Clear browser cookies",
  set_secret: "Store a secret value",
  use_proxy: "Route traffic through a proxy",
  set_user_agent: "Set user agent string",
  set_viewport: "Set viewport size",
  set_geolocation: "Set location data",
  set_extra_headers: "Attach request headers",
  grant_permission: "Grant browser permission",
  detect_challenge: "Detect human verification",
  pause_for_human: "Pause for manual action",
  resume_when_condition: "Resume after a condition",
  fallback_selector: "Use a fallback selector",
  retry_step: "Retry one flaky step",
  checkpoint: "Save a recovery point",
  execute_js: "Run JavaScript",
  wait_for_request: "Wait for a request",
  wait_for_response: "Wait for a response",
  block_request: "Block matching requests",
  mock_response: "Mock a response",
  set_local_storage: "Set local storage",
  set_session_storage: "Set session storage",
};

export function ActionNodePalette({
  open,
  onOpenChange,
  onSelectAction,
}: ActionNodePaletteProps) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();

  const visibleActions = useMemo(() => {
    const sourceActions =
      activeCategory === "All"
        ? actionPickerOptions
        : activeCategory === "Common"
        ? commonActionTypes
        : actionPickerGroups.find((group) => group.label === activeCategory)?.actions ?? [];

    if (!normalizedQuery) return sourceActions;

    return actionPickerOptions.filter((actionType) => {
      const label = actionLabels[actionType].toLowerCase();
      const description = actionDescriptions[actionType].toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [activeCategory, normalizedQuery]);

  function resetPalette() {
    setQuery("");
    setActiveCategory("All");
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        onOpenChange(nextOpen);
        if (!nextOpen) resetPalette();
      }}
    >
      <DialogContent className="add-step-palette">
        <DialogHeader>
          <p className="eyebrow">Add Action Node</p>
          <DialogTitle>Choose an action type</DialogTitle>
          <DialogDescription>
            Search or browse categories, then choose an action to add it to the graph.
          </DialogDescription>
        </DialogHeader>

        <Input
          aria-label="Search actions"
          placeholder="Search actions..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <div className="add-step-palette-body">
          <div aria-label="Action categories" className="action-category-list">
            {["All", "Common", ...actionPickerGroups.map((group) => group.label)].map((label) => (
              <Button
                aria-pressed={activeCategory === label && !normalizedQuery}
                className={
                  activeCategory === label && !normalizedQuery
                    ? "action-category action-category-active"
                    : "action-category"
                }
                key={label}
                type="button"
                variant="ghost"
                onClick={() => {
                  setActiveCategory(label);
                  setQuery("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <div aria-label="Action results" className="action-result-list">
            {visibleActions.length === 0 ? (
              <p className="muted">No matching actions</p>
            ) : (
              visibleActions.map((actionType) => (
                <Button
                  className="action-result"
                  data-value={actionType}
                  key={actionType}
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    onSelectAction(actionType);
                    resetPalette();
                  }}
                >
                  <span>{actionLabels[actionType]}</span>
                  <small>{actionDescriptions[actionType]}</small>
                </Button>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function portLabel(node: GraphNode, portId: string) {
  const label = node.ports.find((port) => port.id === portId)?.label ?? portId;
  if (label.toLowerCase() === "out") return "Next";
  return label;
}
