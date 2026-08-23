// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../../../actions/execution.js";
import { createRunnerActionExecutors } from "../../runnerActionExecutors.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../../testSupport/executorFixtures.js";
describe("runnerActionExecutors", () => {
  test("executes new granular text processing actions", async () => {
    const runtime = minimalRuntime({
      outputs: {
        txt: "hello",
        empty_var: "",
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // set_text_variable
    await executeRegisteredAction(executors, {
      type: "set_text_variable",
      config: { output_name: "my_str", value: "hello {{txt}}" },
    } as any);
    expect(runtime.outputs.my_str).toBe("hello hello");

    // append_text
    await executeRegisteredAction(executors, {
      type: "append_text",
      config: { name: "my_str", value: " world" },
    } as any);
    expect(runtime.outputs.my_str).toBe("hello hello world");

    // prepend_text
    await executeRegisteredAction(executors, {
      type: "prepend_text",
      config: { name: "my_str", value: "start: " },
    } as any);
    expect(runtime.outputs.my_str).toBe("start: hello hello world");

    // replace_text
    await executeRegisteredAction(executors, {
      type: "replace_text",
      config: { name: "my_str", search_pattern: "hello", replacement: "hi" },
    } as any);
    expect(runtime.outputs.my_str).toBe("start: hi hi world");

    // trim_text
    runtime.outputs.my_str = "  some text  ";
    await executeRegisteredAction(executors, {
      type: "trim_text",
      config: { name: "my_str" },
    } as any);
    expect(runtime.outputs.my_str).toBe("some text");

    // change_text_case - upper
    await executeRegisteredAction(executors, {
      type: "change_text_case",
      config: { name: "my_str", to_case: "upper" },
    } as any);
    expect(runtime.outputs.my_str).toBe("SOME TEXT");

    // change_text_case - lower
    await executeRegisteredAction(executors, {
      type: "change_text_case",
      config: { name: "my_str", to_case: "lower" },
    } as any);
    expect(runtime.outputs.my_str).toBe("some text");

    // slice_text
    await executeRegisteredAction(executors, {
      type: "slice_text",
      config: { source: "my_str", start: 0, end: 4, output_name: "sliced" },
    } as any);
    expect(runtime.outputs.sliced).toBe("some");

    // regex_extract
    runtime.outputs.my_str = "user ID: 12345";
    await executeRegisteredAction(executors, {
      type: "regex_extract",
      config: { source: "my_str", pattern: "ID: (\\d+)", group_index: 1, output_name: "extracted" },
    } as any);
    expect(runtime.outputs.extracted).toBe("12345");

    // get_text_length
    runtime.outputs.my_str = "abc";
    await executeRegisteredAction(executors, {
      type: "get_text_length",
      config: { source: "my_str", output_name: "len" },
    } as any);
    expect(runtime.outputs.len).toBe(3);

    // check_text_empty
    await executeRegisteredAction(executors, {
      type: "check_text_empty",
      config: { source: "empty_var", output_name: "is_empty" },
    } as any);
    expect(runtime.outputs.is_empty).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_text_empty",
      config: { source: "txt", output_name: "is_empty_2" },
    } as any);
    expect(runtime.outputs.is_empty_2).toBe(false);

    // check_text_contains
    await executeRegisteredAction(executors, {
      type: "check_text_contains",
      config: { source: "txt", substring: "ell", output_name: "contains_ell" },
    } as any);
    expect(runtime.outputs.contains_ell).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_text_contains",
      config: { source: "txt", substring: "world", output_name: "contains_world" },
    } as any);
    expect(runtime.outputs.contains_world).toBe(false);

    // check_text_regex_matches
    await executeRegisteredAction(executors, {
      type: "check_text_regex_matches",
      config: { source: "txt", pattern: "^h.*o$", output_name: "matches_regex" },
    } as any);
    expect(runtime.outputs.matches_regex).toBe(true);
  });
});
