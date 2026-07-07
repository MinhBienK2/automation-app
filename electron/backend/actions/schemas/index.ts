import type { z } from "zod";
import type { ActionConfig, GraphNode } from "../../../../src/types/workflow.js";
import { actionDefinitions } from "../registry.js";

import { navigateSchema } from "./navigate.js";
import { clickSchema } from "./click.js";
import { inputTextSchema } from "./input_text.js";
import { waitSchema } from "./wait.js";
import { extractTextSchema } from "./extract_text.js";
import { ifConditionSchema } from "./if_condition.js";
import { setVariableSchema } from "./set_variable.js";
import { takeScreenshotSchema } from "./take_screenshot.js";
import { executeJsSchema } from "./execute_js.js";

import { clearInputSchema } from "./clear_input.js";
import { selectOptionSchema } from "./select_option.js";
import { checkSchema } from "./check.js";
import { uncheckSchema } from "./uncheck.js";
import { toggleCheckboxSchema } from "./toggle_checkbox.js";
import { selectRadioSchema } from "./select_radio.js";
import { uploadFileSchema } from "./upload_file.js";
import { submitFormSchema } from "./submit_form.js";
import { selectCustomOptionSchema } from "./select_custom_option.js";
import { setContenteditableSchema } from "./set_contenteditable.js";

import { pressKeySchema } from "./press_key.js";
import { hotkeySchema } from "./hotkey.js";
import { typeSequenceSchema } from "./type_sequence.js";
import { setClipboardSchema } from "./set_clipboard.js";
import { pasteClipboardSchema } from "./paste_clipboard.js";
import { hoverSchema } from "./hover.js";
import { doubleClickSchema } from "./double_click.js";
import { rightClickSchema } from "./right_click.js";
import { dragAndDropSchema } from "./drag_and_drop.js";
import { focusElementSchema } from "./focus_element.js";
import { blurElementSchema } from "./blur_element.js";
import { findElementSchema } from "./find_element.js";
import { scrollSchema } from "./scroll.js";

import { extractAttributeSchema } from "./extract_attribute.js";
import { extractInputValueSchema } from "./extract_input_value.js";
import { extractTableSchema } from "./extract_table.js";
import { extractListSchema } from "./extract_list.js";
import { countElementsSchema } from "./count_elements.js";
import { extractRegexMatchesSchema } from "./extract_regex_matches.js";
import { writeTextFileSchema } from "./write_text_file.js";
import { assertElementSchema } from "./assert_element.js";
import { assertTextSchema } from "./assert_text.js";
import { waitForDownloadSchema } from "./wait_for_download.js";
import { getCurrentUrlSchema } from "./get_current_url.js";

import { randomWaitSchema } from "./random_wait.js";
import { acceptDialogSchema } from "./accept_dialog.js";
import { dismissDialogSchema } from "./dismiss_dialog.js";
import { setCookieSchema } from "./set_cookie.js";
import { clearCookiesSchema } from "./clear_cookies.js";
import { setViewportSchema } from "./set_viewport.js";
import { setGeolocationSchema } from "./set_geolocation.js";
import { grantPermissionSchema } from "./grant_permission.js";
import { setLocalStorageSchema } from "./set_local_storage.js";
import { setSessionStorageSchema } from "./set_session_storage.js";
import { setExtraHeadersSchema } from "./set_extra_headers.js";
import { waitForRequestSchema } from "./wait_for_request.js";
import { waitForResponseSchema } from "./wait_for_response.js";
import { blockRequestSchema } from "./block_request.js";
import { mockResponseSchema } from "./mock_response.js";
import { goBackSchema } from "./go_back.js";
import { goForwardSchema } from "./go_forward.js";
import { reloadSchema } from "./reload.js";
import { openNewTabSchema } from "./open_new_tab.js";
import { switchTabSchema } from "./switch_tab.js";
import { closeTabSchema } from "./close_tab.js";

import { graphNoopSchema } from "./graph_noop.js";
import { routerConditionSchema } from "./router_condition.js";
import { randomChoiceSchema } from "./random_choice.js";
import { repeatTimesSchema } from "./repeat_times.js";
import { repeatForEachSchema } from "./repeat_for_each.js";
import { retryBlockSchema } from "./retry_block.js";
import { switchConditionSchema } from "./switch_condition.js";
import { whileLoopSchema } from "./while_loop.js";
import { repeatUntilSchema } from "./repeat_until.js";
import { tryCatchSchema } from "./try_catch.js";
import { fallbackBlockSchema } from "./fallback_block.js";
import { breakLoopSchema } from "./break_loop.js";
import { continueLoopSchema } from "./continue_loop.js";
import { stopWorkflowSchema } from "./stop_workflow.js";
import { transformVariableSchema } from "./transform_variable.js";
import { updateNumberVariableSchema } from "./update_number_variable.js";
import { updateTextVariableSchema } from "./update_text_variable.js";
import { updateFlagVariableSchema } from "./update_flag_variable.js";
import { updateListVariableSchema } from "./update_list_variable.js";
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
} from "./object_actions.js";
import { assertOutputSchema } from "./assert_output.js";
import { domainAllowlistSchema } from "./domain_allowlist.js";
import { setJsonVariablesSchema } from "./set_json_variables.js";
import { checkConditionsSchema } from "./check_conditions.js";
import { calculateValueSchema } from "./calculate_value.js";
import { readTextFileSchema } from "./read_text_file.js";
import { parseCsvExcelSchema } from "./parse_csv_excel.js";
import { writeCsvExcelSchema } from "./write_csv_excel.js";
import { fileOperationSchema } from "./file_operation.js";
import { httpRequestSchema } from "./http_request.js";
import { dateTimeOperationSchema } from "./date_time_operation.js";
import { cryptoOperationSchema } from "./crypto_operation.js";
import { switchFrameSchema } from "./switch_frame.js";
import { switchToParentFrameSchema } from "./switch_to_parent_frame.js";
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
} from "./list_actions.js";

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
  update_text_variable: updateTextVariableSchema,
  update_flag_variable: updateFlagVariableSchema,
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
 * Validate a workflow node's action config against its Zod schema.
 * With all schemas registered (PR 1.4), `no_schema` only fires for
 * truly unknown types — which are now quarantined rather than passed through.
 */
export function validateActionConfig(node: GraphNode): ValidationResult<ActionConfig> {
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

/**
 * Module-load assertion: every registered action type (except `quarantined`)
 * must have a corresponding Zod schema. This prevents schema drift when new
 * action types are added to the registry without a schema.
 */
assertSchemaCoverage();

function assertSchemaCoverage(): void {
  for (const definition of actionDefinitions) {
    if (definition.type === "quarantined") continue;
    if (!actionSchemas[definition.type]) {
      throw new Error(
        `Action type "${definition.type}" is registered without a Zod schema. ` +
          `Add a schema in electron/backend/actions/schemas/ and register it in index.ts.`,
      );
    }
  }
}
