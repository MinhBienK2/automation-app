// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../src/types/workflow";
import {
  assertActionExecutorCoverage,
  createActionExecutorMap,
  executeRegisteredAction,
} from "./execution";

describe("backend action execution registry", () => {
  test("dispatches action configs through a registry-covered execution handler", async () => {
    const calls: string[] = [];
    const executors = createActionExecutorMap({
      navigate: async (action) => calls.push(`navigate:${action.config.url}`),
      wait: async () => calls.push("wait"),
      random_wait: async () => calls.push("random_wait"),
      input_text: async () => calls.push("input_text"),
      clear_input: async () => calls.push("clear_input"),
      click: async () => calls.push("click"),
      find_element: async () => calls.push("find_element"),
      scroll: async () => calls.push("scroll"),
      select_option: async () => calls.push("select_option"),
      press_key: async () => calls.push("press_key"),
      hotkey: async () => calls.push("hotkey"),
      hover: async () => calls.push("hover"),
      double_click: async () => calls.push("double_click"),
      right_click: async () => calls.push("right_click"),
      drag_and_drop: async () => calls.push("drag_and_drop"),
      focus_element: async () => calls.push("focus_element"),
      blur_element: async () => calls.push("blur_element"),
      type_sequence: async () => calls.push("type_sequence"),
      set_clipboard: async () => calls.push("set_clipboard"),
      paste_clipboard: async () => calls.push("paste_clipboard"),
      check: async () => calls.push("check"),
      uncheck: async () => calls.push("uncheck"),
      toggle_checkbox: async () => calls.push("toggle_checkbox"),
      select_radio: async () => calls.push("select_radio"),
      upload_file: async () => calls.push("upload_file"),
      submit_form: async () => calls.push("submit_form"),
      select_custom_option: async () => calls.push("select_custom_option"),
      set_contenteditable: async () => calls.push("set_contenteditable"),
      extract_text: async () => calls.push("extract_text"),
      extract_attribute: async () => calls.push("extract_attribute"),
      extract_input_value: async () => calls.push("extract_input_value"),
      extract_table: async () => calls.push("extract_table"),
      extract_list: async () => calls.push("extract_list"),
      count_elements: async () => calls.push("count_elements"),
      extract_regex_matches: async () => calls.push("extract_regex_matches"),
      take_screenshot: async () => calls.push("take_screenshot"),
      write_text_file: async () => calls.push("write_text_file"),
      go_back: async () => calls.push("go_back"),
      go_forward: async () => calls.push("go_forward"),
      reload: async () => calls.push("reload"),
      open_new_tab: async () => calls.push("open_new_tab"),
      switch_tab: async () => calls.push("switch_tab"),
      close_tab: async () => calls.push("close_tab"),
      accept_dialog: async () => calls.push("accept_dialog"),
      dismiss_dialog: async () => calls.push("dismiss_dialog"),
      wait_for_download: async () => calls.push("wait_for_download"),
      set_variable: async () => calls.push("set_variable"),
      set_json_variables: async () => calls.push("set_json_variables"),
      assert_element: async () => calls.push("assert_element"),
      assert_text: async () => calls.push("assert_text"),
      graph_noop: async () => calls.push("graph_noop"),
      if_condition: async () => calls.push("if_condition"),
      router_condition: async () => calls.push("router_condition"),
      random_choice: async () => calls.push("random_choice"),
      repeat_times: async () => calls.push("repeat_times"),
      repeat_for_each: async () => calls.push("repeat_for_each"),
      retry_block: async () => calls.push("retry_block"),
      switch_condition: async () => calls.push("switch_condition"),
      while_loop: async () => calls.push("while_loop"),
      repeat_until: async () => calls.push("repeat_until"),
      try_catch: async () => calls.push("try_catch"),
      fallback_block: async () => calls.push("fallback_block"),
      break_loop: async () => calls.push("break_loop"),
      continue_loop: async () => calls.push("continue_loop"),
      stop_workflow: async () => calls.push("stop_workflow"),
      transform_variable: async () => calls.push("transform_variable"),
      update_number_variable: async () => calls.push("update_number_variable"),
      update_text_variable: async () => calls.push("update_text_variable"),
      update_flag_variable: async () => calls.push("update_flag_variable"),
      update_list_variable: async () => calls.push("update_list_variable"),
      update_object_variable: async () => calls.push("update_object_variable"),
      assert_output: async () => calls.push("assert_output"),
      domain_allowlist: async () => calls.push("domain_allowlist"),
      set_cookie: async () => calls.push("set_cookie"),
      clear_cookies: async () => calls.push("clear_cookies"),
      set_viewport: async () => calls.push("set_viewport"),
      set_geolocation: async () => calls.push("set_geolocation"),
      set_extra_headers: async () => calls.push("set_extra_headers"),
      grant_permission: async () => calls.push("grant_permission"),
      execute_js: async (action) => calls.push(`execute_js:${action.config.script}`),
      wait_for_request: async () => calls.push("wait_for_request"),
      wait_for_response: async () => calls.push("wait_for_response"),
      block_request: async () => calls.push("block_request"),
      mock_response: async () => calls.push("mock_response"),
      set_local_storage: async () => calls.push("set_local_storage"),
      set_session_storage: async () => calls.push("set_session_storage"),
      get_current_url: async () => calls.push("get_current_url"),
      evaluate_logic: async () => calls.push("evaluate_logic"),
      evaluate_expression: async () => calls.push("evaluate_expression"),
      quarantined: async () => calls.push("quarantined"),
    });

    assertActionExecutorCoverage(executors);
    await executeRegisteredAction(executors, {
      type: "execute_js",
      config: { script: "return 42", output_name: "answer" },
    });

    expect(calls).toEqual(["execute_js:return 42"]);
  });

  test("rejects unknown action configs before handler lookup", async () => {
    const executors = createActionExecutorMap({} as never);

    await expect(
      executeRegisteredAction(executors, {
        type: "legacy_action",
        config: {},
      } as ActionConfig),
    ).rejects.toThrow("Unsupported action type: legacy_action");
  });

  test("reports registered actions missing execution handlers", () => {
    expect(() => assertActionExecutorCoverage({ navigate: async () => undefined })).toThrow(
      "Action wait is registered without an execution handler",
    );
  });
});
