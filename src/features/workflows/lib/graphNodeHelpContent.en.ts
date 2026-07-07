import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const englishGraphNodeHelpContent: Record<GraphNodeType, GraphNodeHelpContent> = {
  start: {
    title: "Start Help",
    summary: "Start the workflow graph.",
    useWhen: ["Use as a clear navigation point in the graph."],
    fields: [
      {
        name: "Ports",
        description: "This node is mainly configured by connecting named ports on the canvas.",
        details: [
          "Input ports receive execution from previous nodes.",
          "Output ports decide where the workflow continues.",
          "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
        ],
      },
    ],
    examples: ["Start: connect ports to route flow."],
    commonMistakes: ["Deleting or disconnecting key nodes can make graph paths unreachable."],
  },
  end_success: {
    title: "Success End Help",
    summary: "End the workflow successfully.",
    useWhen: ["Use as a clear navigation point in the graph."],
    fields: [
      {
        name: "Ports",
        description: "This node is mainly configured by connecting named ports on the canvas.",
        details: [
          "Input ports receive execution from previous nodes.",
          "Output ports decide where the workflow continues.",
          "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
        ],
      },
    ],
    examples: ["Success End: connect ports to route flow."],
    commonMistakes: ["Deleting or disconnecting key nodes can make graph paths unreachable."],
  },
  end_failure: {
    title: "End Failure Help",
    summary: "End the workflow with a failure status and a clear reason.",
    useWhen: ["Use for intentional error paths.", "Use when the graph detects a condition that should stop execution."],
    fields: [
      {
        name: "Failure reason",
        description: "Failure message shown when the workflow ends here.",
        details: ["Keep it short but specific enough to identify the failed branch.", "This reason becomes part of the failed run state."],
      },
    ],
    examples: ["Failure reason: Login failed after retry"],
    commonMistakes: ["Not connecting the error branch to this node, so the failure end is never reached."],
  },
  action: {
    title: "Action Node Help",
    summary: "Run one concrete action. After choosing Action type, this popup uses that action's detailed help.",
    useWhen: ["Use for browser, data, session, network, reliability, or advanced actions."],
    fields: [
      {
        name: "Action type",
        description: "The action type that this node runs.",
        details: ["Choose an action type before running.", "Changing the action type resets config to the new type's defaults."],
      },
    ],
    examples: ["Action type: Click, XPath: //*[@type='submit']"],
    commonMistakes: ["Leaving a New node unconfigured; the graph can be saved but validate/run will be blocked."],
  },
  call_subflow: {
    title: "Call Subflow Help",
    summary: "Run a same-project subflow in the same browser context and output store.",
    useWhen: ["Use for reusable graph paths such as login or account-state setup."],
    fields: [
      {
        name: "Subflow id",
        description: "Same-project subflow to call.",
        details: [
          "A deleted or cross-project subflow blocks validate/run.",
          "Subflow graphs cannot contain Call Subflow nodes in the MVP.",
        ],
      },
      {
        name: "Input mapping",
        description: "input_name=value lines passed to the subflow before it runs.",
        details: [
          "Each line maps one input.",
          "Values may use output templates like other text fields.",
        ],
      },
      {
        name: "Output prefix",
        description: "Optional prefix for outputs created by the subflow.",
        details: [
          "Use it when calling the same subflow more than once and outputs need separation.",
        ],
      },
    ],
    examples: ["Subflow id: subflow-login", "Input mapping: email={{account.email}}"],
    commonMistakes: ["Calling a subflow from another project.", "Leaving Subflow id empty before validate/run."],
  },
  merge: {
    title: "Merge Help",
    summary: "Let multiple branches return to one shared path without waiting for other branches.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Ports",
        description: "Connect many branches to In and one continuation from Out.",
        details: [
          "Merge does not run a browser action.",
          "The branch that reaches Merge continues through Out; when Out is blank, that path ends successfully.",
        ],
      },
    ],
    examples: ["Merge: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  router: {
    title: "Router Help",
    summary: "Choose the first matching case from a prioritized decision table.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Condition",
        description: "Condition used to choose a branch or loop state.",
        details: [
          "Output equals/contains checks an output created earlier.",
          "Text visible, URL contains, and Element visible inspect the current page.",
          "When using output-based conditions, make sure the output is created before this node.",
        ],
      },
      {
        name: "Done port",
        description: "Continuation after the selected branch finishes.",
        details: [
          "Done is optional; when blank, the workflow ends successfully after Router.",
        ],
      },
    ],
    examples: ["Router: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  random_choice: {
    title: "Random Choice Help",
    summary: "Choose one branch at runtime using configured weights.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Choices",
        description: "List of branches with labels and weights.",
        details: [
          "Higher weight means the branch is more likely to be selected.",
          "An unconnected branch no-ops if it is selected.",
        ],
      },
      {
        name: "Output name",
        description: "Output that stores the selected choice id.",
        details: [
          "Use this output for audit or later Switch/Router decisions.",
          "Done runs after the selected branch finishes.",
        ],
      },
    ],
    examples: ["Random Choice: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  if: {
    title: "If Help",
    summary: "Branch the workflow into True or False paths based on a condition.",
    useWhen: ["Use when the workflow must choose a path from output, text, URL, or element state."],
    fields: [
      {
        name: "Condition",
        description: "Condition used to choose a branch or loop state.",
        details: [
          "Output equals/contains checks an output created earlier.",
          "Text visible, URL contains, and Element visible inspect the current page.",
          "When using output-based conditions, make sure the output is created before this node.",
        ],
      },
      {
        name: "True port",
        description: "Path that runs when the condition is true.",
        details: ["True branch is optional; missing link will no-op.", "Connect actions that should run when the condition matches."],
      },
      {
        name: "False port",
        description: "Path that runs when the condition is false.",
        details: ["False branch is optional; missing link will no-op.", "Use for fallback, error handling, or alternate work."],
      },
      {
        name: "Done port",
        description: "Continuation after True/False branch work completes.",
        details: ["Done continuation is optional; workflow ends successfully here.", "Connect this when both branches should return to the main flow."],
      },
    ],
    examples: ["Condition: Output equals logged_in = true; True -> dashboard actions; False -> login actions; Done -> extract result"],
    commonMistakes: ["Connecting main-flow work to True/False instead of Done.", "Checking an output that has not been created yet."],
  },
  switch: {
    title: "Switch Help",
    summary: "Route execution to one case branch from an expression.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Switch expression",
        description: "Value or output name compared against cases.",
        details: ["Usually an output created earlier."],
      },
      {
        name: "Switch cases",
        description: "Each line becomes a case output port.",
        details: ["Default runs when no case matches.", "Done continues after case branch work completes."],
      },
    ],
    examples: ["Switch: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  repeat_times: {
    title: "Repeat Times Help",
    summary: "Repeat the body a fixed number of times.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Times",
        description: "How many times to run the body.",
        details: ["Must be greater than 0.", "Body is repeated; Done runs after the loop finishes."],
      },
    ],
    examples: ["Repeat Times: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  repeat_for_each: {
    title: "Repeat For Each Help",
    summary: "Repeat the body once for each item.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Item name",
        description: "Variable name for the current item.",
        details: ["Use a clear name such as product, row, or email."],
      },
      {
        name: "Items",
        description: "Item list, one value per line.",
        details: ["Body runs once per non-empty line.", "Done runs after the final item."],
      },
    ],
    examples: ["Repeat For Each: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  repeat_until: {
    title: "Repeat Until Help",
    summary: "Repeat until the condition becomes true or a limit is reached.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Condition",
        description: "Condition used to choose a branch or loop state.",
        details: [
          "Output equals/contains checks an output created earlier.",
          "Text visible, URL contains, and Element visible inspect the current page.",
          "When using output-based conditions, make sure the output is created before this node.",
        ],
      },
      {
        name: "Loop max attempts",
        description: "Maximum loop iterations to avoid infinite loops.",
        details: ["Must be greater than 0.", "Increase only as much as real data needs."],
      },
      {
        name: "Loop timeout ms",
        description: "Maximum time for the loop.",
        details: ["0 or blank means no separate timeout when supported.", "Body is repeated; Done runs after the loop."],
      },
    ],
    examples: ["Repeat Until: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  while: {
    title: "While Help",
    summary: "Repeat while the condition stays true.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Condition",
        description: "Condition used to choose a branch or loop state.",
        details: [
          "Output equals/contains checks an output created earlier.",
          "Text visible, URL contains, and Element visible inspect the current page.",
          "When using output-based conditions, make sure the output is created before this node.",
        ],
      },
      {
        name: "Loop max attempts",
        description: "Maximum loop iterations to avoid infinite loops.",
        details: ["Must be greater than 0.", "Increase only as much as real data needs."],
      },
      {
        name: "Loop timeout ms",
        description: "Maximum time for the loop.",
        details: ["0 or blank means no separate timeout when supported.", "Body is repeated; Done runs after the loop."],
      },
    ],
    examples: ["While: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  retry: {
    title: "Retry Help",
    summary: "Retry the Try branch when it fails.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Max attempts",
        description: "Maximum number of attempts.",
        details: ["Try port is required before run.", "Success runs when Try succeeds."],
      },
      {
        name: "Delay ms",
        description: "Delay between retry attempts.",
        details: ["Failed is optional; if missing and attempts are exhausted, the workflow fails."],
      },
    ],
    examples: ["Retry: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  try_catch: {
    title: "Try Catch Help",
    summary: "Separate normal work, errors, and cleanup.",
    useWhen: ["Use when control flow needs this behavior."],
    fields: [
      {
        name: "Ports",
        description: "This node is mainly configured by connecting named ports on the canvas.",
        details: [
          "Input ports receive execution from previous nodes.",
          "Output ports decide where the workflow continues.",
          "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
        ],
      },
    ],
    examples: ["Try Catch: connect the named ports on the canvas."],
    commonMistakes: ["Placing a node outside a valid context, such as break/continue outside a loop body."],
  },
  fallback: {
    title: "Fallback Help",
    summary: "Try primary work first, then fallback if needed.",
    useWhen: ["Use when control flow needs this behavior."],
    fields: [
      {
        name: "Ports",
        description: "This node is mainly configured by connecting named ports on the canvas.",
        details: [
          "Input ports receive execution from previous nodes.",
          "Output ports decide where the workflow continues.",
          "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
        ],
      },
    ],
    examples: ["Fallback: connect the named ports on the canvas."],
    commonMistakes: ["Placing a node outside a valid context, such as break/continue outside a loop body."],
  },
  break_loop: {
    title: "Break Loop Help",
    summary: "Exit the current loop.",
    useWhen: ["Use when control flow needs this behavior."],
    fields: [
      {
        name: "Ports",
        description: "This node is mainly configured by connecting named ports on the canvas.",
        details: [
          "Input ports receive execution from previous nodes.",
          "Output ports decide where the workflow continues.",
          "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
        ],
      },
    ],
    examples: ["Break Loop: connect the named ports on the canvas."],
    commonMistakes: ["Placing a node outside a valid context, such as break/continue outside a loop body."],
  },
  continue_loop: {
    title: "Continue Loop Help",
    summary: "Skip to the next loop iteration.",
    useWhen: ["Use when control flow needs this behavior."],
    fields: [
      {
        name: "Ports",
        description: "This node is mainly configured by connecting named ports on the canvas.",
        details: [
          "Input ports receive execution from previous nodes.",
          "Output ports decide where the workflow continues.",
          "Missing required ports block validate/run; missing optional ports no-op or end the path successfully.",
        ],
      },
    ],
    examples: ["Continue Loop: connect the named ports on the canvas."],
    commonMistakes: ["Placing a node outside a valid context, such as break/continue outside a loop body."],
  },
  stop_workflow: {
    title: "Stop Workflow Help",
    summary: "Stop the workflow intentionally as success or failure.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Status",
        description: "Final status: Success or Failure.",
        details: ["Success ends normally; Failure marks the run failed."],
      },
      {
        name: "Reason",
        description: "Reason for stopping.",
        details: ["Keep it clear so users understand why the flow stopped."],
      },
    ],
    examples: ["Stop Workflow: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  set_variable: {
    title: "Set Variables Help",
    summary: "Store multiple values for later nodes.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Rows",
        description: "Each row has Name, Type, and Value.",
        details: ["Type distinguishes text, JSON, number, and boolean."],
      },
      {
        name: "Name",
        description: "Variable name or dot path to store.",
        details: ["Use user.name for a clear path variable."],
      },
    ],
    examples: ["Set Variables: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  set_json_variables: {
    title: "Set JSON Variables Help",
    summary: "Store variables from a JSON object.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "JSON variables",
        description: "The JSON root must be an object.",
        details: ["Nested objects flatten into dot paths; arrays stay whole."],
      },
    ],
    examples: ["Set JSON Variables: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  check_conditions: {
    title: "Check Conditions Help",
    summary: "Evaluate visual rules or JS expression and store the boolean result.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "The name of the variable to store the output.",
        details: ["Saves the result as a boolean true or false."],
      },
      {
        name: "Evaluation Mode",
        description: "Choose between visual rules builder or JS script.",
        details: ["JS script evaluates in the browser context with outputs available.", "Use {{name}} to insert variables (resolved before execution), or outputs.name for direct access."],
      },
    ],
    examples: ["Check Conditions: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  calculate_value: {
    title: "Calculate Value Help",
    summary: "Evaluate a JavaScript/Math expression and store the raw result (number, string, etc.).",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "The name of the variable to store the output.",
        details: ["Saves the result as its actual evaluated type."],
      },
      {
        name: "JavaScript / Math Expression",
        description: "The expression to evaluate.",
        details: ["Evaluates in the browser context with outputs available.", "Use {{name}} to insert variables, or outputs.name for direct access."],
      },
    ],
    examples: ["Calculate Value: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  update_number_variable: {
    title: "Update Number Variable Help",
    summary: "Perform math operations (add, subtract, multiply, divide, increment, decrement) on a number variable.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      { name: "Variable name", description: "Name of the number variable to update.", details: [] },
      { name: "Operation", description: "The math operation to perform.", details: [] },
      { name: "Value", description: "The operand value (for add, subtract, multiply, divide).", details: [] },
    ],
    examples: ["Update Number Variable: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  update_text_variable: {
    title: "Update Text Variable Help",
    summary: "Perform string operations (append, prepend, replace, uppercase, lowercase, trim) on a text variable.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to update.", details: [] },
      { name: "Operation", description: "The string operation to perform.", details: [] },
      { name: "Search pattern", description: "The search pattern (string or regex) for replace operation.", details: [] },
      { name: "Value", description: "The value to append, prepend, or replace with.", details: [] },
    ],
    examples: ["Update Text Variable: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  update_flag_variable: {
    title: "Update Flag Variable Help",
    summary: "Update boolean flag variable (toggle, set_true, set_false).",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      { name: "Variable name", description: "Name of the flag variable to update.", details: [] },
      { name: "Operation", description: "The boolean operation to perform.", details: [] },
    ],
    examples: ["Update Flag Variable: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  update_list_variable: {
    title: "Update List Variable Help",
    summary: "Perform array operations (push, unshift, push_unique, pop, shift, remove_by_index, remove_by_value, merge, merge_unique) on a list variable.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      { name: "Variable name", description: "Name of the list variable to update.", details: [] },
      { name: "Operation", description: "The array operation to perform.", details: [] },
      { name: "Value type", description: "The data type of the new element.", details: [] },
      { name: "Value", description: "The element value to add or remove.", details: [] },
      { name: "Index", description: "The 0-based index to remove (for remove_by_index).", details: [] },
    ],
    examples: ["Update List Variable: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  create_empty_list: {
    title: "Create Empty List Help",
    summary: "Initialize an empty list variable.",
    useWhen: ["Initialize a clean array variable before performing other list operations."],
    fields: [
      { name: "Output variable name", description: "Name of the empty list variable to create.", details: [] },
    ],
    examples: ["Create Empty List: configure output name in the inspector."],
    commonMistakes: ["Leaving the output variable name blank."],
  },
  create_list_manual: {
    title: "Create List Manual Help",
    summary: "Initialize a list with manual items.",
    useWhen: ["Initialize an array with a pre-configured set of static values."],
    fields: [
      { name: "Output variable name", description: "Name of the list variable to create.", details: [] },
      { name: "Item value type", description: "The type of the items in the list.", details: [] },
      { name: "List items", description: "The static items to put in the list (one per line).", details: [] },
    ],
    examples: ["Create List Manual: configure items in the inspector."],
    commonMistakes: ["Leaving the items input empty."],
  },
  split_text_to_list: {
    title: "Split Text to List Help",
    summary: "Split text into a list using a delimiter.",
    useWhen: ["Converting a comma-separated string or other delimited text into an array."],
    fields: [
      { name: "Output variable name", description: "Name of the list variable to create.", details: [] },
      { name: "Source text to split", description: "The text content to split into list.", details: [] },
      { name: "Delimiter", description: "The character to split the text by.", details: [] },
    ],
    examples: ["Split Text to List: configure source text and delimiter."],
    commonMistakes: ["Using a delimiter that does not match the source text format."],
  },
  generate_number_range: {
    title: "Generate Number Range Help",
    summary: "Generate a list of numbers from start to end.",
    useWhen: ["Creating a sequence of numbers for loops or page offsets."],
    fields: [
      { name: "Output variable name", description: "Name of the list variable to create.", details: [] },
      { name: "Start value", description: "The starting number.", details: [] },
      { name: "End value", description: "The ending number (inclusive).", details: [] },
      { name: "Step size", description: "The number increment step size.", details: [] },
    ],
    examples: ["Generate Number Range: configure range start and end."],
    commonMistakes: ["Setting an infinite step size or wrong direction."],
  },
  add_to_list: {
    title: "Add to List Help",
    summary: "Add a value to the start, end, or uniquely to a list.",
    useWhen: ["Adding items dynamically during execution."],
    fields: [
      { name: "Target list variable name", description: "Name of the list to add to.", details: [] },
      { name: "Add position", description: "Where to add the item in the list.", details: [] },
      { name: "Value type", description: "Type of the value to add.", details: [] },
      { name: "Value to add", description: "The value to insert.", details: [] },
    ],
    examples: ["Add to List: configure list name and value."],
    commonMistakes: ["Adding to a variable that is not a list."],
  },
  remove_from_list_by_index: {
    title: "Remove from List by Index Help",
    summary: "Remove an item from a list by index.",
    useWhen: ["Removing an item at a specific position."],
    fields: [
      { name: "Target list variable name", description: "Name of the list to modify.", details: [] },
      { name: "Index", description: "The 0-based position to remove.", details: [] },
    ],
    examples: ["Remove from List by Index: configure list name and index."],
    commonMistakes: ["Providing an out-of-bounds index."],
  },
  remove_from_list_by_value: {
    title: "Remove from List by Value Help",
    summary: "Remove items from a list matching a value.",
    useWhen: ["Removing specific matching elements from a list."],
    fields: [
      { name: "Target list variable name", description: "Name of the list to modify.", details: [] },
      { name: "Value type", description: "Type of the value to remove.", details: [] },
      { name: "Value to match for removal", description: "The value to filter out.", details: [] },
    ],
    examples: ["Remove from List by Value: configure value to remove."],
    commonMistakes: ["Mismatching the type of value to remove."],
  },
  merge_lists: {
    title: "Merge Lists Help",
    summary: "Merge another list or set of values into a list.",
    useWhen: ["Combining multiple arrays or appending multiple values."],
    fields: [
      { name: "Target list variable name", description: "Name of the list to merge into.", details: [] },
      { name: "List to merge", description: "The array variable or JSON array to merge.", details: [] },
      { name: "Merge unique items only", description: "Whether to avoid duplicate elements.", details: [] },
    ],
    examples: ["Merge Lists: configure lists to merge."],
    commonMistakes: ["Merging a non-list variable."],
  },
  get_list_item: {
    title: "Get List Item Help",
    summary: "Get a single item from a list by index or position.",
    useWhen: ["Extracting one specific item from a list."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Position", description: "Position of the item to get.", details: [] },
      { name: "Index", description: "Specific 0-based index to get.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the item.", details: [] },
    ],
    examples: ["Get List Item: configure source list and index."],
    commonMistakes: ["Providing an index out of list bounds."],
  },
  get_list_length: {
    title: "Get List Length Help",
    summary: "Get the number of items in a list.",
    useWhen: ["Checking list size for loops or assertions."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the length.", details: [] },
    ],
    examples: ["Get List Length: configure source list and output."],
    commonMistakes: ["Measuring length of a non-list variable."],
  },
  slice_list: {
    title: "Slice List Help",
    summary: "Get a sub-list from start to end index.",
    useWhen: ["Extracting a range of elements from an array."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Start index", description: "The beginning index of slice (inclusive).", details: [] },
      { name: "End index", description: "The ending index of slice (exclusive).", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the sub-list.", details: [] },
    ],
    examples: ["Slice List: configure start and end index."],
    commonMistakes: ["Setting start index greater than end index."],
  },
  join_list: {
    title: "Join List Help",
    summary: "Join all list items into a single text string.",
    useWhen: ["Formatting list items for output text or files."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Separator text", description: "Delimiter string to place between elements.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the string.", details: [] },
    ],
    examples: ["Join List: configure list and separator."],
    commonMistakes: ["Using on lists containing objects without first mapping."],
  },
  filter_list: {
    title: "Filter List Help",
    summary: "Filter list items based on visual rules.",
    useWhen: ["Filtering elements of an array matching specific conditions."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the filtered list.", details: [] },
      { name: "Combine operator", description: "AND or OR matching.", details: [] },
      { name: "Filter rules", description: "The list of logic rules.", details: [] },
    ],
    examples: ["Filter List: configure source list and rules."],
    commonMistakes: ["Not referencing 'item' in the logic rules."],
  },
  map_list_property: {
    title: "Map List Property Help",
    summary: "Extract a property from a list of objects.",
    useWhen: ["Transforming an array of objects into an array of their properties."],
    fields: [
      { name: "Source list", description: "Name of the source list.", details: [] },
      { name: "Property key to extract", description: "The key of the property to pull out.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store mapped list.", details: [] },
    ],
    examples: ["Map List Property: configure property key to extract."],
    commonMistakes: ["Using on arrays that do not contain objects."],
  },
  sort_reverse_list: {
    title: "Sort / Reverse List Help",
    summary: "Sort list items or reverse their order.",
    useWhen: ["Ordering items alphabetically, numerically, or reversing them."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Action", description: "Sort ascending, sort descending, or reverse.", details: [] },
      { name: "Sort key", description: "Property key to sort objects by (optional).", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store result.", details: [] },
    ],
    examples: ["Sort / Reverse List: choose sorting action."],
    commonMistakes: ["Mismatching string vs number types when sorting."],
  },
  execute_list_script: {
    title: "Execute List Script Help",
    summary: "Run custom Javascript code to process a list.",
    useWhen: ["Performing advanced transformations or mapping using code."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "JavaScript Script", description: "Code returning the result (list is bound to 'list').", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store result.", details: [] },
    ],
    examples: ["Execute List Script: write return list.filter(...) script."],
    commonMistakes: ["Forgetting to return a value from script."],
  },
  check_list_empty: {
    title: "Check List Empty Help",
    summary: "Check if a list is empty.",
    useWhen: ["Adding logic forks based on array emptyness."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the boolean result.", details: [] },
    ],
    examples: ["Check List Empty: configure source list."],
    commonMistakes: ["Checking list variable that doesn't exist."],
  },
  check_list_contains: {
    title: "Check List Contains Help",
    summary: "Check if a list contains a specific value.",
    useWhen: ["Conditional branching if an element is in the list."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Value type to check", description: "Type of the search value.", details: [] },
      { name: "Value to search for", description: "The value to find.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the boolean result.", details: [] },
    ],
    examples: ["Check List Contains: configure value to check."],
    commonMistakes: ["Mismatched search value type."],
  },
  check_list_any_match: {
    title: "Check List Any Match Help",
    summary: "Check if any list item matches a condition.",
    useWhen: ["Verifying if at least one item satisfies rules."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the boolean result.", details: [] },
      { name: "Combine operator", description: "AND or OR matching.", details: [] },
      { name: "Filter rules", description: "The list of logic rules.", details: [] },
    ],
    examples: ["Check List Any Match: configure match rules."],
    commonMistakes: ["Not referencing 'item' in comparison rules."],
  },
  check_list_all_match: {
    title: "Check List All Match Help",
    summary: "Check if all list items match a condition.",
    useWhen: ["Verifying if every single item satisfies rules."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Name of the variable to store the boolean result.", details: [] },
      { name: "Combine operator", description: "AND or OR matching.", details: [] },
      { name: "Filter rules", description: "The list of logic rules.", details: [] },
    ],
    examples: ["Check List All Match: configure match rules."],
    commonMistakes: ["Not referencing 'item' in comparison rules."],
  },
  create_empty_object: {
    title: "Create Empty Object Help",
    summary: "Initialize an empty JSON object variable.",
    useWhen: ["Initialize an object before setting properties on it in later nodes."],
    fields: [
      { name: "Output variable name", description: "Name of the object variable to create.", details: [] },
    ],
    examples: ["Create Empty Object: configure output name in the inspector."],
    commonMistakes: ["Leaving the output variable name blank."],
  },
  create_object_manual: {
    title: "Create Object (Manual) Help",
    summary: "Create a JSON object by manually defining its key-value fields.",
    useWhen: ["Creating a static JSON object structure with specific fields."],
    fields: [
      { name: "Output variable name", description: "Name of the object variable to create.", details: [] },
      { name: "Object fields list", description: "Key-value fields to populate in the object.", details: [] },
    ],
    examples: ["Create Object (Manual): configure fields in the inspector."],
    commonMistakes: ["Using duplicate property keys in the fields list."],
  },
  parse_json_to_object: {
    title: "Parse JSON to Object Help",
    summary: "Parse a JSON string into a structured JSON object variable.",
    useWhen: ["Converting a raw JSON string (e.g. from an API response or file) into an object."],
    fields: [
      { name: "JSON source text", description: "The raw JSON string to parse.", details: [] },
      { name: "Output variable name", description: "Name of the variable to store the parsed object.", details: [] },
    ],
    examples: ["Parse JSON to Object: configure source text and output variable."],
    commonMistakes: ["Providing invalid JSON text, which causes a runtime parse error."],
  },
  set_object_property: {
    title: "Set Object Property Help",
    summary: "Set a property value at a specific path (supports dot-path) in an object.",
    useWhen: ["Adding or updating a property inside an object variable."],
    fields: [
      { name: "Variable name", description: "Name of the object variable to update.", details: [] },
      { name: "Property path", description: "The key or dot-path of the property (e.g., 'user.profile.name').", details: [] },
      { name: "Value type", description: "The data type of the value to set.", details: [] },
      { name: "Value", description: "The value to assign.", details: [] },
    ],
    examples: ["Set Object Property: configure property path and value."],
    commonMistakes: ["Targeting a variable that is not a JSON object."],
  },
  remove_object_property: {
    title: "Remove Object Property Help",
    summary: "Remove a property from an object at a specific path (supports dot-path).",
    useWhen: ["Deleting or clean-up of a property from an object variable."],
    fields: [
      { name: "Variable name", description: "Name of the object variable to modify.", details: [] },
      { name: "Property path", description: "The key or dot-path to remove (e.g., 'temp_key').", details: [] },
    ],
    examples: ["Remove Object Property: configure property path to remove."],
    commonMistakes: ["Attempting to delete a property path that does not exist in the object."],
  },
  merge_objects: {
    title: "Merge Objects Help",
    summary: "Merge properties from another object or JSON string into an object variable.",
    useWhen: ["Combining multiple objects or applying a batch of properties."],
    fields: [
      { name: "Variable name", description: "Name of the object variable to update.", details: [] },
      { name: "Value to merge", description: "The object variable name or raw JSON string to merge.", details: [] },
      { name: "Deep merge", description: "Whether to recursively merge nested objects.", details: [] },
    ],
    examples: ["Merge Objects: configure target object and merge value."],
    commonMistakes: ["Merging invalid JSON string values into the target object."],
  },
  rename_object_property: {
    title: "Rename Object Property Help",
    summary: "Rename a property key path in an object variable.",
    useWhen: ["Changing the key name of a property while keeping its value."],
    fields: [
      { name: "Variable name", description: "Name of the object variable to modify.", details: [] },
      { name: "Old key path", description: "The current path of the property key to rename.", details: [] },
      { name: "New key path", description: "The new key path name.", details: [] },
    ],
    examples: ["Rename Object Property: configure old and new key paths."],
    commonMistakes: ["Targeting an old key path that does not exist in the object."],
  },
  get_object_property: {
    title: "Get Object Property Help",
    summary: "Get a property value from an object at a specific path (supports dot-path).",
    useWhen: ["Extracting a nested property value to use in later nodes."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "Property path", description: "The dot-path of the property to extract.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the extracted value.", details: [] },
    ],
    examples: ["Get Object Property: configure property path and output name."],
    commonMistakes: ["Extracting a path that resolves to undefined."],
  },
  get_object_keys: {
    title: "Get Object Keys Help",
    summary: "Get a list of top-level keys from an object.",
    useWhen: ["Extracting property keys to loop over or validate."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the keys list (array of strings).", details: [] },
    ],
    examples: ["Get Object Keys: configure source object and output variable."],
    commonMistakes: ["Running on a non-object variable."],
  },
  get_object_values: {
    title: "Get Object Values Help",
    summary: "Get a list of top-level values from an object.",
    useWhen: ["Extracting all values inside an object as an array."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the values list (array).", details: [] },
    ],
    examples: ["Get Object Values: configure source object and output variable."],
    commonMistakes: ["Running on a non-object variable."],
  },
  stringify_object: {
    title: "Stringify Object Help",
    summary: "Convert a JSON object variable into a formatted JSON string.",
    useWhen: ["Formatting an object to write to a text file or send in an HTTP body."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the formatted JSON string.", details: [] },
    ],
    examples: ["Stringify Object: configure source object and output variable."],
    commonMistakes: ["Passing a circular object reference that cannot be stringified."],
  },
  execute_object_script: {
    title: "Run Script on Object Help",
    summary: "Run a custom JavaScript script to process or transform an object.",
    useWhen: ["Performing advanced transformations or mapping on a JSON object using JavaScript code."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "JavaScript Script", description: "Custom JS script. The source object is bound to the local variable 'obj'.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the returned result.", details: [] },
    ],
    examples: ["Run Script on Object: write a return statement processing 'obj'."],
    commonMistakes: ["Forgetting to return the transformed result from the script."],
  },
  check_object_key_exists: {
    title: "Check Object Key Exists Help",
    summary: "Check if a key or dot-path exists in an object.",
    useWhen: ["Conditional branching depending on whether a key exists in an object."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "Property path", description: "The key or dot-path to check.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the boolean result.", details: [] },
    ],
    examples: ["Check Object Key Exists: configure key to check and output variable."],
    commonMistakes: ["Checking key existence on a non-object variable."],
  },
  check_object_empty: {
    title: "Check Object Empty Help",
    summary: "Check if a JSON object is empty (contains no keys).",
    useWhen: ["Adding logic forks based on whether an object has properties."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object variable.", details: [] },
      { name: "Result output variable name", description: "Variable name to store the boolean result.", details: [] },
    ],
    examples: ["Check Object Empty: configure source object and output variable."],
    commonMistakes: ["Checking emptyness of a non-object variable."],
  },
  transform_variable: {
    title: "Transform Variable Help",
    summary: "Create a new output from an existing value.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Source output",
        description: "Input output name.",
        details: ["Must be created before this node runs."],
      },
      {
        name: "Target output",
        description: "New output name.",
        details: ["Later nodes read this value by name."],
      },
      {
        name: "Expression",
        description: "Transform expression.",
        details: ["Keep it simple and testable."],
      },
    ],
    examples: ["Transform Variable: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  assert_output: {
    title: "Assert Output Help",
    summary: "Require an output to match an expected value.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Output name",
        description: "Output to check.",
        details: ["The output must exist before assertion."],
      },
      {
        name: "Match",
        description: "Equals matches exactly; Contains accepts a substring.",
        details: ["Use Contains for longer or slightly changing text."],
      },
      {
        name: "Expected value",
        description: "Expected value.",
        details: ["Check whitespace and letter case."],
      },
    ],
    examples: ["Assert Output: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  domain_allowlist: {
    title: "Domain Allowlist Help",
    summary: "Restrict the workflow to allowed domains.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Allowed domains",
        description: "Allowed domains, one per line.",
        details: ["Use domains without paths, such as example.com.", "If the workflow leaves the allowlist, the run should be blocked by existing semantics."],
      },
    ],
    examples: ["Domain Allowlist: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  get_current_url: {
    title: "Get Current URL Help",
    summary: "Capture the current page URL and store it in system.current_url.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Output",
        description: "URL data is stored in system.current_url.",
        details: ["No additional configuration needed."],
      },
    ],
    examples: ["Get Current URL: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
  quarantined: {
    title: "Quarantined Help",
    summary: "Node quarantined due to an invalid or unsupported schema.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      {
        name: "Status",
        description: "Node is retained for reference but not compiled or executed.",
        details: ["Fix or replace the action payload before running again."],
      },
    ],
    examples: ["Quarantined: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
  },
};
