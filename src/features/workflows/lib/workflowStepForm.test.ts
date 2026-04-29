import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../types/workflow";
import { updateActionConfigField } from "./workflowStepForm";

describe("workflow step form config helpers", () => {
  test("updates wait duration as a number", () => {
    const config: ActionConfig = {
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    };

    expect(updateActionConfigField(config, "duration_ms", "2500")).toEqual({
      type: "wait",
      config: { condition: "duration", duration_ms: 2500 },
    });
  });

  test("updates scroll direction and pixels with typed values", () => {
    const config: ActionConfig = {
      type: "scroll",
      config: { direction: "down", pixels: 300 },
    };

    expect(updateActionConfigField(config, "direction", "up")).toEqual({
      type: "scroll",
      config: { direction: "up", pixels: 300 },
    });
    expect(updateActionConfigField(config, "pixels", "800")).toEqual({
      type: "scroll",
      config: { direction: "down", pixels: 800 },
    });
  });

  test("updates advanced scroll fields without dropping legacy fields", () => {
    const config: ActionConfig = {
      type: "scroll",
      config: { direction: "down", pixels: 300 },
    };

    expect(updateActionConfigField(config, "mode", "until_visible")).toEqual({
      type: "scroll",
      config: { mode: "until_visible", direction: "down", pixels: 300 },
    });
    expect(updateActionConfigField(config, "xpath", "//*[@id='target']")).toEqual({
      type: "scroll",
      config: {
        direction: "down",
        pixels: 300,
        xpath: "//*[@id='target']",
      },
    });
    expect(updateActionConfigField(config, "max_attempts", "5")).toEqual({
      type: "scroll",
      config: { direction: "down", pixels: 300, max_attempts: 5 },
    });
  });

  test("updates advanced click fields without dropping the xpath", () => {
    const config: ActionConfig = {
      type: "click",
      config: { xpath: "//*[@id='submit']" },
    };

    expect(updateActionConfigField(config, "click_count", "2")).toEqual({
      type: "click",
      config: { xpath: "//*[@id='submit']", click_count: 2 },
    });
    expect(updateActionConfigField(config, "iframe_xpath", "//*[@id='frame']")).toEqual({
      type: "click",
      config: {
        xpath: "//*[@id='submit']",
        iframe_xpath: "//*[@id='frame']",
      },
    });
    expect(updateActionConfigField(config, "mode", "force_dom")).toEqual({
      type: "click",
      config: { xpath: "//*[@id='submit']", mode: "force_dom" },
    });
  });

  test("updates new taxonomy action fields without dropping existing config", () => {
    const inputConfig: ActionConfig = {
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "old",
        clear_before_input: true,
      },
    };
    const waitConfig: ActionConfig = {
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    };
    const hotkeyConfig: ActionConfig = {
      type: "hotkey",
      config: { keys: ["Control"] },
    };

    expect(updateActionConfigField(inputConfig, "typing_mode", "type")).toEqual({
      type: "input_text",
      config: {
        xpath: "//*[@name='email']",
        text: "old",
        clear_before_input: true,
        typing_mode: "type",
      },
    });
    expect(updateActionConfigField(waitConfig, "duration_ms", "2500")).toEqual({
      type: "wait",
      config: { condition: "duration", duration_ms: 2500 },
    });
    expect(updateActionConfigField(hotkeyConfig, "keys", "Control+S")).toEqual({
      type: "hotkey",
      config: { keys: ["Control", "S"] },
    });
  });

  test("updates phase one human interaction configs with typed values", () => {
    const typeSequenceConfig: ActionConfig = {
      type: "type_sequence",
      config: {
        xpath: "//*[@name='search']",
        text: "old",
      },
    };
    const dragConfig: ActionConfig = {
      type: "drag_and_drop",
      config: {
        source_xpath: "//*[@id='source']",
        target_xpath: "//*[@id='target']",
      },
    };
    const setClipboardConfig: ActionConfig = {
      type: "set_clipboard",
      config: { text: "old" },
    };
    const pasteClipboardConfig: ActionConfig = {
      type: "paste_clipboard",
      config: { xpath: "//*[@name='notes']" },
    };

    expect(updateActionConfigField(typeSequenceConfig, "delay_ms", "25")).toEqual({
      type: "type_sequence",
      config: {
        xpath: "//*[@name='search']",
        text: "old",
        delay_ms: 25,
      },
    });
    expect(updateActionConfigField(dragConfig, "source_xpath", "//*[@id='card']")).toEqual({
      type: "drag_and_drop",
      config: {
        source_xpath: "//*[@id='card']",
        target_xpath: "//*[@id='target']",
      },
    });
    expect(updateActionConfigField(setClipboardConfig, "text", "new text")).toEqual({
      type: "set_clipboard",
      config: { text: "new text" },
    });
    expect(updateActionConfigField(pasteClipboardConfig, "timeout_ms", "3000")).toEqual({
      type: "paste_clipboard",
      config: {
        xpath: "//*[@name='notes']",
        timeout_ms: 3000,
      },
    });
  });

  test("updates phase two form and file configs with typed values", () => {
    const uploadConfig: ActionConfig = {
      type: "upload_file",
      config: {
        xpath: "//*[@id='file']",
        files: ["/tmp/a.txt"],
      },
    };
    const submitConfig: ActionConfig = {
      type: "submit_form",
      config: {},
    };
    const customSelectConfig: ActionConfig = {
      type: "select_custom_option",
      config: {
        trigger_xpath: "//*[@role='combobox']",
        option_text: "Old",
      },
    };
    const editableConfig: ActionConfig = {
      type: "set_contenteditable",
      config: {
        xpath: "//*[@contenteditable='true']",
        text: "Old",
        clear_before_input: true,
      },
    };

    expect(updateActionConfigField(uploadConfig, "files", "/tmp/a.txt\n/tmp/b.txt")).toEqual({
      type: "upload_file",
      config: {
        xpath: "//*[@id='file']",
        files: ["/tmp/a.txt", "/tmp/b.txt"],
      },
    });
    expect(updateActionConfigField(submitConfig, "xpath", "//*[@id='login']")).toEqual({
      type: "submit_form",
      config: { xpath: "//*[@id='login']" },
    });
    expect(updateActionConfigField(customSelectConfig, "option_text", "Vietnam")).toEqual({
      type: "select_custom_option",
      config: {
        trigger_xpath: "//*[@role='combobox']",
        option_text: "Vietnam",
      },
    });
    expect(updateActionConfigField(editableConfig, "clear_before_input", "false")).toEqual({
      type: "set_contenteditable",
      config: {
        xpath: "//*[@contenteditable='true']",
        text: "Old",
        clear_before_input: false,
      },
    });
  });

  test("updates phase four data capture configs with typed values", () => {
    const extractTextConfig: ActionConfig = {
      type: "extract_text",
      config: {
        xpath: "//*[@id='title']",
        output_name: "title",
      },
    };
    const extractAttributeConfig: ActionConfig = {
      type: "extract_attribute",
      config: {
        xpath: "//*[@id='link']",
        attribute: "href",
        output_name: "link_href",
      },
    };
    const screenshotConfig: ActionConfig = {
      type: "take_screenshot",
      config: {
        path: "/tmp/old.png",
        output_name: "screenshot_path",
        full_page: false,
      },
    };

    expect(updateActionConfigField(extractTextConfig, "output_name", "page_title")).toEqual({
      type: "extract_text",
      config: {
        xpath: "//*[@id='title']",
        output_name: "page_title",
      },
    });
    expect(updateActionConfigField(extractAttributeConfig, "attribute", "data-id")).toEqual({
      type: "extract_attribute",
      config: {
        xpath: "//*[@id='link']",
        attribute: "data-id",
        output_name: "link_href",
      },
    });
    expect(updateActionConfigField(screenshotConfig, "full_page", "true")).toEqual({
      type: "take_screenshot",
      config: {
        path: "/tmp/old.png",
        output_name: "screenshot_path",
        full_page: true,
      },
    });
    expect(updateActionConfigField(screenshotConfig, "path", "/tmp/new.png")).toEqual({
      type: "take_screenshot",
      config: {
        path: "/tmp/new.png",
        output_name: "screenshot_path",
        full_page: false,
      },
    });
  });

  test("updates phase three browser context configs with typed values", () => {
    const openTabConfig: ActionConfig = {
      type: "open_new_tab",
      config: { url: "https://example.com" },
    };
    const switchTabConfig: ActionConfig = {
      type: "switch_tab",
      config: { index: 0 },
    };
    const closeTabConfig: ActionConfig = {
      type: "close_tab",
      config: {},
    };

    expect(updateActionConfigField(openTabConfig, "url", "https://example.org")).toEqual({
      type: "open_new_tab",
      config: { url: "https://example.org" },
    });
    expect(updateActionConfigField(switchTabConfig, "index", "1")).toEqual({
      type: "switch_tab",
      config: { index: 1 },
    });
    expect(updateActionConfigField(closeTabConfig, "index", "2")).toEqual({
      type: "close_tab",
      config: { index: 2 },
    });
  });

  test("updates phase three frame dialog and download configs with typed values", () => {
    const frameConfig: ActionConfig = {
      type: "switch_frame",
      config: {},
    };
    const acceptConfig: ActionConfig = {
      type: "accept_dialog",
      config: {},
    };
    const downloadDirConfig: ActionConfig = {
      type: "set_download_directory",
      config: { path: "/tmp/old" },
    };
    const waitDownloadConfig: ActionConfig = {
      type: "wait_for_download",
      config: { output_name: "download_path" },
    };

    expect(updateActionConfigField(frameConfig, "xpath", "//*[@id='frame']")).toEqual({
      type: "switch_frame",
      config: { xpath: "//*[@id='frame']" },
    });
    expect(updateActionConfigField(frameConfig, "xpath", "")).toEqual({
      type: "switch_frame",
      config: { xpath: null },
    });
    expect(updateActionConfigField(acceptConfig, "prompt_text", "approved")).toEqual({
      type: "accept_dialog",
      config: { prompt_text: "approved" },
    });
    expect(updateActionConfigField(downloadDirConfig, "path", "/tmp/new")).toEqual({
      type: "set_download_directory",
      config: { path: "/tmp/new" },
    });
    expect(updateActionConfigField(waitDownloadConfig, "timeout_ms", "3000")).toEqual({
      type: "wait_for_download",
      config: { output_name: "download_path", timeout_ms: 3000 },
    });
  });

  test("updates phase five variable assertion and control configs with typed values", () => {
    const setVariableConfig: ActionConfig = {
      type: "set_variable",
      config: { name: "customer", value: "Old" },
    };
    const assertTextConfig: ActionConfig = {
      type: "assert_text",
      config: { text: "Saved", match_mode: "contains" },
    };
    const assertElementConfig: ActionConfig = {
      type: "assert_element",
      config: { xpath: "//*[@id='save']", state: "visible" },
    };
    const repeatTimesConfig: ActionConfig = {
      type: "repeat_times",
      config: { times: 1, steps: [] },
    };
    const stopWorkflowConfig: ActionConfig = {
      type: "stop_workflow",
      config: { status: "success" },
    };

    expect(updateActionConfigField(setVariableConfig, "value", "Ada")).toEqual({
      type: "set_variable",
      config: { name: "customer", value: "Ada" },
    });
    expect(updateActionConfigField(assertTextConfig, "xpath", "//*[@id='status']")).toEqual({
      type: "assert_text",
      config: { text: "Saved", match_mode: "contains", xpath: "//*[@id='status']" },
    });
    expect(updateActionConfigField(assertElementConfig, "timeout_ms", "3000")).toEqual({
      type: "assert_element",
      config: { xpath: "//*[@id='save']", state: "visible", timeout_ms: 3000 },
    });
    expect(updateActionConfigField(repeatTimesConfig, "times", "2")).toEqual({
      type: "repeat_times",
      config: { times: 2, steps: [] },
    });
    expect(updateActionConfigField(stopWorkflowConfig, "reason", "Already complete")).toEqual({
      type: "stop_workflow",
      config: { status: "success", reason: "Already complete" },
    });
  });

  test("updates phase six session profile cookie and secret configs with typed values", () => {
    const profileConfig: ActionConfig = {
      type: "use_profile",
      config: { name: "account-a" },
    };
    const sessionConfig: ActionConfig = {
      type: "save_session",
      config: { path: "/tmp/old.json" },
    };
    const cookieConfig: ActionConfig = {
      type: "set_cookie",
      config: { name: "token", value: "old" },
    };
    const secretConfig: ActionConfig = {
      type: "set_secret",
      config: { name: "password", value: "old" },
    };

    expect(updateActionConfigField(profileConfig, "name", "account-b")).toEqual({
      type: "use_profile",
      config: { name: "account-b" },
    });
    expect(updateActionConfigField(sessionConfig, "path", "/tmp/session.json")).toEqual({
      type: "save_session",
      config: { path: "/tmp/session.json" },
    });
    expect(updateActionConfigField(cookieConfig, "domain", "example.com")).toEqual({
      type: "set_cookie",
      config: { name: "token", value: "old", domain: "example.com" },
    });
    expect(updateActionConfigField(secretConfig, "value", "new-secret")).toEqual({
      type: "set_secret",
      config: { name: "password", value: "new-secret" },
    });
  });

  test("updates phase seven network device configs with typed values", () => {
    const proxyConfig: ActionConfig = {
      type: "use_proxy",
      config: { server: "http://old:8080", username: null, password: null },
    };
    const viewportConfig: ActionConfig = {
      type: "set_viewport",
      config: {
        width: 1280,
        height: 720,
        device_scale_factor: 1,
        mobile: false,
        touch: false,
      },
    };
    const headersConfig: ActionConfig = {
      type: "set_extra_headers",
      config: { headers: [{ name: "X-Old", value: "0" }] },
    };
    const permissionConfig: ActionConfig = {
      type: "grant_permission",
      config: { origin: null, permissions: ["geolocation"] },
    };

    expect(updateActionConfigField(proxyConfig, "server", "socks5://127.0.0.1:9050")).toEqual({
      type: "use_proxy",
      config: { server: "socks5://127.0.0.1:9050", username: null, password: null },
    });
    expect(updateActionConfigField(proxyConfig, "username", "agent")).toEqual({
      type: "use_proxy",
      config: { server: "http://old:8080", username: "agent", password: null },
    });
    expect(updateActionConfigField(viewportConfig, "width", "390")).toEqual({
      type: "set_viewport",
      config: {
        width: 390,
        height: 720,
        device_scale_factor: 1,
        mobile: false,
        touch: false,
      },
    });
    expect(updateActionConfigField(viewportConfig, "mobile", "true")).toEqual({
      type: "set_viewport",
      config: {
        width: 1280,
        height: 720,
        device_scale_factor: 1,
        mobile: true,
        touch: false,
      },
    });
    expect(updateActionConfigField(headersConfig, "headers", "X-WAM-Phase: seven")).toEqual({
      type: "set_extra_headers",
      config: { headers: [{ name: "X-WAM-Phase", value: "seven" }] },
    });
    expect(updateActionConfigField(permissionConfig, "permissions", "geolocation\nnotifications")).toEqual({
      type: "grant_permission",
      config: { origin: null, permissions: ["geolocation", "notifications"] },
    });
  });

  test("updates phase eight human verification configs with typed values", () => {
    const detectConfig: ActionConfig = {
      type: "detect_challenge",
      config: {
        output_name: "challenge_found",
        patterns: ["captcha"],
      },
    };
    const pauseConfig: ActionConfig = {
      type: "pause_for_human",
      config: { reason: "Solve challenge", timeout_ms: 1000 },
    };
    const resumeConfig: ActionConfig = {
      type: "resume_when_condition",
      config: {
        condition: { kind: "text_visible", text: "Welcome" },
        timeout_ms: 3000,
      },
    };

    expect(updateActionConfigField(detectConfig, "patterns", "captcha\nverify you are human")).toEqual({
      type: "detect_challenge",
      config: {
        output_name: "challenge_found",
        patterns: ["captcha", "verify you are human"],
      },
    });
    expect(updateActionConfigField(detectConfig, "timeout_ms", "1500")).toEqual({
      type: "detect_challenge",
      config: {
        output_name: "challenge_found",
        patterns: ["captcha"],
        timeout_ms: 1500,
      },
    });
    expect(updateActionConfigField(pauseConfig, "reason", "Manual verification")).toEqual({
      type: "pause_for_human",
      config: { reason: "Manual verification", timeout_ms: 1000 },
    });
    expect(updateActionConfigField(resumeConfig, "timeout_ms", "5000")).toEqual({
      type: "resume_when_condition",
      config: {
        condition: { kind: "text_visible", text: "Welcome" },
        timeout_ms: 5000,
      },
    });
  });

  test("updates phase nine reliability configs with typed values", () => {
    const fallbackConfig: ActionConfig = {
      type: "fallback_selector",
      config: {
        output_name: "target_xpath",
        xpaths: ["//*[@id='old']"],
      },
    };
    const retryConfig: ActionConfig = {
      type: "retry_step",
      config: {
        max_attempts: 2,
        delay_ms: 100,
        step: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
      },
    };
    const checkpointConfig: ActionConfig = {
      type: "checkpoint",
      config: { name: "after_submit", screenshot_path: null },
    };

    expect(updateActionConfigField(fallbackConfig, "xpaths", "//*[@id='missing']\n//*[@id='real']")).toEqual({
      type: "fallback_selector",
      config: {
        output_name: "target_xpath",
        xpaths: ["//*[@id='missing']", "//*[@id='real']"],
      },
    });
    expect(updateActionConfigField(fallbackConfig, "timeout_ms", "1500")).toEqual({
      type: "fallback_selector",
      config: {
        output_name: "target_xpath",
        xpaths: ["//*[@id='old']"],
        timeout_ms: 1500,
      },
    });
    expect(updateActionConfigField(retryConfig, "max_attempts", "4")).toEqual({
      type: "retry_step",
      config: {
        max_attempts: 4,
        delay_ms: 100,
        step: { type: "wait", config: { condition: "duration", duration_ms: 100 } },
      },
    });
    expect(updateActionConfigField(checkpointConfig, "screenshot_path", "/tmp/checkpoint.png")).toEqual({
      type: "checkpoint",
      config: { name: "after_submit", screenshot_path: "/tmp/checkpoint.png" },
    });
  });

  test("updates phase eleven advanced runtime configs with typed values", () => {
    const executeConfig: ActionConfig = {
      type: "execute_js",
      config: {
        script: "return document.title;",
        output_name: "title",
        timeout_ms: 1000,
      },
    };
    const waitResponseConfig: ActionConfig = {
      type: "wait_for_response",
      config: { url_contains: "/api/old", status: 200, timeout_ms: 1000 },
    };
    const blockConfig: ActionConfig = {
      type: "block_request",
      config: { url_patterns: ["analytics"] },
    };
    const mockConfig: ActionConfig = {
      type: "mock_response",
      config: {
        url_contains: "/api/mock",
        status: 200,
        body: "{}",
        content_type: "application/json",
      },
    };
    const storageConfig: ActionConfig = {
      type: "set_local_storage",
      config: { key: "token", value: "old" },
    };

    expect(updateActionConfigField(executeConfig, "script", "return 42;")).toEqual({
      type: "execute_js",
      config: { script: "return 42;", output_name: "title", timeout_ms: 1000 },
    });
    expect(updateActionConfigField(executeConfig, "output_name", "")).toEqual({
      type: "execute_js",
      config: { script: "return document.title;", output_name: null, timeout_ms: 1000 },
    });
    expect(updateActionConfigField(waitResponseConfig, "status", "201")).toEqual({
      type: "wait_for_response",
      config: { url_contains: "/api/old", status: 201, timeout_ms: 1000 },
    });
    expect(updateActionConfigField(blockConfig, "url_patterns", "analytics\ntracking")).toEqual({
      type: "block_request",
      config: { url_patterns: ["analytics", "tracking"] },
    });
    expect(updateActionConfigField(mockConfig, "body", "{\"ok\":true}")).toEqual({
      type: "mock_response",
      config: {
        url_contains: "/api/mock",
        status: 200,
        body: "{\"ok\":true}",
        content_type: "application/json",
      },
    });
    expect(updateActionConfigField(storageConfig, "value", "new")).toEqual({
      type: "set_local_storage",
      config: { key: "token", value: "new" },
    });
  });
});
