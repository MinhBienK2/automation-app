import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const flowNodesEn: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  start: {
    title: "Start Help",
    summary: "The starting point of the workflow graph.",
    useWhen: ["Always required to initiate the workflow."],
    fields: [
      {
        name: "Ports",
        description: "This node is connected to the first node to execute on the canvas.",
        details: [
          "The Out port forwards execution flow to the next node.",
          "It has exactly one Out port and no In port."
        ],
      },
    ],
    examples: ["Connect the Out port of Start to the first Click or Navigate node."],
    commonMistakes: ["Deleting or disconnecting the Out port of Start, preventing the workflow from starting."],
  },
  end_success: {
    title: "Success End Help",
    summary: "Halt and finish the workflow with a success state.",
    useWhen: ["Use as the termination point for successful execution paths."],
    fields: [
      {
        name: "Ports",
        description: "Receives final execution flow.",
        details: [
          "The In port receives flow from preceding nodes.",
          "It has no Out ports."
        ],
      },
    ],
    examples: ["Connect the done port of a loop or final actions to Success End."],
    commonMistakes: ["Forgetting to connect the last step to Success End, causing execution flow to break or fail to record success status."],
  },
  end_failure: {
    title: "End Failure Help",
    summary: "Halt and end the workflow with a failure status and a clear reason.",
    useWhen: [
      "Use when a business logic error is detected and execution cannot continue (e.g. account locked).",
      "Use in error-handling branches after all retries are exhausted."
    ],
    fields: [
      {
        name: "Failure reason",
        description: "Failure message displayed when the workflow stops here.",
        details: [
          "Keep it brief but clear about the cause of failure.",
          "This reason is recorded in the run history for auditing."
        ],
      },
    ],
    examples: ["Failure reason: 'Could not log in due to invalid password after retries'"],
    commonMistakes: ["Leaving the reason too generic (e.g., 'Error'), making future troubleshooting difficult."],
  },
  action: {
    title: "Action Node Help",
    summary: "Execute a specific browser automation or data processing action.",
    useWhen: ["Use to perform Click, Fill Field, Scroll, Extract data, and other tasks."],
    fields: [
      {
        name: "Action type",
        description: "The concrete action to execute.",
        details: [
          "After selecting an Action type, the specific settings and help content for that action will appear.",
          "Changing the Action type clears the old configuration and resets it to defaults."
        ],
      },
    ],
    examples: ["Action type: Click, XPath: //button[@id='submit']"],
    commonMistakes: ["Dragging an Action node to the canvas but forgetting to configure its Action type before running."],
  },
  call_subflow: {
    title: "Call Subflow Help",
    summary: "Execute a subflow within the same project, sharing the browser context and output storage.",
    useWhen: ["Use to reuse common paths like Login, Account Verification, or filling basic profile details."],
    fields: [
      {
        name: "Subflow id",
        description: "The subflow to call.",
        details: [
          "Must belong to the same project.",
          "Deleted or cross-project subflows cannot be called."
        ],
      },
      {
        name: "Input mapping",
        description: "Parameters passed to the subflow as key=value.",
        details: [
          "Configure one parameter per line.",
          "Supports dynamic values via templates, e.g. username={{account.username}}."
        ],
      },
      {
        name: "Output prefix",
        description: "Optional prefix added to variables created by the subflow.",
        details: [
          "Use this when calling the same subflow multiple times to distinguish outputs (e.g. login_1_username, login_2_username)."
        ],
      },
    ],
    examples: ["Subflow id: subflow-login", "Input mapping: email={{account.email}}\\npassword={{account.password}}"],
    commonMistakes: [
      "Creating a circular dependency (Subflow A calls B, which calls A) causing the app to hang.",
      "Failing to provide required input parameters that the subflow needs to run."
    ],
  },
  merge: {
    title: "Merge Help",
    summary: "Merge multiple execution branches back to a single shared path immediately without waiting for each other.",
    useWhen: ["Use to converge diverging paths (such as True/False branches of an If node) back into the main flow."],
    fields: [
      {
        name: "Ports",
        description: "Configure by connecting ports on the canvas.",
        details: [
          "The In port accepts multiple connections from different branches.",
          "The Out port forwards the merged flow to the next node."
        ],
      },
    ],
    examples: ["Converging successful login and existing session branches back into a shared scraping flow."],
    commonMistakes: ["Accidentally routing loop execution flows through Merge, leading to infinite loops."],
  },
  router: {
    title: "Router Help",
    summary: "Evaluate a list of conditions from top to bottom and trigger the first matching output port.",
    useWhen: ["Use when you need to branch into multiple paths based on page state or data (similar to if-else if-else logic)."],
    fields: [
      {
        name: "Condition",
        description: "Prioritized conditions to check.",
        details: [
          "Each matching condition triggers its corresponding output port (case_1, case_2, ...).",
          "Supports checking variables, text presence, xpath visibility, or URL fragments."
        ],
      },
      {
        name: "Done port",
        description: "Continuation port executed after the selected branch completes.",
        details: [
          "Optional; if left blank, the workflow finishes successfully after executing the selected branch."
        ],
      },
    ],
    examples: ["Router checks: Line 1: If Login button is visible (run login); Line 2: If OTP input is visible (run OTP); Default: Run main scraper."],
    commonMistakes: ["Placing a very broad condition at the top, preventing more specific conditions below from ever being evaluated."],
  },
  random_choice: {
    title: "Random Choice Help",
    summary: "Select a random output port to run based on configured weights.",
    useWhen: [
      "Use to mimic human behavior and bypass detection (e.g. 70% click link A, 30% click link B).",
      "Use for A/B testing different automation paths."
    ],
    fields: [
      {
        name: "Choices",
        description: "List of output branches with labels and weights.",
        details: [
          "Higher weight increase the probability of that branch being selected.",
          "Total weight does not need to equal 100."
        ],
      },
      {
        name: "Output name",
        description: "Variable storing the label of the randomly selected branch.",
        details: [
          "Useful for logging or directing downstream conditional decisions."
        ],
      },
    ],
    examples: ["Choice 1: label='Read news', weight=60; Choice 2: label='Watch video', weight=40 to distribute traffic."],
    commonMistakes: ["Setting weight to 0 for a path that needs to run, or leaving selected choice output ports unconnected, stalling the flow."],
  },
  if: {
    title: "If Help",
    summary: "Direct the workflow to either the True or False branch depending on a condition.",
    useWhen: ["Use to evaluate simple boolean state (e.g. Is user logged in?, Is error popup visible?)."],
    fields: [
      {
        name: "Condition",
        description: "The condition to check against variables or page state.",
        details: [
          "Inspect variables, check visible text, target XPath presence, or URL fragments."
        ],
      },
      {
        name: "True port",
        description: "Branch to execute when condition is true.",
        details: ["If left unconnected, the flow bypasses this branch and continues to the done port."]
      },
      {
        name: "False port",
        description: "Branch to execute when condition is false.",
        details: ["If left unconnected, the flow bypasses this branch and continues to the done port."]
      },
      {
        name: "Done port",
        description: "Common port executed after either True or False branches finish.",
        details: ["Connect this to merge the flow back into the main path."]
      }
    ],
    examples: ["Condition: URL contains '/dashboard', True goes to scrape, False goes to login, Done goes to generate report."],
    commonMistakes: ["Connecting subsequent actions directly to True/False instead of Done, making it impossible for the other branch to rejoin the main path."],
  },
  switch: {
    title: "Switch Help",
    summary: "Branch execution based on the exact value of an input expression.",
    useWhen: ["Use when a variable can hold multiple distinct values, and each value requires a unique set of actions."],
    fields: [
      {
        name: "Switch expression",
        description: "The expression or variable value to inspect.",
        details: ["Typically a dynamic variable like {{role}} or {{user.status}}."]
      },
      {
        name: "Switch cases",
        description: "List of expected values mapping to output ports.",
        details: [
          "Each value creates a port (e.g., 'admin', 'editor', 'viewer').",
          "The Default port executes if the expression matches no configured case."
        ]
      }
    ],
    examples: ["Expression: {{user_role}}, Cases: 'admin' (runs admin workflow), 'guest' (runs guest flow), Default (halts with error)."],
    commonMistakes: ["Forgetting to connect the Default port, leaving the workflow stuck when unexpected values occur at runtime."],
  },
  repeat_times: {
    title: "Repeat Times Help",
    summary: "Execute the loop branch a fixed number of times.",
    useWhen: ["Use when you need to repeat actions (e.g., click 'Load More' 5 times, reload a page 3 times)."],
    fields: [
      {
        name: "Times",
        description: "The number of iterations.",
        details: [
          "Must be a positive integer greater than 0.",
          "Supports dynamic values via variables, e.g. {{loop_count}}."
        ]
      }
    ],
    examples: ["Times: 5 to run the loop branch 5 times, then proceed through the done port."],
    commonMistakes: ["Setting a massive iteration limit without exit rules (Break Loop), risking browser hangs or rate limits."],
  },
  repeat_for_each: {
    title: "Repeat For Each Help",
    summary: "Iterate over every item in a list (array).",
    useWhen: ["Use when you have a list of data to process one by one (e.g. visiting a list of URLs to click elements)."],
    fields: [
      {
        name: "Item name",
        description: "Variable representing the current item in the active iteration.",
        details: ["Nodes inside the loop port can access this item via {{item_name}}."]
      },
      {
        name: "Items",
        description: "The list/array to iterate over.",
        details: [
          "Can be an array variable like {{urls}} or manually entered lines of text.",
          "Empty lines are automatically skipped."
        ]
      }
    ],
    examples: ["Item name: post_url, Items: {{posts}}. In the loop, access {{post_url}}."],
    commonMistakes: ["Passing a non-array variable (like a simple string) to Items, causing the loop to fail."],
  },
  repeat_until: {
    title: "Repeat Until Help",
    summary: "Execute the loop branch until the exit condition evaluates to True or limits are hit.",
    useWhen: ["Use when repeating actions without knowing the exact count (e.g. clicking 'Next page' until it disappears)."],
    fields: [
      {
        name: "Condition",
        description: "The condition that stops the loop.",
        details: ["The loop stops immediately when this condition becomes True."]
      },
      {
        name: "Loop max attempts",
        description: "Maximum iteration guard to prevent infinite loops.",
        details: ["Must be greater than 0. Acts as a safety net if the exit condition is never met."]
      },
      {
        name: "Loop timeout ms",
        description: "Maximum execution time for the loop.",
        details: ["Exceeding this duration stops the loop and triggers the timeout branch."]
      }
    ],
    examples: ["Condition: Element visible: //div[@id='success'], Max attempts: 20 to wait for background operations."],
    commonMistakes: ["Forgetting to update page state within the loop, causing the exit condition to stay false and exhaust max attempts."],
  },
  while: {
    title: "While Help",
    summary: "Repeat the loop branch as long as the condition remains True.",
    useWhen: ["Use to repeat actions based on an ongoing state (e.g. looping while a loading screen is present)."],
    fields: [
      {
        name: "Condition",
        description: "Condition that keeps the loop running.",
        details: ["Loop runs while this is True, and terminates the moment it evaluates to False."]
      },
      {
        name: "Loop max attempts",
        description: "Maximum iteration guard to prevent infinite loops.",
        details: ["Must be greater than 0."]
      },
      {
        name: "Loop timeout ms",
        description: "Maximum loop duration in milliseconds.",
        details: []
      }
    ],
    examples: ["Condition: Text visible: 'Loading...', Max attempts: 10 to keep looping while loading text is displayed."],
    commonMistakes: ["Setting a condition that is always true and forgetting to set an appropriate Max attempts limit, overloading the browser."],
  },
  retry: {
    title: "Retry Help",
    summary: "Re-run the Try branch if any action within it fails.",
    useWhen: ["Use to wrap flaky steps subject to network delays or slow loading (e.g., clicking submit, solving CAPTCHAs)."],
    fields: [
      {
        name: "Max attempts",
        description: "Total attempts allowed (including the initial attempt).",
        details: ["Must be greater than 1."]
      },
      {
        name: "Delay ms",
        description: "Duration to wait between attempts.",
        details: ["Configuring a short delay (e.g., 1000 - 3000ms) allows target pages to stabilize before retrying."]
      }
    ],
    examples: ["Max attempts: 3, Delay ms: 2000. If click fails, wait 2 seconds and retry, up to 3 times."],
    commonMistakes: ["Wrapping state-modifying actions (like checkouts or account creation) in a Retry block, triggering duplicate transactions."],
  },
  try_catch: {
    title: "Try Catch Help",
    summary: "Prevent errors in the try branch from failing the workflow, routing control to the error branch for recovery.",
    useWhen: ["Use to wrap crucial blocks where failures require screenshots, alert notifications, or clean-up resets."],
    fields: [
      {
        name: "Ports",
        description: "Configure by connecting ports on the canvas.",
        details: [
          "Try port: The main execution path.",
          "Error port: Executes if any error occurs in the try branch.",
          "Done port: Common continuation running after success or error recovery."
        ]
      }
    ],
    examples: ["Try connects to scraper steps, Error connects to error screenshotting, Done connects to closing browser."],
    commonMistakes: ["Leaving the error port unconnected, swallowing errors silently and continuing via done as if nothing happened."],
  },
  fallback: {
    title: "Fallback Help",
    summary: "Attempt the primary branch first, falling back to the fallback branch if it fails.",
    useWhen: ["Use when a webpage has two structural variants or two alternative locators to interact with."],
    fields: [
      {
        name: "Ports",
        description: "Connect action ports.",
        details: [
          "Primary port: The primary action branch to try first.",
          "Fallback port: Runs only if the primary branch fails.",
          "Done port: Execution resumes here after either branch completes."
        ]
      }
    ],
    examples: ["Primary connects to new layout click, Fallback connects to legacy layout click."],
    commonMistakes: ["Failing to connect the fallback port, or linking both primary and fallback to the same steps."],
  },
  break_loop: {
    title: "Break Loop Help",
    summary: "Exit the closest enclosing loop (Repeat, While) immediately.",
    useWhen: ["Use inside loops when a specific termination condition is met (e.g. keyword found in table)."],
    fields: [
      {
        name: "Ports",
        description: "Accepts flow and exits loop.",
        details: [
          "Has an In port only.",
          "When triggered, execution jumps directly to the done port of the enclosing loop."
        ]
      }
    ],
    examples: ["Place Break Loop inside the True branch of an If checking: 'If item is out of stock' inside a cart loop."],
    commonMistakes: ["Placing Break Loop outside the body of any loop. This will be blocked by graph validation."],
  },
  continue_loop: {
    title: "Continue Loop Help",
    summary: "Skip the remainder of the current iteration and jump to the next item.",
    useWhen: ["Use to skip processing for invalid dataset rows (e.g., if email is blank, skip send actions)."],
    fields: [
      {
        name: "Ports",
        description: "Accepts flow and skips iteration.",
        details: [
          "Has an In port only.",
          "When triggered, it jumps immediately to the next iteration of the enclosing loop."
        ]
      }
    ],
    examples: ["Place Continue Loop inside an If checking: 'If price is 0' to bypass scraping details for free items."],
    commonMistakes: ["Placing Continue Loop outside the body of any loop. This will be blocked by graph validation."],
  },
  stop_workflow: {
    title: "Stop Workflow Help",
    summary: "Halt workflow execution immediately with a designated success or failure status.",
    useWhen: ["Use when conditional checks require ending the workflow early in specific branches."],
    fields: [
      {
        name: "Status",
        description: "The desired exit status (Success or Failure).",
        details: []
      },
      {
        name: "Reason",
        description: "The termination explanation.",
        details: ["This reason is logged in the run history to document why execution stopped early."]
      }
    ],
    examples: ["Status: Success, Reason: 'All target products scraped. Stopping early.'"],
    commonMistakes: ["Setting Status to Success but writing a failure description as the Reason, causing auditing confusion."],
  },
};
