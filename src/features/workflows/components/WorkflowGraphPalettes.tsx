import { useMemo, useState } from "react";
import type { GraphNodeType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import { SegmentedControl } from "../../../components/ui/segmented-control";
import { graphNodeLabel } from "../lib/workflowGraph";

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

