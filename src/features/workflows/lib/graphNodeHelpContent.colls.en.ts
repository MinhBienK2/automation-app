import type { GraphNodeType } from "../../../types/workflow";
import type { GraphNodeHelpContent } from "./graphNodeHelpContent";

export const collNodesEn: Partial<Record<GraphNodeType, GraphNodeHelpContent>> = {
  update_list_variable: {
    title: "Update List Help",
    summary: "Modify an existing list (array) variable directly.",
    useWhen: ["Use to add, remove, merge, or deduplicate items in a list."],
    fields: [
      { name: "Variable name", description: "Name of the list variable.", details: [] },
      { name: "Operation", description: "List operation (push, unshift, pop, shift, merge, etc.).", details: [] },
      { name: "Value type", description: "Data type of the new item to add.", details: [] },
      { name: "Value", description: "The value of the item to manipulate.", details: [] },
      { name: "Index", description: "The index position to remove (when using remove_by_index).", details: [] }
    ],
    examples: ["Variable: pending_urls, Operation: push, Value type: Text, Value: {{current_url}}"],
    commonMistakes: ["Running operations on a variable that is not a list (array), triggering runtime errors."],
  },
  create_empty_list: {
    title: "Create Empty List Help",
    summary: "Initialize an empty list variable (empty array).",
    useWhen: ["Use to declare or clear a list variable before appending items (push) in loops."],
    fields: [
      { name: "Output variable name", description: "Name of the new empty list variable.", details: [] }
    ],
    examples: ["Output variable name: harvested_emails"],
    commonMistakes: ["Leaving output variable name blank, preventing subsequent references."],
  },
  create_list_manual: {
    title: "Create List Manually Help",
    summary: "Initialize a list containing predefined static items.",
    useWhen: ["Use when iterating over a fixed set of items (e.g. static domains, specific usernames)."],
    fields: [
      { name: "Output variable name", description: "Name of the new list variable.", details: [] },
      { name: "Item value type", description: "Data type of items in the list.", details: [] },
      { name: "List items", description: "Items to populate, configured one value per line.", details: [] }
    ],
    examples: ["Output name: country_list, Type: Text, Items: Vietnam\\nThailand\\nSingapore"],
    commonMistakes: ["Leaving the list items empty, producing an empty list."],
  },
  split_text_to_list: {
    title: "Split Text to List Help",
    summary: "Split a text string into a list of items using a separator.",
    useWhen: ["Use when you have comma-separated, space-separated, or newline-separated values and need an array to loop over."],
    fields: [
      { name: "Output variable name", description: "Name of the new list variable.", details: [] },
      { name: "Source text to split", description: "Text content to split.", details: [] },
      { name: "Delimiter", description: "Separator string (e.g., comma ',', space ' ', or newline '\\n').", details: [] }
    ],
    examples: ["Output: categories, Source: 'Sports,News,Entertainment', Delimiter: ','"],
    commonMistakes: ["Using a delimiter that does not match actual separators in the source text, creating a list of length 1."],
  },
  generate_number_range: {
    title: "Generate Number Range Help",
    summary: "Generate a list of numbers running from Start to End.",
    useWhen: ["Use to construct page index lists for pagination loops."],
    fields: [
      { name: "Output variable name", description: "Name of the new list variable.", details: [] },
      { name: "Start value", description: "Start number.", details: [] },
      { name: "End value", description: "End number (inclusive).", details: [] },
      { name: "Step size", description: "The step offset increment (defaults to 1).", details: [] }
    ],
    examples: ["Output: pages, Start: 1, End: 10, Step: 1 to generate numbers from 1 to 10."],
    commonMistakes: ["Configuring step size of 0 or a direction opposite to bounds, leading to generation errors."],
  },
  add_to_list: {
    title: "Add to List Help",
    summary: "Insert an item at the start, end, or append unique items only.",
    useWhen: ["Use to accumulate scraped results inside loop structures into a single array."],
    fields: [
      { name: "Target list variable name", description: "Name of the destination list variable.", details: [] },
      { name: "Add position", description: "Insertion mode (start, end, unique).", details: [] },
      { name: "Value type", description: "Data type of value to insert.", details: [] },
      { name: "Value to add", description: "Value of item to insert.", details: [] }
    ],
    examples: ["Target: collected_titles, Position: end, Value type: Text, Value: {{extracted_title}}"],
    commonMistakes: ["Targeting a list variable name that currently stores a string or number."],
  },
  remove_from_list_by_index: {
    title: "Remove from List by Index Help",
    summary: "Remove the item at a specific index location from a list.",
    useWhen: ["Use to discard items at known indices (e.g. discarding the first row)."],
    fields: [
      { name: "Target list variable name", description: "Name of the list variable.", details: [] },
      { name: "Index", description: "Index position to remove (0-based).", details: [] }
    ],
    examples: ["Target: task_queue, Index: 0 to remove the first item."],
    commonMistakes: ["Providing an index that exceeds the bounds of the list."],
  },
  remove_from_list_by_value: {
    title: "Remove from List by Value Help",
    summary: "Remove all items matching a specific value from the list.",
    useWhen: ["Use to filter out specific items (e.g., removing 'draft' or 'failed' from status lists)."],
    fields: [
      { name: "Target list variable name", description: "Name of the list variable.", details: [] },
      { name: "Value type", description: "Data type of values to remove.", details: [] },
      { name: "Value to match for removal", description: "The exact value to discard.", details: [] }
    ],
    examples: ["Target: user_roles, Value type: Text, Value to match: 'guest'"],
    commonMistakes: ["Matching value data type does not match the actual data type of list items."],
  },
  merge_lists: {
    title: "Merge Lists Help",
    summary: "Merge another list or a JSON array into a target list.",
    useWhen: ["Use to merge scraped results from different pages or merge configurations."],
    fields: [
      { name: "Target list variable name", description: "Destination list variable.", details: [] },
      { name: "List to merge", description: "Source list variable or JSON array to merge.", details: [] },
      { name: "Merge unique items only", description: "Only merge values not present in the target list.", details: [] }
    ],
    examples: ["Target: all_products, List to merge: {{page_products}}, Unique: true"],
    commonMistakes: ["Merging a source variable that is not a list (e.g. passing a plain string)."],
  },
  get_list_item: {
    title: "Get List Item Help",
    summary: "Extract a single item from a list by index or special position (first, last, random).",
    useWhen: ["Use to fetch a random account proxy or grab the first queue task."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Position", description: "The position to fetch (first, last, random, specific_index).", details: [] },
      { name: "Index", description: "Index position (0-based, only used when position is specific_index).", details: [] },
      { name: "Result output variable name", description: "Output variable storing the item.", details: [] }
    ],
    examples: ["Source: proxylist, Position: random, Result: current_proxy"],
    commonMistakes: ["Providing an index out of bounds, yielding an undefined result."],
  },
  get_list_length: {
    title: "Get List Length Help",
    summary: "Measure the total number of items in a list.",
    useWhen: ["Use to verify items scraped or serve as pagination exit rules."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Output variable name storing the length count.", details: [] }
    ],
    examples: ["Source: users_array, Result: users_count"],
    commonMistakes: ["Measuring length on variables that do not store list structures."],
  },
  slice_list: {
    title: "Slice List Help",
    summary: "Extract a sublist from a start index to an end index.",
    useWhen: ["Use to slice large datasets into smaller batches for incremental processing."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Start index", description: "Start position (inclusive).", details: [] },
      { name: "End index", description: "End position (optional, exclusive).", details: [] },
      { name: "Result output variable name", description: "Output variable storing the sublist.", details: [] }
    ],
    examples: ["Source: all_records, Start: 0, End: 10, Result: first_batch to get first 10 items."],
    commonMistakes: ["Setting the start index greater than the end index, creating an empty sublist."],
  },
  join_list: {
    title: "Join List Help",
    summary: "Join all items in a list into a single text string using a separator.",
    useWhen: ["Use to serialize arrays of tags/keywords into a single string for display or file writing."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Separator text", description: "Separator string between items (e.g. comma, space, newline '\\n').", details: [] },
      { name: "Result output variable name", description: "Output variable storing the string.", details: [] }
    ],
    examples: ["Source: keywords_list, Separator: '; ', Result: keywords_string"],
    commonMistakes: ["Joining lists containing complex objects without mapping property values first, resulting in '[object Object]' strings."],
  },
  filter_list: {
    title: "Filter List Help",
    summary: "Filter list items based on visual conditional rules.",
    useWhen: ["Use to retain/discard items matching criteria (e.g., retaining products priced under $50)."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the filtered list.", details: [] },
      { name: "Combine operator", description: "Combine operator (AND, OR) for rules.", details: [] },
      { name: "Filter rules", description: "Conditional filter rules.", details: [] }
    ],
    examples: ["Source: products, Result: cheap_products, Combine: AND, Rules: item.price < 50"],
    commonMistakes: ["Forgetting to use the 'item.' prefix when referencing properties in custom filter rules (e.g. 'price < 50' instead of 'item.price < 50')."],
  },
  map_list_property: {
    title: "Map List Property Help",
    summary: "Extract a specific property key from a list of objects, producing a new array.",
    useWhen: ["Use when you have a list of user objects (each having name, email, id) and want to isolate a list of emails."],
    fields: [
      { name: "Source list", description: "Name of the source object list.", details: [] },
      { name: "Property key to extract", description: "Property key to extract (e.g. 'email').", details: [] },
      { name: "Result output variable name", description: "Output variable storing the mapped array.", details: [] }
    ],
    examples: ["Source: users, Key: 'email', Result: email_list"],
    commonMistakes: ["Running property mapping on arrays containing primitive values (strings/numbers) instead of objects."],
  },
  sort_reverse_list: {
    title: "Sort / Reverse List Help",
    summary: "Sort list items or reverse their order.",
    useWhen: ["Use to sort price arrays ascending or reverse history log orders."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Action", description: "Action type (sort_asc, sort_desc, reverse).", details: [] },
      { name: "Sort key", description: "Property key to sort objects by (e.g. 'price').", details: [] },
      { name: "Result output variable name", description: "Output variable storing the result.", details: [] }
    ],
    examples: ["Source: score_list, Action: sort_desc, Result: sorted_scores"],
    commonMistakes: ["Sorting lists containing mixed string and number values, yielding unpredictable orders."],
  },
  create_empty_object: {
    title: "Create Empty Object Help",
    summary: "Initialize an empty JSON object variable ({}).",
    useWhen: ["Use to declare an empty object container before populating properties in later steps."],
    fields: [
      { name: "Output variable name", description: "Name of the new empty object variable.", details: [] }
    ],
    examples: ["Output variable name: user_profile"],
    commonMistakes: ["Leaving output variable name blank, preventing storage."],
  },
  create_object_manual: {
    title: "Create Object Manually Help",
    summary: "Create a JSON object by declaring key-value property lists directly.",
    useWhen: ["Use to define static JSON payloads for APIs or downstream scripts."],
    fields: [
      { name: "Output variable name", description: "Name of the object variable to create.", details: [] },
      { name: "Object fields list", description: "Predefined key-value fields list.", details: [] }
    ],
    examples: ["Output name: payload, Fields: name='John', age=30, active=true"],
    commonMistakes: ["Declaring duplicate property keys in the fields table."],
  },
  parse_json_to_object: {
    title: "Parse JSON to Object Help",
    summary: "Parse a JSON-formatted string into a structured JSON object variable.",
    useWhen: ["Use to decode raw API responses or text files into JSON objects to extract properties."],
    fields: [
      { name: "JSON source text", description: "The raw JSON string to parse.", details: [] },
      { name: "Output variable name", description: "Output variable storing the object.", details: [] }
    ],
    examples: ["Source text: '{\"status\": 200, \"data\": []}', Output name: api_response"],
    commonMistakes: ["Passing invalid JSON strings (e.g. using single quotes ' instead of double quotes \" around keys), triggering runtime parse errors."],
  },
  set_object_property: {
    title: "Set Object Property Help",
    summary: "Set a property value at a specific path (dot-path supported) inside an object.",
    useWhen: ["Use to update deep details of an object (e.g. setting user.auth.token)."],
    fields: [
      { name: "Variable name", description: "Name of the target object variable.", details: [] },
      { name: "Property path", description: "Key or dot-path to target (e.g. 'profile.email').", details: [] },
      { name: "Value type", description: "Data type of the value to set.", details: [] },
      { name: "Value", description: "The value to assign.", details: [] }
    ],
    examples: ["Variable: user, Property path: 'contact.phone', Value type: Text, Value: '0901234567'"],
    commonMistakes: ["Targeting a variable path on a structure that is not a JSON object."],
  },
  remove_object_property: {
    title: "Remove Object Property Help",
    summary: "Remove a property from an object at a specific path (dot-path supported).",
    useWhen: ["Use to strip credentials or cleanup garbage keys before posting payloads."],
    fields: [
      { name: "Variable name", description: "Name of the target object variable.", details: [] },
      { name: "Property path", description: "The dot-path key to remove.", details: [] }
    ],
    examples: ["Variable: credentials, Property path: 'password'"],
    commonMistakes: ["Attempting to remove property paths that do not exist (causes no-ops but complicates logs)."],
  },
  merge_objects: {
    title: "Merge Objects Help",
    summary: "Merge properties from a source object or JSON string into a destination object.",
    useWhen: ["Use to blend general configurations with overrides."],
    fields: [
      { name: "Variable name", description: "Destination object variable.", details: [] },
      { name: "Value to merge", description: "Source object variable or JSON string to merge.", details: [] },
      { name: "Deep merge", description: "Toggle deep recursive merge; off overrides top-level keys entirely.", details: [] }
    ],
    examples: ["Variable: base_settings, Value to merge: {{user_settings}}, Deep merge: true"],
    commonMistakes: ["Merging invalid JSON strings into the target object."],
  },
  rename_object_property: {
    title: "Rename Object Property Help",
    summary: "Rename an object property key path while retaining its value.",
    useWhen: ["Use to standardize schema key structures before integrations."],
    fields: [
      { name: "Variable name", description: "Name of the target object variable.", details: [] },
      { name: "Old key path", description: "The existing property path.", details: [] },
      { name: "New key path", description: "The new key name.", details: [] }
    ],
    examples: ["Variable: employee, Old key path: 'job', New key path: 'role'"],
    commonMistakes: ["Specifying an old key path that does not exist, leaving the object unmodified."],
  },
  get_object_property: {
    title: "Get Object Property Help",
    summary: "Retrieve a property value from an object at a path (dot-path supported).",
    useWhen: ["Use to extract values nested deep inside JSON payloads (e.g. user.address.city)."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "Property path", description: "The dot-path key to retrieve.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the value.", details: [] }
    ],
    examples: ["Source: profile, Property path: 'preferences.theme', Result: user_theme"],
    commonMistakes: ["Targeting a non-existent path, returning undefined."],
  },
  get_object_keys: {
    title: "Get Object Keys Help",
    summary: "Extract top-level keys of an object into a string array.",
    useWhen: ["Use to iterate over object property keys in loop structures."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "Result output variable name", description: "Output variable storing keys.", details: [] }
    ],
    examples: ["Source: student_record, Result: fields_array to list fields."],
    commonMistakes: ["Executing keys retrieval on arrays or primitive variables."],
  },
  get_object_values: {
    title: "Get Object Values Help",
    summary: "Extract top-level values of an object into an array.",
    useWhen: ["Use when you need content values regardless of key labels."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "Result output variable name", description: "Output variable storing values.", details: [] }
    ],
    examples: ["Source: settings_obj, Result: config_values"],
    commonMistakes: ["Executing values retrieval on non-object variables."],
  },
  stringify_object: {
    title: "Stringify Object Help",
    summary: "Serialize a JSON object variable into a raw JSON string.",
    useWhen: ["Use to write objects to text files or transfer data in HTTP bodies."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the string.", details: [] }
    ],
    examples: ["Source: request_data, Result: raw_payload_string"],
    commonMistakes: ["Passing objects with circular references, causing stringification errors."],
  },
  execute_object_script: {
    title: "Execute Object Script Help",
    summary: "Run custom JavaScript to modify or transform an object.",
    useWhen: ["Use to perform complex calculations or structure mapping on objects."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "JavaScript Script", description: "The JS script block. Source object is accessible as 'obj'.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the script result.", details: [] }
    ],
    examples: ["Source: raw_user, Script: 'obj.fullname = obj.fname + \" \" + obj.lname; return obj;', Result: formatted_user"],
    commonMistakes: ["Forgetting to write the return statement inside the script block."],
  },
  check_object_key_exists: {
    title: "Check Object Key Exists Help",
    summary: "Check if a key or dot-path exists inside an object.",
    useWhen: ["Use to verify presence before processing properties (e.g. directing flow if 'error' key exists)."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "Property path", description: "The key or dot-path to check.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: api_response, Property path: 'errors.message', Result: has_error"],
    commonMistakes: ["Running existence checks on non-object variables."],
  },
  check_object_empty: {
    title: "Check Object Empty Help",
    summary: "Check if a JSON object is empty (contains no keys).",
    useWhen: ["Use to branch flows when receiving empty response objects from APIs."],
    fields: [
      { name: "Source object variable name", description: "Name of the source object.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: data_response, Result: is_data_empty"],
    commonMistakes: ["Checking emptiness on null or undefined variables instead of valid empty objects ({})."],
  },
  execute_list_script: {
    title: "Execute List Script Help",
    summary: "Run custom JavaScript to modify or filter a list.",
    useWhen: ["Use to perform complex array mappings or filters using JS."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "JavaScript Script", description: "The JS script block. Array is accessible as 'list'.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the script result.", details: [] }
    ],
    examples: ["Source: emails, Script: 'return list.filter(e => e.endsWith(\"@gmail.com\"));', Result: gmail_list"],
    commonMistakes: ["Forgetting to write the return statement inside the script block."],
  },
  check_list_empty: {
    title: "Check List Empty Help",
    summary: "Check if a list contains zero items.",
    useWhen: ["Use to halt or branch execution when queue lists run dry."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: pending_tasks, Result: is_queue_empty"],
    commonMistakes: ["Running emptiness checks on uninitialized variables, causing errors."],
  },
  check_list_contains: {
    title: "Check List Contains Help",
    summary: "Check if a list contains a specific value.",
    useWhen: ["Use to verify item membership in arrays."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Value type to check", description: "The data type of the search value.", details: [] },
      { name: "Value to search for", description: "The value to locate.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the boolean.", details: [] }
    ],
    examples: ["Source: group_members, Value type: Text, Value to search: 'admin', Result: is_admin_present"],
    commonMistakes: ["Search value type configuration does not match the actual data type of list items."],
  },
  check_list_any_match: {
    title: "Check List Any Match Help",
    summary: "Check if at least one item in a list matches filter conditions.",
    useWhen: ["Use to check if any scraped product falls below a price threshold."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the boolean.", details: [] },
      { name: "Combine operator", description: "Combine operator (AND, OR) for rules.", details: [] },
      { name: "Filter rules", description: "Matching filter rules.", details: [] }
    ],
    examples: ["Source: prices_list, Result: has_discounted, Combine: OR, Rules: item.price < 10000"],
    commonMistakes: ["Forgetting to use the 'item.' prefix inside custom rules."],
  },
  check_list_all_match: {
    title: "Check List All Match Help",
    summary: "Check if all items in a list simultaneously match filter conditions.",
    useWhen: ["Use to validate data quality standards (e.g. verifying all accounts are active)."],
    fields: [
      { name: "Source list variable name", description: "Name of the source list.", details: [] },
      { name: "Result output variable name", description: "Output variable storing the boolean.", details: [] },
      { name: "Combine operator", description: "Combine operator (AND, OR) for rules.", details: [] },
      { name: "Filter rules", description: "Matching filter rules.", details: [] }
    ],
    examples: ["Source: accounts, Result: all_verified, Combine: AND, Rules: item.status === 'verified'"],
    commonMistakes: ["Forgetting to use the 'item.' prefix inside custom rules."],
  },
};
