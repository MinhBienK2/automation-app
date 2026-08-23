// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../../../actions/execution.js";
import { createRunnerActionExecutors } from "../../runnerActionExecutors.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../../testSupport/executorFixtures.js";
describe("runnerActionExecutors", () => {
  test("updates list variable via merge and merge_unique operations", async () => {
    const runtime = minimalRuntime({
      outputs: {
        listA: [1, 2],
        listB: [2, 3],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // 1. Merge A and B (with duplicates)
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge", value: "{{listB}}" },
    } as never);
    expect(runtime.outputs.listA).toEqual([1, 2, 2, 3]);

    // Reset listA
    runtime.outputs.listA = [1, 2];

    // 2. Merge A and B uniquely
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge_unique", value: "{{listB}}" },
    } as never);
    expect(runtime.outputs.listA).toEqual([1, 2, 3]);

    // 3. Merge with inline JSON array
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge", value: "[4, 5]", value_type: "json" },
    } as never);
    expect(runtime.outputs.listA).toEqual([1, 2, 3, 4, 5]);

    // 4. Merge unique with inline JSON array and objects
    runtime.outputs.listA = [{ id: 1 }, { id: 2 }];
    await executeRegisteredAction(executors, {
      type: "update_list_variable",
      config: { name: "listA", operation: "merge_unique", value: '[{"id": 2}, {"id": 3}]', value_type: "json" },
    } as never);
    expect(runtime.outputs.listA).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });
  test("new list actions - List: Create", async () => {
    const runtime = minimalRuntime();
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // create_empty_list
    await executeRegisteredAction(executors, {
      type: "create_empty_list",
      config: { output_name: "empty" },
    } as any);
    expect(runtime.outputs.empty).toEqual([]);

    // create_list_manual
    await executeRegisteredAction(executors, {
      type: "create_list_manual",
      config: { output_name: "manual_text", value_type: "text", items: ["hello", "world"] },
    } as any);
    expect(runtime.outputs.manual_text).toEqual(["hello", "world"]);

    await executeRegisteredAction(executors, {
      type: "create_list_manual",
      config: { output_name: "manual_num", value_type: "number", items: ["10", "20.5"] },
    } as any);
    expect(runtime.outputs.manual_num).toEqual([10, 20.5]);

    // split_text_to_list
    runtime.outputs.raw_text = "apple,banana,cherry";
    await executeRegisteredAction(executors, {
      type: "split_text_to_list",
      config: { output_name: "fruits", source_text: "{{raw_text}}", delimiter: "," },
    } as any);
    expect(runtime.outputs.fruits).toEqual(["apple", "banana", "cherry"]);

    // generate_number_range
    await executeRegisteredAction(executors, {
      type: "generate_number_range",
      config: { output_name: "range", start: 1, end: 5, step: 1 },
    } as any);
    expect(runtime.outputs.range).toEqual([1, 2, 3, 4, 5]);

    await executeRegisteredAction(executors, {
      type: "generate_number_range",
      config: { output_name: "range_step", start: 2, end: 8, step: 2 },
    } as any);
    expect(runtime.outputs.range_step).toEqual([2, 4, 6, 8]);
  });

  test("new list actions - List: Update", async () => {
    const runtime = minimalRuntime({
      outputs: {
        my_list: [1, 2, 3],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // add_to_list - end
    await executeRegisteredAction(executors, {
      type: "add_to_list",
      config: { name: "my_list", position: "end", value_type: "number", value: "4" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([1, 2, 3, 4]);

    // add_to_list - start
    await executeRegisteredAction(executors, {
      type: "add_to_list",
      config: { name: "my_list", position: "start", value_type: "number", value: "0" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 1, 2, 3, 4]);

    // add_to_list - unique_end
    await executeRegisteredAction(executors, {
      type: "add_to_list",
      config: { name: "my_list", position: "unique_end", value_type: "number", value: "3" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 1, 2, 3, 4]);

    // remove_from_list_by_index
    await executeRegisteredAction(executors, {
      type: "remove_from_list_by_index",
      config: { name: "my_list", index: 1 },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 3, 4]);

    // remove_from_list_by_value
    await executeRegisteredAction(executors, {
      type: "remove_from_list_by_value",
      config: { name: "my_list", value_type: "number", value: "3" },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 4]);

    // merge_lists
    runtime.outputs.other_list = [5, 6, 2];
    await executeRegisteredAction(executors, {
      type: "merge_lists",
      config: { name: "my_list", value: "{{other_list}}", unique: false },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 4, 5, 6, 2]);

    await executeRegisteredAction(executors, {
      type: "merge_lists",
      config: { name: "my_list", value: "[6, 7]", unique: true },
    } as any);
    expect(runtime.outputs.my_list).toEqual([0, 2, 4, 5, 6, 2, 7]);
  });

  test("new list actions - List: Process", async () => {
    const page = {
      evaluate: async (fn: any, args: any) => {
        const { scriptText, list } = args;
        const parsedFn = new Function("list", `return (${scriptText});`);
        return parsedFn(list);
      },
    } as any;

    const runtime = minimalRuntime({
      page,
      outputs: {
        my_list: ["a", "b", "c"],
        obj_list: [{ id: 1, v: "x" }, { id: 2, v: "y" }],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // get_list_item - first
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "my_list", position: "first", output_name: "item_first" },
    } as any);
    expect(runtime.outputs.item_first).toBe("a");

    // get_list_item - last
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "my_list", position: "last", output_name: "item_last" },
    } as any);
    expect(runtime.outputs.item_last).toBe("c");

    // get_list_item - index
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "my_list", position: "index", index: 1, output_name: "item_index" },
    } as any);
    expect(runtime.outputs.item_index).toBe("b");

    // get_list_length
    await executeRegisteredAction(executors, {
      type: "get_list_length",
      config: { source: "my_list", output_name: "len" },
    } as any);
    expect(runtime.outputs.len).toBe(3);

    // slice_list
    await executeRegisteredAction(executors, {
      type: "slice_list",
      config: { source: "my_list", start: 1, end: 3, output_name: "sliced" },
    } as any);
    expect(runtime.outputs.sliced).toEqual(["b", "c"]);

    // join_list
    await executeRegisteredAction(executors, {
      type: "join_list",
      config: { source: "my_list", separator: "-", output_name: "joined" },
    } as any);
    expect(runtime.outputs.joined).toBe("a-b-c");

    // map_list_property
    await executeRegisteredAction(executors, {
      type: "map_list_property",
      config: { source: "obj_list", property_key: "v", output_name: "mapped" },
    } as any);
    expect(runtime.outputs.mapped).toEqual(["x", "y"]);

    // sort_reverse_list - reverse
    await executeRegisteredAction(executors, {
      type: "sort_reverse_list",
      config: { source: "my_list", action: "reverse", output_name: "reversed" },
    } as any);
    expect(runtime.outputs.reversed).toEqual(["c", "b", "a"]);

    // sort_reverse_list - sort_asc
    runtime.outputs.unsorted = [3, 1, 2];
    await executeRegisteredAction(executors, {
      type: "sort_reverse_list",
      config: { source: "unsorted", action: "sort_asc", output_name: "sorted_asc" },
    } as any);
    expect(runtime.outputs.sorted_asc).toEqual([1, 2, 3]);

    // execute_list_script
    await executeRegisteredAction(executors, {
      type: "execute_list_script",
      config: { source: "my_list", script: "list.map(x => x.toUpperCase())", output_name: "script_res" },
    } as any);
    expect(runtime.outputs.script_res).toEqual(["A", "B", "C"]);
  });

  test("get_list_item fallback during run from selected loop prelude step", async () => {
    const runtime = minimalRuntime({
      outputs: {},
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // Normal behavior: non-existent list returns undefined
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "link_var" },
    } as any);
    expect(runtime.outputs.link_var).toBeUndefined();

    // Prelude behavior: missing list gets fallback mock value based on variable name
    runtime.currentStepId = "__prelude:loop_item:loop-1";
    
    // Link/URL variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "link_var" },
    } as any);
    expect(runtime.outputs.link_var).toBe("https://www.tiktok.com/@tiktok");

    // Video variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "video_url" },
    } as any);
    expect(runtime.outputs.video_url).toBe("https://www.tiktok.com/@tiktok/video/7350000000000000000");

    // Username/user variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "username" },
    } as any);
    expect(runtime.outputs.username).toBe("tiktok");

    // ID variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "some_id" },
    } as any);
    expect(runtime.outputs.some_id).toBe("1234567890");

    // Count/index variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "loop_index" },
    } as any);
    expect(runtime.outputs.loop_index).toBe("1");

    // Other/unknown variable name
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "missing_list", position: "first", output_name: "other_field" },
    } as any);
    expect(runtime.outputs.other_field).toBe("mock_other_field");

    // Empty list also gets fallback mock value
    runtime.outputs.empty_list = [];
    await executeRegisteredAction(executors, {
      type: "get_list_item",
      config: { source: "empty_list", position: "first", output_name: "empty_link" },
    } as any);
    expect(runtime.outputs.empty_link).toBe("https://www.tiktok.com/@tiktok");
  });


  test("new list actions - List: Conditions", async () => {
    const runtime = minimalRuntime({
      outputs: {
        empty_list: [],
        non_empty: [10, 20, 30],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // check_list_empty - empty
    await executeRegisteredAction(executors, {
      type: "check_list_empty",
      config: { source: "empty_list", output_name: "is_empty" },
    } as any);
    expect(runtime.outputs.is_empty).toBe(true);

    // check_list_empty - non_empty
    await executeRegisteredAction(executors, {
      type: "check_list_empty",
      config: { source: "non_empty", output_name: "is_empty_2" },
    } as any);
    expect(runtime.outputs.is_empty_2).toBe(false);

    // check_list_contains
    await executeRegisteredAction(executors, {
      type: "check_list_contains",
      config: { source: "non_empty", value_type: "number", value: "20", output_name: "contains_20" },
    } as any);
    expect(runtime.outputs.contains_20).toBe(true);

    await executeRegisteredAction(executors, {
      type: "check_list_contains",
      config: { source: "non_empty", value_type: "number", value: "40", output_name: "contains_40" },
    } as any);
    expect(runtime.outputs.contains_40).toBe(false);
  });

  test("new list actions - List: Conditions with Match Rules", async () => {
    const runtime = minimalRuntime({
      outputs: {
        users: [
          { name: "alice", age: 25 },
          { name: "bob", age: 35 },
        ],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    // check_list_any_match - any user age > 30 (should be true because of bob)
    await executeRegisteredAction(executors, {
      type: "check_list_any_match",
      config: {
        source: "users",
        output_name: "has_old_user",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{item.age}}",
              comparison: "greater_than",
              right_operand: "30",
            },
          ],
        },
      },
    } as any);
    expect(runtime.outputs.has_old_user).toBe(true);

    // check_list_all_match - all users age > 30 (should be false because of alice)
    await executeRegisteredAction(executors, {
      type: "check_list_all_match",
      config: {
        source: "users",
        output_name: "all_old_users",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{item.age}}",
              comparison: "greater_than",
              right_operand: "30",
            },
          ],
        },
      },
    } as any);
    expect(runtime.outputs.all_old_users).toBe(false);

    // filter_list - filter users age > 30 (should return array with bob only)
    await executeRegisteredAction(executors, {
      type: "filter_list",
      config: {
        source: "users",
        output_name: "old_users_filtered",
        rules_group: {
          operator: "and",
          rules: [
            {
              type: "value_compare",
              left_operand: "{{item.age}}",
              comparison: "greater_than",
              right_operand: "30",
            },
          ],
        },
      },
    } as any);
    expect(runtime.outputs.old_users_filtered).toEqual([{ name: "bob", age: 35 }]);
  });
});
