import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const varsNodesEn: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  set_variable: {
    title: "Set Variables Help",
    summary: "Store one or more variables of various data types for downstream nodes to use.",
    useWhen: ["Use to initialize configuration, store run state, or save static default values."],
    fields: [
      {
        name: "Rows",
        description: "List of variables to save.",
        details: [
          "Each row takes a Name, Type (text, number, boolean, JSON), and Value.",
          "Supports dynamic nested structures via dot-notation, e.g. user.name."
        ],
      },
    ],
    examples: ["Name: user.name, Type: Text, Value: 'John Doe'\\nName: app_version, Type: Number, Value: 2.1"],
    commonMistakes: ["Using spaces or special characters in variable names, causing expression evaluation failures later."],
  },
  set_json_variables: {
    title: "Set JSON Variables Help",
    summary: "Initialize multiple variables at once by parsing a JSON Object.",
    useWhen: ["Use to load configuration payloads or batch import properties from files/APIs as JSON."],
    fields: [
      {
        name: "JSON variables",
        description: "JSON string representing the variables object.",
        details: [
          "Properties in the JSON object automatically become individual variables.",
          "Nested objects are flattened into dot-paths (e.g., { 'a': { 'b': 1 } } yields a.b = 1)."
        ],
      },
    ],
    examples: ["JSON variables: { \"session\": { \"id\": 1001, \"active\": true } } to create session.id and session.active."],
    commonMistakes: ["Entering malformed JSON strings (e.g. omitting double quotes around keys)."],
  },
  check_conditions: {
    title: "Check Conditions Help",
    summary: "Evaluate conditional visual rules or execute custom JS to yield a True/False result.",
    useWhen: ["Use before an If or While node to evaluate complex boolean logic derived from multiple variables."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "Output variable name that stores the boolean result (true or false).",
        details: []
      },
      {
        name: "Evaluation Mode",
        description: "Evaluation mode (Visual Rules or JavaScript Code).",
        details: [
          "In JavaScript mode, access prior variables via the 'outputs' object (e.g., outputs.count > 10).",
          "Supports direct variable interpolation using double curly braces (e.g. {{count}} > 10)."
        ]
      }
    ],
    examples: ["Result: is_valid, Mode: JavaScript, Expression: outputs.score >= 50 && outputs.verified === true"],
    commonMistakes: ["Writing invalid JavaScript syntax or referencing variables that do not exist yet."],
  },
  calculate_value: {
    title: "Calculate Value Help",
    summary: "Evaluate a JavaScript/mathematical expression and save the raw result.",
    useWhen: ["Use when you need arithmetic operations or custom string concatenation to store values."],
    fields: [
      {
        name: "Result Output Variable Name",
        description: "Output variable name that stores the calculated result.",
        details: []
      },
      {
        name: "JavaScript / Math Expression",
        description: "The mathematical expression or JavaScript snippet to evaluate.",
        details: [
          "The code snippet must return a value.",
          "Access previous variables via outputs.name."
        ]
      }
    ],
    examples: ["Result: total_with_tax, Expression: outputs.subtotal * 1.1"],
    commonMistakes: ["Performing calculations on variables that are strings without parsing them to numbers first."],
  },
  update_number_variable: {
    title: "Update Number Variable Help",
    summary: "Perform basic arithmetic updates directly on an existing number variable.",
    useWhen: ["Use to increment/decrement counters or accumulate values."],
    fields: [
      { name: "Variable name", description: "Name of the number variable to update.", details: [] },
      { name: "Operation", description: "Arithmetic operation (add, subtract, multiply, divide, increment, decrement).", details: [] },
      { name: "Value", description: "Operand value used for the calculation.", details: [] }
    ],
    examples: ["Variable name: attempt_count, Operation: Increment"],
    commonMistakes: ["Updating a variable that was never initialized with a number, resulting in NaN (Not a Number)."],
  },
  set_number_variable: {
    title: "Set Number Variable Help",
    summary: "Initialize or set a number value on an output variable.",
    useWhen: ["Use to set counter values before starting loops or assign static numeric defaults."],
    fields: [
      { name: "Result variable", description: "Name of the output number variable.", details: [] },
      { name: "Value", description: "The number value to assign (supports templates like {{var}}).", details: [] }
    ],
    examples: ["Result variable: page_limit, Value: 10"],
    commonMistakes: ["Entering alphabetical text that cannot be parsed into a number."],
  },
  generate_random_number: {
    title: "Generate Random Number Help",
    summary: "Generate a random number within a designated min/max range.",
    useWhen: ["Use to randomize delays to simulate human interactions or generate test indices."],
    fields: [
      { name: "Result variable", description: "Output variable storing the random number.", details: [] },
      { name: "Minimum value", description: "Minimum bound.", details: [] },
      { name: "Maximum value", description: "Maximum bound.", details: [] },
      { name: "Generate integer only", description: "Generate only integers (True) or decimals (False).", details: [] }
    ],
    examples: ["Result variable: delay_time, Min: 1000, Max: 5000, Integer: true to generate a 1 to 5-second delay."],
    commonMistakes: ["Setting the Minimum value greater than the Maximum value."],
  },
  parse_text_to_number: {
    title: "Parse Text to Number Help",
    summary: "Convert a string representation of a number into a raw numeric value.",
    useWhen: ["Use after scraping currency or counts as text from webpages, converting them to numbers for arithmetic."],
    fields: [
      { name: "Source text", description: "Source text containing numbers.", details: [] },
      { name: "Fallback value", description: "Default value returned if parsing fails (e.g. 0).", details: [] },
      { name: "Result variable", description: "Output variable name to store the parsed number.", details: [] }
    ],
    examples: ["Source text: {{raw_price}}, Fallback: 0, Result: price_number"],
    commonMistakes: ["Forgetting to strip currency symbols ($) or thousands separators (,) from the string before parsing."],
  },
  math_operation: {
    title: "Math Operation Help",
    summary: "Execute basic or advanced math operations between two operands.",
    useWhen: ["Use to perform math updates (add, subtract, multiply, divide, abs, sqrt, min, max) on variables."],
    fields: [
      { name: "Operand 1", description: "The first operand.", details: [] },
      { name: "Operation", description: "Math operation to perform.", details: [] },
      { name: "Operand 2", description: "The second operand (ignored for abs/sqrt).", details: [] },
      { name: "Result variable", description: "Output variable storing the result.", details: [] }
    ],
    examples: ["Operand 1: {{quantity}}, Operation: multiply, Operand 2: {{price}}, Result: subtotal"],
    commonMistakes: ["Performing division where Operand 2 evaluates to 0."],
  },
  round_number: {
    title: "Round Number Help",
    summary: "Round a number according to a chosen mode (round, floor, ceil).",
    useWhen: ["Use to clean up decimal remains after division or percentage calculations."],
    fields: [
      { name: "Source number", description: "The number to round.", details: [] },
      { name: "Rounding mode", description: "Rounding mode (round: nearest, floor: round down, ceil: round up).", details: [] },
      { name: "Decimal places", description: "Number of decimal places to retain (e.g., 2).", details: [] },
      { name: "Result variable", description: "Output variable storing the rounded result.", details: [] }
    ],
    examples: ["Source: 3.14159, Mode: round, Decimals: 2, Result: rounded_pi (outputs 3.14)"],
    commonMistakes: ["Setting the decimal places count to a negative value."],
  },
  format_number: {
    title: "Format Number Help",
    summary: "Format a number into a formatted locale string (currency, percentage, decimals).",
    useWhen: ["Use to format values nicely for reporting, logging, or writing to CSVs."],
    fields: [
      { name: "Source number", description: "The number to format.", details: [] },
      { name: "Format style", description: "Formatting style (decimal, percent, currency).", details: [] },
      { name: "Decimal places", description: "Decimal places to include.", details: [] },
      { name: "Currency code", description: "ISO currency code (e.g. USD, EUR) if style is currency.", details: [] },
      { name: "Locale", description: "Locale code (e.g. en-US, de-DE) controlling separators.", details: [] },
      { name: "Result variable", description: "Output variable name storing the string.", details: [] }
    ],
    examples: ["Source: 1000000, Style: currency, Currency: USD, Locale: en-US -> '$1,000,000.00'"],
    commonMistakes: ["Entering an invalid Locale or Currency code, triggering formatting errors."],
  },
  compare_numbers: {
    title: "Compare Numbers Help",
    summary: "Compare two numeric values and yield a boolean result.",
    useWhen: ["Use to evaluate condition thresholds (e.g. checking if page items scraped exceed a limit)."],
    fields: [
      { name: "Operand 1", description: "The first operand.", details: [] },
      { name: "Comparison operator", description: "Comparison operator (greater than, less than, equals, etc.).", details: [] },
      { name: "Operand 2", description: "The second operand.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Operand 1: {{current_count}}, Operator: gte, Operand 2: {{max_count}}, Result: is_finished"],
    commonMistakes: ["Comparing an unparsed string variable against a numeric literal, causing unexpected sorting/evaluation results."],
  },
  check_number_range: {
    title: "Check Number Range Help",
    summary: "Check whether a number falls within a designated Min and Max range.",
    useWhen: ["Use to validate that a numeric value is within boundaries."],
    fields: [
      { name: "Number value", description: "The number to check.", details: [] },
      { name: "Minimum bound", description: "Lower boundary limit.", details: [] },
      { name: "Maximum bound", description: "Upper boundary limit.", details: [] },
      { name: "Inclusive bounds", description: "Whether to include boundary limits.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Number: {{age}}, Min: 18, Max: 60, Inclusive: true, Result: is_working_age"],
    commonMistakes: ["Setting the Minimum boundary larger than the Maximum boundary."],
  },
  check_number_property: {
    title: "Check Number Property Help",
    summary: "Check properties of a number (even, odd, positive, negative, integer).",
    useWhen: ["Use to direct alternating behavior (e.g. clicking only even rows)."],
    fields: [
      { name: "Number value", description: "The number to check.", details: [] },
      { name: "Property to check", description: "The property (even, odd, positive, negative, integer).", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Number: {{row_index}}, Property: even, Result: is_even"],
    commonMistakes: ["Running even/odd checks on decimal/floating-point numbers, yielding inaccurate results."],
  },
  update_text_variable: {
    title: "Update Text Variable Help",
    summary: "Perform string operations directly on an existing text variable.",
    useWhen: ["Use to trim, replace, uppercase, lowercase, append, or prepend text on existing string states."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to update.", details: [] },
      { name: "Operation", description: "String operation (append, prepend, replace, trim, uppercase, lowercase).", details: [] },
      { name: "Search pattern", description: "The literal string or Regex pattern to match for replacements.", details: [] },
      { name: "Value", description: "Text to append, prepend, or substitute.", details: [] }
    ],
    examples: ["Variable: name, Operation: trim to clean up whitespace."],
    commonMistakes: ["Writing malformed regex syntax in the Search pattern field during replace operations."],
  },
  set_text_variable: {
    title: "Set Text Variable Help",
    summary: "Assign a text string value to an output variable (supports variable interpolation via double curly braces).",
    useWhen: ["Use to initialize string templates or construct messages from prior variables."],
    fields: [
      { name: "Output variable name", description: "Output variable storing the text.", details: [] },
      { name: "Text value", description: "The text value to assign.", details: [] }
    ],
    examples: ["Output name: greeting, Value: 'Hello {{user.name}}, have a nice day!'"],
    commonMistakes: ["Mispelling variable names inside double curly braces, leading to empty values or runtime errors."],
  },
  append_text: {
    title: "Append Text Help",
    summary: "Append a string of text to the end of an existing text variable.",
    useWhen: ["Use to accumulate logs or append suffixes to string identifiers."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to update.", details: [] },
      { name: "Text to append", description: "The text to attach at the end.", details: [] }
    ],
    examples: ["Variable: log, Text to append: '\\n[SUCCESS] Completed step.'"],
    commonMistakes: ["Appending to a variable that doesn't exist or is not a string, causing type errors."],
  },
  prepend_text: {
    title: "Prepend Text Help",
    summary: "Prepend a string of text to the beginning of an existing text variable.",
    useWhen: ["Use to add prefixes, headers, or qualifiers to string labels."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to update.", details: [] },
      { name: "Text to prepend", description: "The text to attach at the front.", details: [] }
    ],
    examples: ["Variable: filename, Text to prepend: 'backup_' to turn 'report.pdf' into 'backup_report.pdf'."],
    commonMistakes: ["Failing to initialize the variable before prepending, leading to unexpected string states."],
  },
  replace_text: {
    title: "Replace Text Help",
    summary: "Find and replace matching text substrings or regex patterns with a new string.",
    useWhen: ["Use to sanitize inputs, strip characters, or redact credentials."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to update.", details: [] },
      { name: "Search pattern", description: "Literal text or Regex pattern to locate.", details: [] },
      { name: "Replacement text", description: "Text to insert in place of matches.", details: [] }
    ],
    examples: ["Variable: phone, Search: '\\s+', Replacement: '' to strip spaces."],
    commonMistakes: ["Confusing literal search strings with Regex (e.g. searching for dots '.' in Regex without escaping them as '\\.')."],
  },
  trim_text: {
    title: "Trim Text Help",
    summary: "Remove all leading and trailing whitespace from a text string.",
    useWhen: ["Use to clean up form inputs or scraped text values before evaluation."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to trim.", details: [] }
    ],
    examples: ["Variable: email_input to clean up trailing whitespace in user inputs."],
    commonMistakes: ["Failing to trim scraped text before comparison, leading to false mismatches caused by hidden spaces."],
  },
  change_text_case: {
    title: "Change Text Case Help",
    summary: "Convert a text string to all uppercase or all lowercase.",
    useWhen: ["Use to normalize email formats or code keys before matching."],
    fields: [
      { name: "Variable name", description: "Name of the text variable to update.", details: [] },
      { name: "Case mode", description: "Target case (upper - uppercase, lower - lowercase).", details: [] }
    ],
    examples: ["Variable: promo_code, Case mode: upper to normalize 'coupon10' to 'COUPON10'."],
    commonMistakes: ["Applying case changes to null variables or numbers, which has no effect."],
  },
  slice_text: {
    title: "Slice Text Help",
    summary: "Extract a substring from a text variable based on start and end index indices.",
    useWhen: ["Use to capture fixed fragments of text (e.g., getting the last 4 digits of a card)."],
    fields: [
      { name: "Source variable", description: "The source string variable.", details: [] },
      { name: "Start index", description: "Starting position (0-based, inclusive).", details: [] },
      { name: "End index", description: "Ending position (optional, exclusive).", details: [] },
      { name: "Result variable", description: "Output variable storing the substring.", details: [] }
    ],
    examples: ["Source: full_card, Start: 12, End: 16, Result: last_four to get characters 12-15."],
    commonMistakes: ["Setting the end index less than or equal to the start index, resulting in an empty string."],
  },
  regex_extract: {
    title: "Regex Extract Help",
    summary: "Extract substrings matching a Regular Expression pattern.",
    useWhen: ["Use to extract codes, OTPs, telephone patterns, or IDs from long, unstructured text blocks."],
    fields: [
      { name: "Source variable", description: "Name of the source text variable.", details: [] },
      { name: "Regex pattern", description: "The regular expression to evaluate.", details: [] },
      { name: "Capture group index", description: "The 1-based index of the capture group (parenthesis block) to retrieve (defaults to 1).", details: [] },
      { name: "Result variable", description: "Output variable storing the extracted string.", details: [] }
    ],
    examples: ["Source: sms_content, Regex: 'OTP: (\\d{6})', Group: 1, Result: otp_code"],
    commonMistakes: ["Forgetting parentheses () in the Regex pattern to define capture groups, causing extraction failures."],
  },
  get_text_length: {
    title: "Get Text Length Help",
    summary: "Measure the number of characters in a string variable.",
    useWhen: ["Use to check length validation before submit actions (e.g. verifying phone length)."],
    fields: [
      { name: "Source variable", description: "The text variable to measure.", details: [] },
      { name: "Result variable", description: "Output variable storing the count (as a number).", details: [] }
    ],
    examples: ["Source: phone_number, Result: phone_length to ensure it matches 10 characters."],
    commonMistakes: ["Measuring length of uninitialized or null variables, triggering runtime errors."],
  },
  check_text_empty: {
    title: "Check Text Empty Help",
    summary: "Check if a text variable is empty, null, or undefined.",
    useWhen: ["Use to skip steps or branch flows when scraped data is missing."],
    fields: [
      { name: "Source variable", description: "The text variable to inspect.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean (true if empty).", details: [] }
    ],
    examples: ["Source: error_message, Result: is_no_error to proceed if no error message is captured."],
    commonMistakes: ["Strings with spaces (e.g., '   ') are not considered empty. Use trim_text first before checking."],
  },
  check_text_contains: {
    title: "Check Text Contains Help",
    summary: "Check whether a source string contains a specified substring.",
    useWhen: ["Use to verify headers or check for keywords (e.g. asserting title contains 'Success')."],
    fields: [
      { name: "Source variable", description: "The source string variable.", details: [] },
      { name: "Substring to search", description: "The substring to search for.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: page_content, Substring: 'Payment successful', Result: is_success"],
    commonMistakes: ["Checking is case-sensitive (e.g. 'success' will not match 'Success')."],
  },
  check_text_regex_matches: {
    title: "Check Text Regex Matches Help",
    summary: "Check if a text variable matches a Regular Expression pattern.",
    useWhen: ["Use to validate formatting standards (e.g. verifying email formats)."],
    fields: [
      { name: "Source variable", description: "The source text variable.", details: [] },
      { name: "Regex pattern", description: "The regex pattern to test against.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: email, Regex: '^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$', Result: is_valid_email"],
    commonMistakes: ["Writing malformed regex syntax or forgetting to escape regex special characters."],
  },
  update_flag_variable: {
    title: "Update Flag Variable Help",
    summary: "Update or toggle a boolean flag variable.",
    useWhen: ["Use to flip active states or update conditions in loop scopes."],
    fields: [
      { name: "Variable name", description: "Name of the flag variable.", details: [] },
      { name: "Operation", description: "The update operation (toggle, set_true, set_false).", details: [] }
    ],
    examples: ["Variable name: is_checked, Operation: toggle to flip true to false or vice versa."],
    commonMistakes: ["Applying flag updates to non-boolean variables, causing unexpected behaviors."],
  },
  set_boolean_variable: {
    title: "Set Boolean Variable Help",
    summary: "Set a boolean flag variable to True or False directly.",
    useWhen: ["Use to declare or reset boolean state markers."],
    fields: [
      { name: "Result variable", description: "Name of the output boolean variable.", details: [] },
      { name: "Value", description: "The boolean value to assign (true or false).", details: [] }
    ],
    examples: ["Result variable: is_logged_in, Value: true"],
    commonMistakes: ["Passing string text (e.g., 'yes', 'no') instead of true/false values."],
  },
  generate_random_boolean: {
    title: "Generate Random Boolean Help",
    summary: "Generate a random boolean value based on a configured probability.",
    useWhen: ["Use to add probabilistic decision branching in testing or web scraping."],
    fields: [
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] },
      { name: "Probability", description: "Probability of receiving true (0.0 to 1.0, defaults to 0.5 i.e. 50%).", details: [] }
    ],
    examples: ["Result variable: decision, Probability: 0.3 (30% chance for true)."],
    commonMistakes: ["Setting probability outside the [0.0, 1.0] range (e.g. entering 30 instead of 0.3)."],
  },
  parse_to_boolean: {
    title: "Parse to Boolean Help",
    summary: "Convert text strings or numbers to boolean equivalents.",
    useWhen: ["Use to parse status indicators like 'yes'/'no', '1'/'0' scraped from pages into booleans."],
    fields: [
      { name: "Source value to convert", description: "Source value to parse.", details: [] },
      { name: "Fallback value", description: "Fallback boolean value on parse failure.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: {{raw_status}}, Fallback: false, Result: is_active"],
    commonMistakes: ["Assigning a non-boolean fallback value, causing invalid variable states."],
  },
  boolean_logical_op: {
    title: "Boolean Logical Operation Help",
    summary: "Perform logical operations (AND, OR, NOT, XOR) on boolean values.",
    useWhen: ["Use to join multiple flags together before deciding execution branches."],
    fields: [
      { name: "First operand", description: "The first boolean operand.", details: [] },
      { name: "Logical Operation", description: "Logical operation (AND, OR, NOT, XOR).", details: [] },
      { name: "Second operand", description: "The second boolean operand (ignored for NOT).", details: [] },
      { name: "Result variable", description: "Output variable storing the result.", details: [] }
    ],
    examples: ["First: {{has_cookie}}, Operator: AND, Second: {{is_logged_in}}, Result: is_valid_session"],
    commonMistakes: ["Passing string variables or unparsed numeric variables directly as logical operands."],
  },
  compare_booleans: {
    title: "Compare Booleans Help",
    summary: "Compare whether two boolean values are equal or different.",
    useWhen: ["Use to check if two status flags match."],
    fields: [
      { name: "First operand", description: "The first boolean value.", details: [] },
      { name: "Operator", description: "Comparison operator (equals or not_equals).", details: [] },
      { name: "Second operand", description: "The second boolean value.", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["First: {{is_user_active}}, Operator: eq, Second: {{is_db_active}}, Result: is_sync"],
    commonMistakes: ["Comparing a boolean flag directly against a literal string 'true'/'false'."],
  },
  check_boolean_property: {
    title: "Check Boolean Property Help",
    summary: "Verify whether a boolean variable is True or False.",
    useWhen: ["Use to export checking state properties to variables."],
    fields: [
      { name: "Source value", description: "The boolean variable to check.", details: [] },
      { name: "Property", description: "The condition to check (is_true or is_false).", details: [] },
      { name: "Result variable", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: {{is_admin}}, Property: is_true, Result: has_admin_access"],
    commonMistakes: ["Running check properties on non-boolean variables."],
  },
};
