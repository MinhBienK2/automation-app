import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ActionType } from "../../../types/workflow";
import { Button } from "../../../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../../../components/ui/dialog";
import { Input } from "../../../components/ui/input";
import {
  actionGroups,
  actionLabels,
} from "../../../lib/workflowUi";

export type ActionNodePaletteProps = {
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
  "extract_text",
  "extract_attribute",
  "extract_input_value",
  "extract_table",
  "extract_list",
  "count_elements",
  "extract_regex_matches",
  "get_current_url",
  "extract_text_content",
  "extract_inner_html",
  "extract_outer_html",
  "extract_computed_style",
  "extract_all_attributes",
  "extract_data_attributes",
  "extract_class_list",
  "extract_descendant_attributes",
  "extract_select_value",
  "extract_select_options",
  "extract_checkbox_state",
  "extract_form_data",
  "extract_table_headers",
  "extract_table_row",
  "extract_table_column",
  "extract_table_cell",
  "extract_list_attributes",
  "extract_structured_list",
  "extract_dimensions",
  "extract_visibility",
  "extract_element_state",
  "check_element_exists",
  "get_page_title",
  "get_meta_content",
  "extract_page_links",
  "extract_numbers",
  "extract_urls",
  "extract_emails",
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
  open_link_in_new_tab: "Open a targeted link or element in a new tab",
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
  extract_text_content: "Capture text content including hidden text",
  extract_inner_html: "Capture inner HTML markup of an element",
  extract_outer_html: "Capture outer HTML markup of an element",
  extract_computed_style: "Capture calculated CSS style value",
  extract_all_attributes: "Capture all attributes of an element",
  extract_data_attributes: "Capture all data attributes",
  extract_class_list: "Capture list of CSS classes",
  extract_descendant_attributes: "Capture attributes of element and descendants",
  extract_select_value: "Capture selected option of a dropdown",
  extract_select_options: "Capture all options of a dropdown",
  extract_checkbox_state: "Capture checked state of a checkbox",
  extract_form_data: "Capture all inputs inside a form",
  extract_table_headers: "Capture column headers of a table",
  extract_table_row: "Capture a specific row from a table",
  extract_table_column: "Capture a specific column from a table",
  extract_table_cell: "Capture a specific cell from a table",
  extract_list_attributes: "Capture attribute from multiple elements",
  extract_structured_list: "Capture structured data from repeating containers",
  extract_dimensions: "Capture element position and size",
  extract_visibility: "Check if element is visible and in viewport",
  extract_element_state: "Check if element is disabled, editable, etc",
  check_element_exists: "Check if element selector exists on the page",
  get_page_title: "Capture page title",
  get_meta_content: "Capture page meta content attribute",
  extract_page_links: "Capture all link elements on the page",
  extract_numbers: "Extract all numbers from a text output",
  extract_urls: "Extract all URLs from a text output",
  extract_emails: "Extract all emails from a text output",
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
      <DialogContent className="add-step-palette max-w-none">
        <DialogHeader>
          <p className="eyebrow">Add Action Node</p>
          <DialogTitle>Choose an action type</DialogTitle>
          <DialogDescription>
            Search or browse categories, then choose an action to add it to the graph.
          </DialogDescription>
        </DialogHeader>

        <div className="palette-search">
          <Search aria-hidden="true" />
          <Input
            aria-label="Search actions"
            placeholder="Search actions..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>

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
