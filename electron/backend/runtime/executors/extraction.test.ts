// @vitest-environment node

import { describe, expect, test } from "vitest";
import { executeRegisteredAction } from "../../actions/execution.js";
import { createRunnerActionExecutors } from "../runnerActionExecutors.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../testSupport/executorFixtures.js";
describe("runnerActionExecutors", () => {
  test("extracts regex matches from an output and appends deduped values", async () => {
    const runtime = minimalRuntime({
      outputs: {
        post_text:
          "Follow https://www.tiktok.com/@alice and @bob then https://www.tiktok.com/@alice",
        tiktok_targets: ["https://www.tiktok.com/@existing"],
      },
    });
    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "extract_regex_matches",
      config: {
        source_name: "post_text",
        pattern: "(?:https?:\\/\\/)?(?:www\\.)?tiktok\\.com\\/@[A-Za-z0-9._-]+|@[A-Za-z0-9._-]+",
        flags: "gi",
        output_name: "tiktok_targets",
        append: true,
        dedupe: true,
      },
    } as never);

    expect(runtime.outputs.tiktok_targets).toEqual([
      "https://www.tiktok.com/@existing",
      "https://www.tiktok.com/@alice",
      "@bob",
    ]);
  });
  test("extract_text extracts plain textContent without separator", async () => {
    const runtime = minimalRuntime();
    const mockLocator = {
      textContent: async () => "Plain text",
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_text",
      config: {
        output_name: "result",
      },
    } as any);

    expect(runtime.outputs.result).toBe("Plain text");
  });

  test("extract_text joins child nodes with custom separator", async () => {
    const runtime = minimalRuntime();
    const mockLocator = {
      evaluate: async (fn: any, separator: any) => {
        const mockChildNodes = [
          { textContent: "Hello" },
          { textContent: "" },
          { textContent: "World" },
        ];
        return mockChildNodes
          .map(node => node.textContent?.trim() || '')
          .filter(Boolean)
          .join(separator);
      },
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_text",
      config: {
        output_name: "result",
        separator: " - ",
      },
    } as any);

    expect(runtime.outputs.result).toBe("Hello - World");
  });

  test("extract_list joins child nodes within each element and joins the list as a single string", async () => {
    const runtime = minimalRuntime();
    const element1 = {
      evaluate: async (fn: any, separator: any) => {
        return ["Item", "1"].join(separator);
      },
      textContent: async () => "Item1",
    } as any;
    const element2 = {
      evaluate: async (fn: any, separator: any) => {
        return ["Item", "2"].join(separator);
      },
      textContent: async () => "Item2",
    } as any;

    const mockLocator = {
      count: async () => 2,
      nth: (index: number) => {
        return index === 0 ? element1 : element2;
      },
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_list",
      config: {
        output_name: "result_list",
        separator: " / ",
      },
    } as any);
    expect(runtime.outputs.result_list).toEqual(["Item / 1", "Item / 2"]);

    await executeRegisteredAction(executors, {
      type: "extract_list",
      config: {
        output_name: "result_joined",
        separator: " / ",
        join_list: true,
        join_separator: ", ",
      },
    } as any);
    expect(runtime.outputs.result_joined).toBe("Item / 1, Item / 2");
  });
});


  test("extract_text_content, extract_inner_html, extract_outer_html, extract_computed_style, extract_all_attributes work correctly", async () => {
    const runtime = minimalRuntime();
    const mockLocator = {
      textContent: async () => "Plain text",
      innerHTML: async () => "<span>HTML</span>",
      evaluate: async (fn: any, arg?: any) => {
        const mockEl = {
          outerHTML: "<div>Outer</div>",
          attributes: [
            { name: "class", value: "test-class" },
            { name: "data-id", value: "123" },
          ],
        };
        if (arg === "background-color") {
          return "rgb(255, 0, 0)";
        }
        return fn(mockEl, arg);
      },
    } as any;

    const executors = createRunnerActionExecutors(runtime, minimalDependencies({
      locatorForAction: async () => mockLocator,
    }));

    await executeRegisteredAction(executors, {
      type: "extract_text_content",
      config: { output_name: "text" },
    } as any);
    expect(runtime.outputs.text).toBe("Plain text");

    await executeRegisteredAction(executors, {
      type: "extract_inner_html",
      config: { output_name: "inner" },
    } as any);
    expect(runtime.outputs.inner).toBe("<span>HTML</span>");

    await executeRegisteredAction(executors, {
      type: "extract_outer_html",
      config: { output_name: "outer" },
    } as any);
    expect(runtime.outputs.outer).toBe("<div>Outer</div>");

    await executeRegisteredAction(executors, {
      type: "extract_computed_style",
      config: { property: "background-color", output_name: "color" },
    } as any);
    expect(runtime.outputs.color).toBe("rgb(255, 0, 0)");

    await executeRegisteredAction(executors, {
      type: "extract_all_attributes",
      config: { output_name: "attrs" },
    } as any);
    expect(runtime.outputs.attrs).toEqual({
      class: "test-class",
      "data-id": "123",
    });
  });

  test("extract_numbers, extract_urls, extract_emails pattern extractors work correctly", async () => {
    const runtime = minimalRuntime();
    runtime.outputs.source = "Call me at +1 234-567-8900 or email at test@example.com. Visit https://google.com.";

    const executors = createRunnerActionExecutors(runtime, minimalDependencies());

    await executeRegisteredAction(executors, {
      type: "extract_numbers",
      config: { source_name: "source", output_name: "numbers" },
    } as any);
    expect(runtime.outputs.numbers).toEqual([1, 234, -567, -8900]);

    await executeRegisteredAction(executors, {
      type: "extract_urls",
      config: { source_name: "source", output_name: "urls" },
    } as any);
    expect(runtime.outputs.urls).toEqual(["https://google.com."]);

    await executeRegisteredAction(executors, {
      type: "extract_emails",
      config: { source_name: "source", output_name: "emails" },
    } as any);
    expect(runtime.outputs.emails).toEqual(["test@example.com"]);
  });
