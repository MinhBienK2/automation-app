import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Blocks, Copy, Search, Workflow } from "lucide-react";
import type {
  ActionType,
  GraphNode,
  GraphNodeType,
  SubflowSummary,
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
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { graphNodeLabel } from "../lib/workflowGraph";
import {
  actionGroups,
  actionLabels,
  allActionOptions,
} from "../../../lib/workflowUi";
import {
  graphNodeHelpContent,
  type GraphNodeFieldReference,
  type GraphNodeHelpLanguage,
} from "../lib/graphNodeHelpContent";
import type { HelpFieldCategory } from "../lib/stepHelpTypes";
import { StepHelpModal } from "./StepHelpModal";
import { HelpDisclosure } from "./HelpDisclosure";

export const logicNodeGroups: Array<{
  label: string;
  nodes: GraphNodeType[];
}> = [
  { label: "Branching", nodes: ["if", "switch", "router", "random_choice", "merge"] },
  {
    label: "Loops",
    nodes: [
      "repeat_times",
      "repeat_for_each",
      "while",
      "repeat_until",
      "break_loop",
      "continue_loop",
    ],
  },
  { label: "Recovery", nodes: ["retry"] },
];

export const variableNodeGroups = [
  {
    label: "Variables",
    nodes: [
      "set_variable",
      "set_json_variables",
      "check_conditions",
      "calculate_value",
      "update_number_variable",
      "update_text_variable",
    ],
  },
  {
    label: "Boolean: Create",
    nodes: [
      "set_boolean_variable",
      "generate_random_boolean",
      "parse_to_boolean",
    ],
  },
  {
    label: "Boolean: Process",
    nodes: [
      "boolean_logical_op",
    ],
  },
  {
    label: "Boolean: Conditions",
    nodes: [
      "compare_booleans",
      "check_boolean_property",
    ],
  },
  {
    label: "Number: Create/Update",
    nodes: [
      "set_number_variable",
      "generate_random_number",
      "parse_text_to_number",
    ],
  },
  {
    label: "Number: Process",
    nodes: [
      "math_operation",
      "round_number",
      "format_number",
    ],
  },
  {
    label: "Number: Conditions",
    nodes: [
      "compare_numbers",
      "check_number_range",
      "check_number_property",
    ],
  },
  {
    label: "Object: Create",
    nodes: [
      "create_empty_object",
      "create_object_manual",
      "parse_json_to_object",
    ],
  },
  {
    label: "Object: Update",
    nodes: [
      "set_object_property",
      "remove_object_property",
      "merge_objects",
      "rename_object_property",
    ],
  },
  {
    label: "Object: Process",
    nodes: [
      "get_object_property",
      "get_object_keys",
      "get_object_values",
      "stringify_object",
      "execute_object_script",
    ],
  },
  {
    label: "Object: Conditions",
    nodes: [
      "check_object_key_exists",
      "check_object_empty",
    ],
  },
  {
    label: "List: Create",
    nodes: [
      "create_empty_list",
      "create_list_manual",
      "split_text_to_list",
      "generate_number_range",
    ],
  },
  {
    label: "List: Update",
    nodes: [
      "add_to_list",
      "remove_from_list_by_index",
      "remove_from_list_by_value",
      "merge_lists",
    ],
  },
  {
    label: "List: Process",
    nodes: [
      "get_list_item",
      "get_list_length",
      "slice_list",
      "join_list",
      "filter_list",
      "map_list_property",
      "sort_reverse_list",
      "execute_list_script",
    ],
  },
  {
    label: "List: Conditions",
    nodes: [
      "check_list_empty",
      "check_list_contains",
      "check_list_any_match",
      "check_list_all_match",
    ],
  },
  {
    label: "Text: Create",
    nodes: [
      "set_text_variable",
    ],
  },
  {
    label: "Text: Update",
    nodes: [
      "append_text",
      "prepend_text",
      "replace_text",
      "trim_text",
      "change_text_case",
    ],
  },
  {
    label: "Text: Process",
    nodes: [
      "slice_text",
      "regex_extract",
      "get_text_length",
    ],
  },
  {
    label: "Text: Conditions",
    nodes: [
      "check_text_empty",
      "check_text_contains",
      "check_text_regex_matches",
    ],
  },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

export const endNodeGroups = [
  { label: "End", nodes: ["end_success", "end_failure", "stop_workflow"] },
] satisfies Array<{ label: string; nodes: GraphNodeType[] }>;

const graphNodeDescriptions: Partial<Record<GraphNodeType, string>> = {
  action: "Run a browser, data, session, network, or advanced action.",
  merge: "Let multiple branch paths continue into one shared path.",
  router: "Evaluate prioritized cases and run the first matching branch.",
  random_choice: "Choose one weighted branch at runtime.",
  call_subflow: "Run a reusable subflow from this project.",
  if: "Branch the workflow into True and False paths.",
  switch: "Route execution to a matching case or a default path.",
  repeat_times: "Run a loop path a fixed number of times.",
  repeat_for_each: "Run a loop path once for each item.",
  while: "Repeat while a condition stays true.",
  repeat_until: "Repeat until a condition becomes true or times out.",
  retry: "Retry a path and continue through success or failure.",
  try_catch: "Separate normal work, errors, and final cleanup.",
  fallback: "Try a primary path, then use a fallback path if needed.",
  break_loop: "Exit the current loop and continue after it.",
  continue_loop: "Skip the rest of the loop body and move to the next iteration.",
  set_variable: "Store multiple workflow values.",
  set_json_variables: "Store structured JSON values.",
  check_conditions: "Check rules or run custom JavaScript to determine if conditions are met.",
  calculate_value: "Evaluate JavaScript or mathematical expressions to set a variable value.",
  update_number_variable: "Update a number variable (increment, add, multiply, etc.).",
  set_number_variable: "Set a number variable value directly.",
  generate_random_number: "Generate a random decimal or integer within a range.",
  parse_text_to_number: "Convert a text value into a number with an optional fallback.",
  math_operation: "Perform arithmetic (add, subtract, etc.) or advanced operations (abs, sqrt, min, max).",
  round_number: "Round, floor, or ceil a number to a specific decimal place.",
  format_number: "Format a number with local currency, percentages, or decimal separators.",
  compare_numbers: "Compare two numbers (greater than, less than, equals, etc.).",
  check_number_range: "Check if a number falls within a minimum and maximum range.",
  check_number_property: "Test a number for properties like even, odd, integer, or positive/negative.",
  update_text_variable: "Update a text variable (append, replace, trim, casing).",
  set_boolean_variable: "Set a boolean variable value directly.",
  generate_random_boolean: "Generate a random boolean value with a given probability.",
  parse_to_boolean: "Convert a text/number value to a boolean flag.",
  boolean_logical_op: "Perform logical operations (AND, OR, NOT, XOR) on booleans.",
  compare_booleans: "Compare two boolean values for equality.",
  check_boolean_property: "Check if a boolean variable is true or false.",
  update_list_variable: "Update a list variable (push, pop, shift, unshift, remove, unique, merge).",
  create_empty_list: "Create an empty list variable.",
  create_list_manual: "Create a list by specifying items manually.",
  split_text_to_list: "Split a text string into a list using a delimiter.",
  generate_number_range: "Generate a list of numbers from start to end.",
  add_to_list: "Add a value to the start, end, or uniquely to a list.",
  remove_from_list_by_index: "Remove a list item at a specific index.",
  remove_from_list_by_value: "Remove list items matching a value.",
  merge_lists: "Merge another list or set of values into a list.",
  get_list_item: "Get a single item from a list by index or position.",
  get_list_length: "Get the number of items in a list.",
  slice_list: "Get a sub-list from start to end index.",
  join_list: "Join all list items into a single text string.",
  filter_list: "Filter list items based on visual rules.",
  map_list_property: "Extract a property from a list of objects.",
  sort_reverse_list: "Sort list items or reverse their order.",
  execute_list_script: "Run custom Javascript code to process a list.",
  check_list_empty: "Check if a list is empty.",
  check_list_contains: "Check if a list contains a specific value.",
  check_list_any_match: "Check if any list item matches a condition.",
  check_list_all_match: "Check if all list items match a condition.",
  create_empty_object: "Create a new empty JSON object variable.",
  create_object_manual: "Create a JSON object by manually specifying keys and values.",
  parse_json_to_object: "Parse a JSON string into an object variable.",
  set_object_property: "Set or update a property value on an object (supports dot-path).",
  remove_object_property: "Remove a property from an object.",
  merge_objects: "Merge another object or JSON string into an object variable.",
  rename_object_property: "Rename an existing property key on an object.",
  get_object_property: "Get the value of a property from an object.",
  get_object_keys: "Get a list of all keys in an object.",
  get_object_values: "Get a list of all values in an object.",
  stringify_object: "Convert an object variable into a formatted JSON string.",
  execute_object_script: "Run custom JavaScript code to transform or process an object.",
  check_object_key_exists: "Check if a property key exists in an object.",
  check_object_empty: "Check if an object has no properties.",
  transform_variable: "Create an output from an existing value.",
  assert_output: "Require an output value to match an expectation.",
  domain_allowlist: "Restrict navigation to allowed domains.",
  end_success: "End the graph successfully.",
  end_failure: "End the graph as a failure.",
};

type SubflowNodePaletteProps = {
  open: boolean;
  subflows: SubflowSummary[];
  error?: string | null;
  isSelecting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectSubflow: (subflow: SubflowSummary, mode: SubflowAddMode) => void;
};

export type SubflowAddMode = "call_node" | "insert_nodes";

const subflowAddModeCards: Array<{
  value: SubflowAddMode;
  label: string;
  detail: string;
  badge: string;
  Icon: typeof Blocks;
}> = [
  {
    value: "call_node",
    label: "Call subflow",
    detail: "Linked reusable node",
    badge: "Default",
    Icon: Blocks,
  },
  {
    value: "insert_nodes",
    label: "Insert nodes",
    detail: "Editable copied nodes",
    badge: "Copy",
    Icon: Copy,
  },
];

export function SubflowNodePalette({
  open,
  subflows,
  error = null,
  isSelecting = false,
  onOpenChange,
  onSelectSubflow,
}: SubflowNodePaletteProps) {
  const [query, setQuery] = useState("");
  const [addMode, setAddMode] = useState<SubflowAddMode>("call_node");
  const normalizedQuery = query.trim().toLowerCase();
  const visibleSubflows = useMemo(() => {
    if (!normalizedQuery) return subflows;
    return subflows.filter((subflow) => {
      const haystack = [subflow.name, subflow.description ?? ""]
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [normalizedQuery, subflows]);

  function resetPalette() {
    setQuery("");
    setAddMode("call_node");
  }

  useEffect(() => {
    if (!open) {
      setQuery("");
      setAddMode("call_node");
    }
  }, [open]);

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
          <p className="eyebrow">Add Subflow</p>
          <DialogTitle>Choose a subflow</DialogTitle>
          <DialogDescription>
            Select a reusable graph path from this project and choose how it should be added.
          </DialogDescription>
        </DialogHeader>

        <div className="subflow-mode-grid" role="group" aria-label="Subflow add mode">
          {subflowAddModeCards.map(({ value, label, detail, badge, Icon }) => {
            const active = addMode === value;
            return (
              <Button
                aria-pressed={active}
                className={
                  active
                    ? "subflow-mode-card subflow-mode-card-active"
                    : "subflow-mode-card"
                }
                key={value}
                type="button"
                variant="ghost"
                onClick={() => setAddMode(value)}
              >
                <span className="subflow-mode-icon" aria-hidden="true">
                  <Icon />
                </span>
                <span className="subflow-mode-copy">
                  <span>{label}</span>
                  <small>{detail}</small>
                </span>
                <span className="subflow-mode-badge">{badge}</span>
              </Button>
            );
          })}
        </div>

        <div className="subflow-picker-search-row">
          <div className="subflow-picker-search">
            <Search aria-hidden="true" />
            <Input
              aria-label="Search subflows"
              placeholder="Search subflows..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </div>
          <span className="subflow-picker-count">
            {visibleSubflows.length} {visibleSubflows.length === 1 ? "match" : "matches"}
          </span>
        </div>

        {error ? (
          <p className="graph-subflow-create-error" role="alert">
            {error}
          </p>
        ) : null}

        <div className="subflow-picker-results" aria-label="Subflow results">
          {visibleSubflows.length === 0 ? (
            <div className="empty-state panel">
              <h2>No subflows in this project</h2>
              <p className="muted">
                Create one from Projects &gt; Subflows before adding it here.
              </p>
            </div>
          ) : (
            visibleSubflows.map((subflow) => (
              <Button
                className="subflow-picker-result"
                data-value={subflow.id}
                key={subflow.id}
                type="button"
                variant="ghost"
                disabled={isSelecting}
                onClick={() => {
                  onSelectSubflow(subflow, addMode);
                  if (addMode === "call_node") resetPalette();
                }}
              >
                <span className="subflow-picker-result-icon" aria-hidden="true">
                  <Workflow />
                </span>
                <span className="subflow-picker-result-main">
                  <span className="subflow-picker-result-title">{subflow.name}</span>
                  <small>
                    {[subflow.description, `${subflow.used_by_count} ${subflow.used_by_count === 1 ? "workflow" : "workflows"}`]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </span>
                <span className="subflow-picker-result-action">
                  {addMode === "call_node" ? "Add call node" : "Insert nodes"}
                </span>
              </Button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

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
  const [activeSubCategory, setActiveSubCategory] = useState("All");
  const normalizedQuery = query.trim().toLowerCase();
  const groups = palette?.groups ?? [];
  const nodeOptions = groups.flatMap((group) => group.nodes);

  const mainCategories = useMemo(() => {
    const categories = new Set<string>();
    groups.forEach((group) => {
      const parts = group.label.split(":");
      categories.add(parts[0].trim());
    });
    return Array.from(categories);
  }, [groups]);

  const matchingGroups = useMemo(() => {
    if (activeCategory === "All") return groups;
    return groups.filter((group) => {
      const parts = group.label.split(":");
      return parts[0].trim() === activeCategory;
    });
  }, [activeCategory, groups]);

  const subCategories = useMemo(() => {
    if (activeCategory === "All") return [];
    const subcats: string[] = [];
    matchingGroups.forEach((group) => {
      const parts = group.label.split(":");
      if (parts.length > 1) {
        subcats.push(parts[1].trim());
      }
    });
    return subcats;
  }, [activeCategory, matchingGroups]);

  const visibleNodes = useMemo(() => {
    let sourceNodes: GraphNodeType[] = [];
    if (activeCategory === "All") {
      sourceNodes = nodeOptions;
    } else {
      const filteredGroups = matchingGroups.filter((group) => {
        if (activeSubCategory === "All") return true;
        const parts = group.label.split(":");
        return parts.length > 1 && parts[1].trim() === activeSubCategory;
      });
      sourceNodes = filteredGroups.flatMap((group) => group.nodes);
    }

    if (!normalizedQuery) return sourceNodes;

    return nodeOptions.filter((nodeType) => {
      const label = graphNodeLabel(nodeType).toLowerCase();
      const description = (graphNodeDescriptions[nodeType] ?? "").toLowerCase();
      return label.includes(normalizedQuery) || description.includes(normalizedQuery);
    });
  }, [activeCategory, activeSubCategory, matchingGroups, nodeOptions, normalizedQuery]);

  function resetPalette() {
    setQuery("");
    setActiveCategory("All");
    setActiveSubCategory("All");
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
            {["All", ...mainCategories].map((label) => (
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
                  setActiveSubCategory("All");
                  setQuery("");
                }}
              >
                {label}
              </Button>
            ))}
          </div>

          <div className="flex flex-col gap-3 min-h-0 w-full">
            {!normalizedQuery && subCategories.length > 0 ? (
              <SegmentedControl
                ariaLabel="Subcategories"
                value={activeSubCategory}
                onValueChange={setActiveSubCategory}
                options={[
                  { label: "All", value: "All" },
                  ...subCategories.map((subcat) => ({
                    label: subcat,
                    value: subcat,
                  })),
                ]}
              />
            ) : null}

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
        </div>
      </DialogContent>
    </Dialog>
  );
}

type NodeContextMenuProps = {
  node: GraphNode | null;
  calledSubflowName?: string | null;
  x: number;
  y: number;
  onClose: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onHelp: () => void;
  onOpenSubflowDetail?: () => void;
  onDelete: () => void;
};

export function NodeContextMenu({
  node,
  calledSubflowName = null,
  x,
  y,
  onClose,
  onCopy,
  onDuplicate,
  onHelp,
  onOpenSubflowDetail,
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
      {onOpenSubflowDetail ? (
        <button
          type="button"
          role="menuitem"
          aria-label={`Open subflow ${calledSubflowName ?? node.label}`}
          onClick={onOpenSubflowDetail}
        >
          Open subflow
        </button>
      ) : null}
      <button type="button" role="menuitem" onClick={onDuplicate}>
        Duplicate
      </button>
      <button type="button" role="menuitem" onClick={onCopy}>
        Copy
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

        <SegmentedControl
          ariaLabel="Help language"
          className="help-language-switch"
          value={language}
          options={[
            { value: "vi", label: "Tiếng Việt" },
            { value: "en", label: "English" },
          ]}
          onValueChange={onLanguageChange}
        />

        {content ? (
          <ScrollArea className="step-help-body">
            <div
              className="step-help-body"
              style={{ overflow: "visible", paddingRight: 0 }}
            >
              <HelpSection
                defaultOpen
                title={language === "vi" ? "Node này làm gì" : "What this does"}
              >
                <p>{content.summary}</p>
              </HelpSection>

              <HelpSection
                defaultOpen
                title={language === "vi" ? "Dùng khi" : "Use it when"}
              >
                <ul>
                  {content.useWhen.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </HelpSection>

              {content.notFor?.length ? (
                <HelpSection title={language === "vi" ? "Dùng cái khác khi" : "Use something else when"}>
                  <ul>
                    {content.notFor.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </HelpSection>
              ) : null}

              {content.portSemantics?.length ? (
                <HelpSection
                  defaultOpen
                  title={language === "vi" ? "Port và luồng chạy" : "Ports and flow"}
                >
                  <div className="help-field-list">
                    {content.portSemantics.map((port) => (
                      <HelpLeafItem key={port.port} title={port.port}>
                        <p>{port.description}</p>
                        <ul className="help-field-details">
                          <li>{port.kind}</li>
                          <li>{port.required ? "required" : "optional"}</li>
                        </ul>
                      </HelpLeafItem>
                    ))}
                  </div>
                </HelpSection>
              ) : null}

              <HelpSection
                defaultOpen
                title={language === "vi" ? "Cấu hình tối thiểu" : "Minimum setup"}
              >
                <HelpFieldList fields={content.minimalConfig ?? content.fields} />
              </HelpSection>

              {content.fieldReference?.length ? (
                <HelpSection title={language === "vi" ? "Tất cả field và option" : "All fields and options"}>
                  <GraphFieldReferenceGroups fields={content.fieldReference} language={language} />
                </HelpSection>
              ) : null}

              <HelpSection title={language === "vi" ? "Ví dụ workflow" : "Workflow examples"}>
                <div className="help-field-list">
                  {(content.workflowExamples ?? [
                    { title: language === "vi" ? "Ví dụ" : "Example", steps: content.examples },
                  ]).map((example) => (
                    <HelpLeafItem key={example.title} title={example.title}>
                      <ul className="help-field-details">
                        {example.steps.map((step) => (
                          <li key={step}>{step}</li>
                        ))}
                      </ul>
                    </HelpLeafItem>
                  ))}
                </div>
              </HelpSection>

              {content.relatedNodes?.length ? (
                <HelpSection title={language === "vi" ? "Node liên quan" : "Related nodes"}>
                  <div className="help-field-list">
                    {content.relatedNodes.map((related) => (
                      <HelpLeafItem
                        key={`${related.node}-${related.relationship}`}
                        title={related.node}
                      >
                        <p>{related.relationship}</p>
                      </HelpLeafItem>
                    ))}
                  </div>
                </HelpSection>
              ) : null}

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
  return actionType && allActionOptions.includes(actionType as ActionType)
    ? (actionType as ActionType)
    : null;
}

function HelpSection({
  children,
  defaultOpen = false,
  title,
}: {
  children: ReactNode;
  defaultOpen?: boolean;
  title: string;
}) {
  return (
    <HelpDisclosure
      className="help-section"
      defaultOpen={defaultOpen}
      title={title}
    >
      {children}
    </HelpDisclosure>
  );
}

function HelpFieldList({
  fields,
}: {
  fields: Array<{
    name: string;
    description: string;
    details?: string[];
  }>;
}) {
  return (
    <div className="help-field-list">
      {fields.map((field) => (
        <HelpLeafItem key={field.name} title={field.name}>
          <p>{field.description}</p>
          {field.details?.length ? (
            <ul className="help-field-details">
              {field.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          ) : null}
        </HelpLeafItem>
      ))}
    </div>
  );
}

function HelpLeafItem({
  children,
  className = "",
  title,
}: {
  children: ReactNode;
  className?: string;
  title: ReactNode;
}) {
  return (
    <HelpDisclosure
      className={["help-field-item", "help-field-leaf", className]
        .filter(Boolean)
        .join(" ")}
      summaryClassName="help-field-leaf-summary"
      title={title}
    >
      {children}
    </HelpDisclosure>
  );
}

function GraphFieldReferenceGroups({
  fields,
  language,
}: {
  fields: GraphNodeFieldReference[];
  language: GraphNodeHelpLanguage;
}) {
  const groupOrder: HelpFieldCategory[] = ["required", "optional", "advanced"];
  const labels: Record<HelpFieldCategory, string> = {
    required: language === "vi" ? "Bắt buộc" : "Required",
    optional: language === "vi" ? "Tùy chọn" : "Optional",
    advanced: language === "vi" ? "Nâng cao" : "Advanced",
  };

  return (
    <div className="help-field-groups">
      {groupOrder.map((category) => {
        const groupFields = fields.filter((field) => field.category === category);
        if (!groupFields.length) return null;
        return (
          <details
            className="help-field-group"
            key={category}
            open={category === "required"}
          >
            <summary className="help-field-group-summary">
              <h4>{labels[category]}</h4>
            </summary>
            <div className="help-field-list">
              {groupFields.map((field) => (
                <HelpLeafItem
                  className="help-field-reference"
                  key={field.name}
                  title={(
                    <span className="help-field-title-row">
                    <strong>{field.name}</strong>
                    <span className={`help-field-badge help-field-badge-${field.category}`}>
                      {field.category}
                    </span>
                    </span>
                  )}
                >
                  <p>{field.description}</p>
                  <ul className="help-field-details">
                    <li>{field.requiredWhen}</li>
                    {field.valueGuidance ? <li>{field.valueGuidance}</li> : null}
                    {field.example ? <li>{field.example}</li> : null}
                    {field.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                    {field.mistakes?.map((mistake) => (
                      <li key={mistake}>{mistake}</li>
                    ))}
                  </ul>
                  {field.options?.length ? (
                    <div className="help-option-list">
                      {field.options.map((option) => (
                        <HelpDisclosure
                          className="help-option-item help-option-disclosure"
                          key={`${field.name}-${option.label}`}
                          summaryClassName="help-option-summary"
                          title={(
                            <strong>
                            {option.label}
                            {option.value ? <span>{option.value}</span> : null}
                            </strong>
                          )}
                        >
                          <p>{option.description}</p>
                          <ul className="help-field-details">
                            <li>
                              <span className="help-option-label">Use when</span>
                              {option.useWhen}
                            </li>
                            {option.avoidWhen ? (
                              <li>
                                <span className="help-option-label">Avoid when</span>
                                {option.avoidWhen}
                              </li>
                            ) : null}
                          </ul>
                        </HelpDisclosure>
                      ))}
                    </div>
                  ) : null}
                </HelpLeafItem>
              ))}
            </div>
          </details>
        );
      })}
    </div>
  );
}

type ActionNodePaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectAction: (actionType: ActionType) => void;
};

const hiddenActionPickerTypes = new Set<ActionType>([
  "graph_noop",
  "if_condition",
  "router_condition",
  "random_choice",
  "repeat_times",
  "repeat_for_each",
  "retry_block",
  "switch_condition",
  "while_loop",
  "repeat_until",
  "try_catch",
  "fallback_block",
  "break_loop",
  "continue_loop",
  "stop_workflow",
  "set_variable",
  "set_json_variables",
  "transform_variable",
  "update_number_variable",
  "update_text_variable",
  "set_boolean_variable",
  "generate_random_boolean",
  "parse_to_boolean",
  "boolean_logical_op",
  "compare_booleans",
  "check_boolean_property",
  "update_list_variable",
  "create_empty_object",
  "create_object_manual",
  "parse_json_to_object",
  "set_object_property",
  "remove_object_property",
  "merge_objects",
  "rename_object_property",
  "get_object_property",
  "get_object_keys",
  "get_object_values",
  "stringify_object",
  "execute_object_script",
  "check_object_key_exists",
  "check_object_empty",
  "assert_output",
  "domain_allowlist",
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
  random_wait: "Pause for a random duration",
  input_text: "Fill a field",
  clear_input: "Clear a field",
  click: "Click an element",
  find_element: "Resolve an element for later actions",
  scroll: "Move the page or an element",
  select_option: "Choose a native select option",
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
  count_elements: "Count matching elements on the page",
  extract_regex_matches: "Extract pattern matches from an output",
  take_screenshot: "Save visual evidence",
  write_text_file: "Save output text as a run artifact",
  go_back: "Go back in history",
  go_forward: "Go forward in history",
  reload: "Reload the page",
  open_new_tab: "Open a browser tab",
  switch_tab: "Change the active tab",
  close_tab: "Close a browser tab",
  accept_dialog: "Accept a browser dialog",
  dismiss_dialog: "Dismiss a browser dialog",
  wait_for_download: "Wait for a download",
  set_variable: "Store workflow values",
  set_json_variables: "Store JSON values",
  check_conditions: "Check Conditions",
  calculate_value: "Evaluate expression",
  update_number_variable: "Update a number variable",
  set_number_variable: "Set a number variable",
  generate_random_number: "Generate a random number",
  parse_text_to_number: "Convert text to a number",
  math_operation: "Perform math operation",
  round_number: "Round or format number",
  format_number: "Format number to text",
  compare_numbers: "Compare two numbers",
  check_number_range: "Check number in range",
  check_number_property: "Check number property",
  update_text_variable: "Update a text variable",
  set_text_variable: "Set a text variable",
  append_text: "Append text to variable",
  prepend_text: "Prepend text to variable",
  replace_text: "Replace text pattern in variable",
  trim_text: "Trim whitespace from text variable",
  change_text_case: "Change case mode of text variable",
  slice_text: "Slice text variable by index",
  regex_extract: "Extract text using regular expressions",
  get_text_length: "Get length of text variable",
  check_text_empty: "Check if text variable is empty",
  check_text_contains: "Check if text variable contains substring",
  check_text_regex_matches: "Check if text variable matches regular expression",
  update_flag_variable: "Update a flag variable",
  set_boolean_variable: "Set a boolean variable directly",
  generate_random_boolean: "Generate random boolean",
  parse_to_boolean: "Convert value to boolean",
  boolean_logical_op: "Logical operation",
  compare_booleans: "Compare booleans",
  check_boolean_property: "Check boolean property",
  update_list_variable: "Update a list variable",
  create_empty_list: "Create an empty list",
  create_list_manual: "Create list manually",
  split_text_to_list: "Split text into list",
  generate_number_range: "Generate a range of numbers",
  add_to_list: "Add value to a list",
  remove_from_list_by_index: "Remove from list by index",
  remove_from_list_by_value: "Remove from list by value",
  merge_lists: "Merge two lists",
  get_list_item: "Get list item",
  get_list_length: "Get list length",
  slice_list: "Get a section of a list",
  join_list: "Join list into text",
  filter_list: "Filter list by conditions",
  map_list_property: "Extract property from list items",
  sort_reverse_list: "Sort or reverse list",
  execute_list_script: "Run JavaScript on list",
  check_list_empty: "Check if list is empty",
  check_list_contains: "Check if list contains value",
  check_list_any_match: "Check if any list item matches condition",
  check_list_all_match: "Check if all list items match condition",
  create_empty_object: "Create an empty object",
  create_object_manual: "Create object manually",
  parse_json_to_object: "Parse JSON into object",
  set_object_property: "Set object property",
  remove_object_property: "Remove object property",
  merge_objects: "Merge two objects",
  rename_object_property: "Rename object property",
  get_object_property: "Get object property value",
  get_object_keys: "Get object keys",
  get_object_values: "Get object values",
  stringify_object: "Stringify object to JSON",
  execute_object_script: "Run JavaScript on object",
  check_object_key_exists: "Check key exists in object",
  check_object_empty: "Check if object is empty",
  assert_element: "Require an element state",
  assert_text: "Require matching text",
  graph_noop: "Mark graph control flow progress",
  if_condition: "Run steps conditionally",
  router_condition: "Run the first matching router case",
  random_choice: "Choose one weighted branch",
  repeat_times: "Repeat nested steps",
  repeat_for_each: "Repeat for each item",
  retry_block: "Retry a group of steps",
  switch_condition: "Choose a branch by value",
  while_loop: "Repeat while a condition is true",
  repeat_until: "Repeat until a condition is true",
  try_catch: "Handle errors with recovery branches",
  fallback_block: "Run fallback steps after a primary failure",
  break_loop: "Exit the current loop",
  continue_loop: "Continue the current loop",
  stop_workflow: "Stop execution",
  transform_variable: "Map one variable to another",
  assert_output: "Require an output value",
  domain_allowlist: "Restrict allowed domains",
  set_cookie: "Set a browser cookie",
  clear_cookies: "Clear browser cookies",
  set_viewport: "Set viewport size",
  set_geolocation: "Set location data",
  set_extra_headers: "Attach request headers",
  grant_permission: "Grant browser permission",
  execute_js: "Run JavaScript",
  wait_for_request: "Wait for a request",
  wait_for_response: "Wait for a response",
  block_request: "Block matching requests",
  mock_response: "Mock a response",
  set_local_storage: "Set local storage",
  set_session_storage: "Set session storage",
  get_current_url: "Capture current page URL and components",
  read_text_file: "Read a local text file",
  parse_csv_excel: "Parse a CSV/Excel file",
  write_csv_excel: "Write data to a CSV/Excel file",
  file_operation: "Perform filesystem operations",
  http_request: "Perform an HTTP request",
  date_time_operation: "Manipulate dates and times",
  crypto_operation: "Perform cryptography hashing or Base64",
  switch_frame: "Switch context to an iframe",
  switch_to_parent_frame: "Switch context back to parent document",
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
