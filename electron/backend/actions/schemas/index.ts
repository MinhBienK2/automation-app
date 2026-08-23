import type { z } from "zod";
import type { ActionConfig, GraphNode } from "../../../../src/types/workflow.js";

import { navigateSchema } from "../navigation/schemas/navigate.js";
import { clickSchema } from "../interaction/schemas/click.js";
import { inputTextSchema } from "../interaction/schemas/input_text.js";
import { waitSchema } from "../navigation/schemas/wait.js";
import { extractTextSchema } from "../extraction/schemas/extract_text.js";
import { ifConditionSchema } from "../flow-control/schemas/if_condition.js";
import { setVariableSchema } from "../variables/schemas/set_variable.js";
import { takeScreenshotSchema } from "../extraction/schemas/take_screenshot.js";
import { executeJsSchema } from "../environment/schemas/execute_js.js";

import { clearInputSchema } from "../interaction/schemas/clear_input.js";
import { selectOptionSchema } from "../interaction/schemas/select_option.js";
import { checkSchema } from "../interaction/schemas/check.js";
import { uncheckSchema } from "../interaction/schemas/uncheck.js";
import { toggleCheckboxSchema } from "../interaction/schemas/toggle_checkbox.js";
import { selectRadioSchema } from "../interaction/schemas/select_radio.js";
import { uploadFileSchema } from "../interaction/schemas/upload_file.js";
import { submitFormSchema } from "../interaction/schemas/submit_form.js";
import { selectCustomOptionSchema } from "../interaction/schemas/select_custom_option.js";
import { setContenteditableSchema } from "../interaction/schemas/set_contenteditable.js";

import { pressKeySchema } from "../interaction/schemas/press_key.js";
import { hotkeySchema } from "../interaction/schemas/hotkey.js";
import { typeSequenceSchema } from "../interaction/schemas/type_sequence.js";
import { setClipboardSchema } from "../interaction/schemas/set_clipboard.js";
import { pasteClipboardSchema } from "../interaction/schemas/paste_clipboard.js";
import { hoverSchema } from "../interaction/schemas/hover.js";
import { doubleClickSchema } from "../interaction/schemas/double_click.js";
import { rightClickSchema } from "../interaction/schemas/right_click.js";
import { dragAndDropSchema } from "../interaction/schemas/drag_and_drop.js";
import { focusElementSchema } from "../interaction/schemas/focus_element.js";
import { blurElementSchema } from "../interaction/schemas/blur_element.js";
import { findElementSchema } from "../interaction/schemas/find_element.js";
import { scrollSchema } from "../interaction/schemas/scroll.js";

import { extractAttributeSchema } from "../extraction/schemas/extract_attribute.js";
import { extractInputValueSchema } from "../extraction/schemas/extract_input_value.js";
import { extractTableSchema } from "../extraction/schemas/extract_table.js";
import { extractListSchema } from "../extraction/schemas/extract_list.js";
import { countElementsSchema } from "../extraction/schemas/count_elements.js";
import { extractRegexMatchesSchema } from "../extraction/schemas/extract_regex_matches.js";
import { writeTextFileSchema } from "../files/schemas/write_text_file.js";
import { assertElementSchema } from "../extraction/schemas/assert_element.js";
import { assertTextSchema } from "../extraction/schemas/assert_text.js";
import { waitForDownloadSchema } from "../navigation/schemas/wait_for_download.js";
import { getCurrentUrlSchema } from "../extraction/schemas/get_current_url.js";
import {
  extractTextContentSchema,
  extractInnerHtmlSchema,
  extractOuterHtmlSchema,
  extractAllAttributesSchema,
  extractDataAttributesSchema,
  extractClassListSchema,
  extractDescendantAttributesSchema,
  extractSelectValueSchema,
  extractSelectOptionsSchema,
  extractCheckboxStateSchema,
  extractFormDataSchema,
  extractTableHeadersSchema,
  extractDimensionsSchema,
  extractVisibilitySchema,
  extractElementStateSchema,
  checkElementExistsSchema,
  extractComputedStyleSchema,
  extractTableRowSchema,
  extractTableColumnSchema,
  extractTableCellSchema,
  extractListAttributesSchema,
  extractStructuredListSchema,
  getPageTitleSchema,
  extractPageLinksSchema,
  getMetaContentSchema,
  extractNumbersSchema,
  extractUrlsSchema,
  extractEmailsSchema,
} from "../extraction/schemas/data_capture_new.js";

import { randomWaitSchema } from "../navigation/schemas/random_wait.js";
import { acceptDialogSchema } from "../navigation/schemas/accept_dialog.js";
import { dismissDialogSchema } from "../navigation/schemas/dismiss_dialog.js";
import { setCookieSchema } from "../environment/schemas/set_cookie.js";
import { clearCookiesSchema } from "../environment/schemas/clear_cookies.js";
import { setViewportSchema } from "../environment/schemas/set_viewport.js";
import { setGeolocationSchema } from "../environment/schemas/set_geolocation.js";
import { grantPermissionSchema } from "../environment/schemas/grant_permission.js";
import { setLocalStorageSchema } from "../environment/schemas/set_local_storage.js";
import { setSessionStorageSchema } from "../environment/schemas/set_session_storage.js";
import { setExtraHeadersSchema } from "../environment/schemas/set_extra_headers.js";
import { waitForRequestSchema } from "../environment/schemas/wait_for_request.js";
import { waitForResponseSchema } from "../environment/schemas/wait_for_response.js";
import { blockRequestSchema } from "../environment/schemas/block_request.js";
import { mockResponseSchema } from "../environment/schemas/mock_response.js";
import { goBackSchema } from "../navigation/schemas/go_back.js";
import { goForwardSchema } from "../navigation/schemas/go_forward.js";
import { reloadSchema } from "../navigation/schemas/reload.js";
import { openNewTabSchema } from "../navigation/schemas/open_new_tab.js";
import { openLinkInNewTabSchema } from "../navigation/schemas/open_link_in_new_tab.js";
import { switchTabSchema } from "../navigation/schemas/switch_tab.js";
import { closeTabSchema } from "../navigation/schemas/close_tab.js";

import { graphNoopSchema } from "../flow-control/schemas/graph_noop.js";
import { routerConditionSchema } from "../flow-control/schemas/router_condition.js";
import { randomChoiceSchema } from "../flow-control/schemas/random_choice.js";
import { repeatTimesSchema } from "../flow-control/schemas/repeat_times.js";
import { repeatForEachSchema } from "../flow-control/schemas/repeat_for_each.js";
import { retryBlockSchema } from "../flow-control/schemas/retry_block.js";
import { switchConditionSchema } from "../flow-control/schemas/switch_condition.js";
import { whileLoopSchema } from "../flow-control/schemas/while_loop.js";
import { repeatUntilSchema } from "../flow-control/schemas/repeat_until.js";
import { tryCatchSchema } from "../flow-control/schemas/try_catch.js";
import { fallbackBlockSchema } from "../flow-control/schemas/fallback_block.js";
import { breakLoopSchema } from "../flow-control/schemas/break_loop.js";
import { continueLoopSchema } from "../flow-control/schemas/continue_loop.js";
import { stopWorkflowSchema } from "../flow-control/schemas/stop_workflow.js";
import { transformVariableSchema } from "../variables/schemas/transform_variable.js";
import { updateNumberVariableSchema } from "../variables/schemas/update_number_variable.js";
import { updateTextVariableSchema } from "../variables/schemas/update_text_variable.js";
import { updateFlagVariableSchema } from "../variables/schemas/update_flag_variable.js";
import { updateListVariableSchema } from "../variables/schemas/update_list_variable.js";
import {
  createEmptyObjectSchema,
  createObjectManualSchema,
  parseJsonToObjectSchema,
  setObjectPropertySchema,
  removeObjectPropertySchema,
  mergeObjectsSchema,
  renameObjectPropertySchema,
  getObjectPropertySchema,
  getObjectKeysSchema,
  getObjectValuesSchema,
  stringifyObjectSchema,
  executeObjectScriptSchema,
  checkObjectKeyExistsSchema,
  checkObjectEmptySchema,
} from "../variables/schemas/object_actions.js";
import { assertOutputSchema } from "../flow-control/schemas/assert_output.js";
import { domainAllowlistSchema } from "../navigation/schemas/domain_allowlist.js";
import { setJsonVariablesSchema } from "../variables/schemas/set_json_variables.js";
import { checkConditionsSchema } from "../variables/schemas/check_conditions.js";
import { calculateValueSchema } from "../variables/schemas/calculate_value.js";
import { readTextFileSchema } from "../files/schemas/read_text_file.js";
import { parseCsvExcelSchema } from "../files/schemas/parse_csv_excel.js";
import { writeCsvExcelSchema } from "../files/schemas/write_csv_excel.js";
import { fileOperationSchema } from "../files/schemas/file_operation.js";
import { httpRequestSchema } from "../files/schemas/http_request.js";
import { dateTimeOperationSchema } from "../files/schemas/date_time_operation.js";
import { cryptoOperationSchema } from "../files/schemas/crypto_operation.js";
import { switchFrameSchema } from "../interaction/schemas/switch_frame.js";
import { switchToParentFrameSchema } from "../interaction/schemas/switch_to_parent_frame.js";
import {
  createEmptyListSchema,
  createListManualSchema,
  splitTextToListSchema,
  generateNumberRangeSchema,
  addToListSchema,
  removeFromListByIndexSchema,
  removeFromListByValueSchema,
  mergeListsSchema,
  getListItemSchema,
  getListLengthSchema,
  sliceListSchema,
  joinListSchema,
  filterListSchema,
  mapListPropertySchema,
  sortReverseListSchema,
  executeListScriptSchema,
  checkListEmptySchema,
  checkListContainsSchema,
  checkListAnyMatchSchema,
  checkListAllMatchSchema,
} from "../variables/schemas/list_actions.js";
import {
  setTextVariableSchema,
  appendTextSchema,
  prependTextSchema,
  replaceTextSchema,
  trimTextSchema,
  changeTextCaseSchema,
  sliceTextSchema,
  regexExtractSchema,
  getTextLengthSchema,
  checkTextEmptySchema,
  checkTextContainsSchema,
  checkTextRegexMatchesSchema,
} from "../variables/schemas/text_actions.js";
import {
  setNumberVariableSchema,
  generateRandomNumberSchema,
  parseTextToNumberSchema,
  mathOperationSchema,
  roundNumberSchema,
  formatNumberSchema,
  compareNumbersSchema,
  checkNumberRangeSchema,
  checkNumberPropertySchema,
} from "../variables/schemas/number_actions.js";
import {
  setBooleanVariableSchema,
  generateRandomBooleanSchema,
  parseToBooleanSchema,
  booleanLogicalOpSchema,
  compareBooleansSchema,
  checkBooleanPropertySchema,
} from "../variables/schemas/boolean_actions.js";



type ActionType = ActionConfig["type"];

export const actionSchemas: Partial<Record<ActionType, z.ZodSchema>> = {
  navigate: navigateSchema,
  wait: waitSchema,
  random_wait: randomWaitSchema,
  input_text: inputTextSchema,
  clear_input: clearInputSchema,
  click: clickSchema,
  find_element: findElementSchema,
  scroll: scrollSchema,
  select_option: selectOptionSchema,
  press_key: pressKeySchema,
  hotkey: hotkeySchema,
  hover: hoverSchema,
  double_click: doubleClickSchema,
  right_click: rightClickSchema,
  drag_and_drop: dragAndDropSchema,
  focus_element: focusElementSchema,
  blur_element: blurElementSchema,
  type_sequence: typeSequenceSchema,
  set_clipboard: setClipboardSchema,
  paste_clipboard: pasteClipboardSchema,
  check: checkSchema,
  uncheck: uncheckSchema,
  toggle_checkbox: toggleCheckboxSchema,
  select_radio: selectRadioSchema,
  upload_file: uploadFileSchema,
  submit_form: submitFormSchema,
  select_custom_option: selectCustomOptionSchema,
  set_contenteditable: setContenteditableSchema,
  extract_text: extractTextSchema,
  extract_attribute: extractAttributeSchema,
  extract_input_value: extractInputValueSchema,
  extract_table: extractTableSchema,
  extract_list: extractListSchema,
  count_elements: countElementsSchema,
  extract_regex_matches: extractRegexMatchesSchema,
  take_screenshot: takeScreenshotSchema,
  write_text_file: writeTextFileSchema,
  go_back: goBackSchema,
  go_forward: goForwardSchema,
  reload: reloadSchema,
  open_new_tab: openNewTabSchema,
  open_link_in_new_tab: openLinkInNewTabSchema,
  switch_tab: switchTabSchema,
  close_tab: closeTabSchema,
  accept_dialog: acceptDialogSchema,
  dismiss_dialog: dismissDialogSchema,
  wait_for_download: waitForDownloadSchema,
  set_variable: setVariableSchema,
  set_json_variables: setJsonVariablesSchema,
  check_conditions: checkConditionsSchema,
  calculate_value: calculateValueSchema,
  assert_element: assertElementSchema,
  assert_text: assertTextSchema,
  graph_noop: graphNoopSchema,
  if_condition: ifConditionSchema,
  router_condition: routerConditionSchema,
  random_choice: randomChoiceSchema,
  repeat_times: repeatTimesSchema,
  repeat_for_each: repeatForEachSchema,
  retry_block: retryBlockSchema,
  switch_condition: switchConditionSchema,
  while_loop: whileLoopSchema,
  repeat_until: repeatUntilSchema,
  try_catch: tryCatchSchema,
  fallback_block: fallbackBlockSchema,
  break_loop: breakLoopSchema,
  continue_loop: continueLoopSchema,
  stop_workflow: stopWorkflowSchema,
  transform_variable: transformVariableSchema,
  update_number_variable: updateNumberVariableSchema,
  set_number_variable: setNumberVariableSchema,
  generate_random_number: generateRandomNumberSchema,
  parse_text_to_number: parseTextToNumberSchema,
  math_operation: mathOperationSchema,
  round_number: roundNumberSchema,
  format_number: formatNumberSchema,
  compare_numbers: compareNumbersSchema,
  check_number_range: checkNumberRangeSchema,
  check_number_property: checkNumberPropertySchema,
  update_text_variable: updateTextVariableSchema,
  update_flag_variable: updateFlagVariableSchema,
  set_boolean_variable: setBooleanVariableSchema,
  generate_random_boolean: generateRandomBooleanSchema,
  parse_to_boolean: parseToBooleanSchema,
  boolean_logical_op: booleanLogicalOpSchema,
  compare_booleans: compareBooleansSchema,
  check_boolean_property: checkBooleanPropertySchema,
  set_text_variable: setTextVariableSchema,
  append_text: appendTextSchema,
  prepend_text: prependTextSchema,
  replace_text: replaceTextSchema,
  trim_text: trimTextSchema,
  change_text_case: changeTextCaseSchema,
  slice_text: sliceTextSchema,
  regex_extract: regexExtractSchema,
  get_text_length: getTextLengthSchema,
  check_text_empty: checkTextEmptySchema,
  check_text_contains: checkTextContainsSchema,
  check_text_regex_matches: checkTextRegexMatchesSchema,
  update_list_variable: updateListVariableSchema,
  create_empty_list: createEmptyListSchema,
  create_list_manual: createListManualSchema,
  split_text_to_list: splitTextToListSchema,
  generate_number_range: generateNumberRangeSchema,
  add_to_list: addToListSchema,
  remove_from_list_by_index: removeFromListByIndexSchema,
  remove_from_list_by_value: removeFromListByValueSchema,
  merge_lists: mergeListsSchema,
  get_list_item: getListItemSchema,
  get_list_length: getListLengthSchema,
  slice_list: sliceListSchema,
  join_list: joinListSchema,
  filter_list: filterListSchema,
  map_list_property: mapListPropertySchema,
  sort_reverse_list: sortReverseListSchema,
  execute_list_script: executeListScriptSchema,
  check_list_empty: checkListEmptySchema,
  check_list_contains: checkListContainsSchema,
  check_list_any_match: checkListAnyMatchSchema,
  check_list_all_match: checkListAllMatchSchema,
  create_empty_object: createEmptyObjectSchema,
  create_object_manual: createObjectManualSchema,
  parse_json_to_object: parseJsonToObjectSchema,
  set_object_property: setObjectPropertySchema,
  remove_object_property: removeObjectPropertySchema,
  merge_objects: mergeObjectsSchema,
  rename_object_property: renameObjectPropertySchema,
  get_object_property: getObjectPropertySchema,
  get_object_keys: getObjectKeysSchema,
  get_object_values: getObjectValuesSchema,
  stringify_object: stringifyObjectSchema,
  execute_object_script: executeObjectScriptSchema,
  check_object_key_exists: checkObjectKeyExistsSchema,
  check_object_empty: checkObjectEmptySchema,
  assert_output: assertOutputSchema,
  domain_allowlist: domainAllowlistSchema,
  set_cookie: setCookieSchema,
  clear_cookies: clearCookiesSchema,
  set_viewport: setViewportSchema,
  set_geolocation: setGeolocationSchema,
  set_extra_headers: setExtraHeadersSchema,
  grant_permission: grantPermissionSchema,
  execute_js: executeJsSchema,
  wait_for_request: waitForRequestSchema,
  wait_for_response: waitForResponseSchema,
  block_request: blockRequestSchema,
  mock_response: mockResponseSchema,
  set_local_storage: setLocalStorageSchema,
  set_session_storage: setSessionStorageSchema,
  get_current_url: getCurrentUrlSchema,
  extract_text_content: extractTextContentSchema,
  extract_inner_html: extractInnerHtmlSchema,
  extract_outer_html: extractOuterHtmlSchema,
  extract_all_attributes: extractAllAttributesSchema,
  extract_data_attributes: extractDataAttributesSchema,
  extract_class_list: extractClassListSchema,
  extract_descendant_attributes: extractDescendantAttributesSchema,
  extract_select_value: extractSelectValueSchema,
  extract_select_options: extractSelectOptionsSchema,
  extract_checkbox_state: extractCheckboxStateSchema,
  extract_form_data: extractFormDataSchema,
  extract_table_headers: extractTableHeadersSchema,
  extract_dimensions: extractDimensionsSchema,
  extract_visibility: extractVisibilitySchema,
  extract_element_state: extractElementStateSchema,
  check_element_exists: checkElementExistsSchema,
  extract_computed_style: extractComputedStyleSchema,
  extract_table_row: extractTableRowSchema,
  extract_table_column: extractTableColumnSchema,
  extract_table_cell: extractTableCellSchema,
  extract_list_attributes: extractListAttributesSchema,
  extract_structured_list: extractStructuredListSchema,
  get_page_title: getPageTitleSchema,
  extract_page_links: extractPageLinksSchema,
  get_meta_content: getMetaContentSchema,
  extract_numbers: extractNumbersSchema,
  extract_urls: extractUrlsSchema,
  extract_emails: extractEmailsSchema,
  read_text_file: readTextFileSchema,
  parse_csv_excel: parseCsvExcelSchema,
  write_csv_excel: writeCsvExcelSchema,
  file_operation: fileOperationSchema,
  http_request: httpRequestSchema,
  date_time_operation: dateTimeOperationSchema,
  crypto_operation: cryptoOperationSchema,
  switch_frame: switchFrameSchema,
  switch_to_parent_frame: switchToParentFrameSchema,
};

export type ValidationResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: "no_schema" | "invalid"; issues: z.ZodIssue[] };

/**
 * Parse a workflow node's action config into a typed Action Config.
 *
 * This is the **shape** tier: it answers "can this persisted JSON be read as an
 * Action Config of its declared type?" and nothing more. It deliberately accepts
 * configs that are not yet runnable — a freshly dropped `click` node has an
 * empty element target, and quarantining those on load would destroy work in
 * progress.
 *
 * Whether a config is *complete enough to run* is the other tier of the same
 * interface: `validateActionConfig` in `../validation.js`. That one is the
 * authority, and it is what the authoring and compile paths enforce. The two
 * tiers are asymmetric on purpose; `actionConfigTiers.test.ts` pins the
 * asymmetry so it cannot drift into an accident.
 */
export function parseActionConfigShape(node: GraphNode): ValidationResult<ActionConfig> {
  const config = node.config as { type?: unknown } | null;
  if (!config || typeof config.type !== "string") {
    return { ok: false, reason: "no_schema", issues: [] };
  }
  const schema = actionSchemas[config.type as ActionType];
  if (!schema) return { ok: false, reason: "no_schema", issues: [] };
  const parsed = schema.safeParse(node.config);
  return parsed.success
    ? { ok: true, data: parsed.data as ActionConfig }
    : { ok: false, reason: "invalid", issues: parsed.error.issues };
}

