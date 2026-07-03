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
  update_object_variable: {
    title: "Update Object Variable Help",
    summary: "Perform JSON object operations (merge, deep_merge, set_key, delete_key) on an object variable.",
    useWhen: ["Use when the graph needs this node to express flow clearly."],
    fields: [
      { name: "Variable name", description: "Name of the object variable to update.", details: [] },
      { name: "Operation", description: "The object operation to perform.", details: [] },
      { name: "Value", description: "The JSON string to merge/deep_merge.", details: [] },
      { name: "Property key", description: "The property key path (supports dot-path).", details: [] },
      { name: "Property value type", description: "The data type of the value to set.", details: [] },
      { name: "Property value", description: "The value to set for the key.", details: [] },
    ],
    examples: ["Update Object Variable: configure fields in the inspector, then connect the required ports on the canvas."],
    commonMistakes: ["Configuring fields but forgetting required ports before validate/run."],
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
