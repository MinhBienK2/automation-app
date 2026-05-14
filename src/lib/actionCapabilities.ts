import type { ActionType } from "../types/workflow.js";

export type ActionCapability =
  | "implemented"
  | "implemented_partial_requires_validation"
  | "launch_time_only"
  | "compatibility_hidden"
  | "planned_hidden"
  | "unsupported_visible_error";

export const actionCapabilities: Record<ActionType, ActionCapability> = {
  navigate: "implemented",
  wait: "implemented",
  random_wait: "implemented",
  input_text: "implemented_partial_requires_validation",
  clear_input: "implemented_partial_requires_validation",
  click: "implemented_partial_requires_validation",
  scroll: "implemented_partial_requires_validation",
  select_option: "implemented_partial_requires_validation",
  set_checkbox: "compatibility_hidden",
  press_key: "implemented",
  hotkey: "implemented",
  hover: "implemented_partial_requires_validation",
  double_click: "implemented_partial_requires_validation",
  right_click: "implemented_partial_requires_validation",
  drag_and_drop: "implemented_partial_requires_validation",
  focus_element: "implemented_partial_requires_validation",
  blur_element: "implemented_partial_requires_validation",
  type_sequence: "implemented_partial_requires_validation",
  set_clipboard: "implemented",
  paste_clipboard: "implemented_partial_requires_validation",
  check: "implemented_partial_requires_validation",
  uncheck: "implemented_partial_requires_validation",
  toggle_checkbox: "implemented_partial_requires_validation",
  select_radio: "implemented_partial_requires_validation",
  upload_file: "implemented_partial_requires_validation",
  submit_form: "implemented_partial_requires_validation",
  select_custom_option: "implemented_partial_requires_validation",
  set_contenteditable: "implemented_partial_requires_validation",
  extract_text: "implemented_partial_requires_validation",
  extract_attribute: "implemented_partial_requires_validation",
  extract_input_value: "implemented_partial_requires_validation",
  extract_table: "implemented_partial_requires_validation",
  extract_list: "implemented_partial_requires_validation",
  take_screenshot: "implemented",
  go_back: "implemented",
  go_forward: "implemented",
  reload: "implemented",
  open_new_tab: "implemented",
  switch_tab: "implemented",
  close_tab: "implemented",
  switch_frame: "planned_hidden",
  accept_dialog: "implemented_partial_requires_validation",
  dismiss_dialog: "implemented_partial_requires_validation",
  set_download_directory: "launch_time_only",
  wait_for_download: "implemented_partial_requires_validation",
  set_variable: "implemented",
  set_json_variables: "implemented",
  assert_element: "implemented_partial_requires_validation",
  assert_text: "implemented_partial_requires_validation",
  if_condition: "compatibility_hidden",
  repeat_times: "compatibility_hidden",
  repeat_for_each: "compatibility_hidden",
  retry_block: "compatibility_hidden",
  switch_condition: "compatibility_hidden",
  while_loop: "compatibility_hidden",
  repeat_until: "compatibility_hidden",
  try_catch: "compatibility_hidden",
  fallback_block: "compatibility_hidden",
  break_loop: "compatibility_hidden",
  continue_loop: "compatibility_hidden",
  stop_workflow: "compatibility_hidden",
  transform_variable: "compatibility_hidden",
  assert_output: "compatibility_hidden",
  run_subworkflow: "compatibility_hidden",
  domain_allowlist: "compatibility_hidden",
  use_profile: "launch_time_only",
  save_session: "planned_hidden",
  load_session: "planned_hidden",
  set_cookie: "implemented",
  clear_cookies: "implemented",
  set_secret: "planned_hidden",
  use_proxy: "launch_time_only",
  set_user_agent: "launch_time_only",
  set_viewport: "implemented",
  set_geolocation: "implemented",
  set_extra_headers: "implemented",
  grant_permission: "implemented",
  detect_challenge: "planned_hidden",
  pause_for_human: "planned_hidden",
  resume_when_condition: "compatibility_hidden",
  fallback_selector: "planned_hidden",
  retry_step: "planned_hidden",
  checkpoint: "planned_hidden",
  execute_js: "implemented",
  wait_for_request: "implemented",
  wait_for_response: "implemented",
  block_request: "implemented",
  mock_response: "implemented",
  set_local_storage: "implemented",
  set_session_storage: "implemented",
};

export const allActionTypes = Object.keys(actionCapabilities) as ActionType[];

export function isActionVisibleInPrimaryPalette(actionType: ActionType) {
  const capability = actionCapabilities[actionType];
  return (
    capability === "implemented" ||
    capability === "implemented_partial_requires_validation" ||
    capability === "unsupported_visible_error"
  );
}

export function unsupportedInRunReason(actionType: ActionType): string | null {
  const capability = actionCapabilities[actionType];
  if (capability === "launch_time_only") {
    return "configure it in Workflow Settings before launch";
  }
  if (capability === "planned_hidden") {
    return "runtime semantics are not implemented yet";
  }
  if (capability === "unsupported_visible_error") {
    return "runtime support is not implemented yet";
  }
  if (actionType === "run_subworkflow") {
    return "subworkflow lifecycle and recursion handling are not implemented yet";
  }
  return null;
}
