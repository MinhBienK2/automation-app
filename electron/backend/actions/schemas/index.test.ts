// @vitest-environment node

import { describe, expect, test } from "vitest";
import { navigateSchema } from "./navigate.js";
import { clickSchema } from "./click.js";
import { inputTextSchema } from "./input_text.js";
import { waitSchema } from "./wait.js";
import { extractTextSchema } from "./extract_text.js";
import { ifConditionSchema } from "./if_condition.js";
import { setVariableSchema } from "./set_variable.js";
import { callSubflowSchema } from "./call_subflow.js";
import { takeScreenshotSchema } from "./take_screenshot.js";
import { executeJsSchema } from "./execute_js.js";
import { validateActionConfig, actionSchemas } from "./index.js";
import type { WorkflowNode } from "../../../../src/types/workflow.js";

function node(config: unknown): WorkflowNode {
  return {
    id: "n1",
    node_type: "action",
    label: "Test",
    position: { x: 0, y: 0 },
    ports: [],
    config,
  };
}

describe("navigate schema", () => {
  test("valid minimal config parses", () => {
    const result = navigateSchema.safeParse({
      type: "navigate",
      config: { url: "https://example.com" },
    });
    expect(result.success).toBe(true);
  });

  test("missing url fails", () => {
    const result = navigateSchema.safeParse({ type: "navigate", config: {} });
    expect(result.success).toBe(false);
  });

  test("invalid wait_until rejected", () => {
    const result = navigateSchema.safeParse({
      type: "navigate",
      config: { url: "https://x.com", wait_until: "bad" },
    });
    expect(result.success).toBe(false);
  });

  test("optional fields omitted parse with defaults", () => {
    const result = navigateSchema.safeParse({
      type: "navigate",
      config: { url: "https://x.com" },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.config.timeout_ms).toBeUndefined();
    }
  });
});

describe("click schema", () => {
  test("valid with target parses", () => {
    const result = clickSchema.safeParse({
      type: "click",
      config: { target: { locators: [{ kind: "xpath", value: "//button" }] } },
    });
    expect(result.success).toBe(true);
  });

  test("valid with xpath parses", () => {
    const result = clickSchema.safeParse({
      type: "click",
      config: { xpath: "//button" },
    });
    expect(result.success).toBe(true);
  });
});

describe("input_text schema", () => {
  test("valid config parses", () => {
    const result = inputTextSchema.safeParse({
      type: "input_text",
      config: {
        target: { locators: [{ kind: "css", value: "#input" }] },
        text: "hello",
        clear_before_input: true,
      },
    });
    expect(result.success).toBe(true);
  });

  test("missing text fails", () => {
    const result = inputTextSchema.safeParse({
      type: "input_text",
      config: { clear_before_input: true },
    });
    expect(result.success).toBe(false);
  });
});

describe("wait schema", () => {
  test("duration condition parses", () => {
    const result = waitSchema.safeParse({
      type: "wait",
      config: { condition: "duration", duration_ms: 1000 },
    });
    expect(result.success).toBe(true);
  });

  test("invalid condition rejected", () => {
    const result = waitSchema.safeParse({
      type: "wait",
      config: { condition: "bad_condition" },
    });
    expect(result.success).toBe(false);
  });
});

describe("extract_text schema", () => {
  test("valid config parses", () => {
    const result = extractTextSchema.safeParse({
      type: "extract_text",
      config: {
        target: { locators: [{ kind: "xpath", value: "//div" }] },
        output_name: "result",
      },
    });
    expect(result.success).toBe(true);
  });

  test("missing output_name fails", () => {
    const result = extractTextSchema.safeParse({
      type: "extract_text",
      config: { xpath: "//div" },
    });
    expect(result.success).toBe(false);
  });
});

describe("if_condition schema", () => {
  test("valid config parses", () => {
    const result = ifConditionSchema.safeParse({
      type: "if_condition",
      config: {
        condition: { kind: "variable_is_true", name: "flag" },
        then_steps: [],
        else_steps: [],
      },
    });
    expect(result.success).toBe(true);
  });

  test("invalid condition kind rejected", () => {
    const result = ifConditionSchema.safeParse({
      type: "if_condition",
      config: {
        condition: { kind: "bad_kind" },
        then_steps: [],
        else_steps: [],
      },
    });
    expect(result.success).toBe(false);
  });
});

describe("set_variable schema", () => {
  test("valid with variables array parses", () => {
    const result = setVariableSchema.safeParse({
      type: "set_variable",
      config: {
        variables: [{ name: "x", value: "1" }],
      },
    });
    expect(result.success).toBe(true);
  });

  test("valid with single name/value parses", () => {
    const result = setVariableSchema.safeParse({
      type: "set_variable",
      config: { name: "x", value: "1" },
    });
    expect(result.success).toBe(true);
  });
});

describe("call_subflow schema", () => {
  test("valid config parses", () => {
    const result = callSubflowSchema.safeParse({
      subflow_id: "sf-1",
      input_mapping: [{ input_name: "x", value: "{{y}}" }],
    });
    expect(result.success).toBe(true);
  });

  test("missing subflow_id fails", () => {
    const result = callSubflowSchema.safeParse({ input_mapping: [] });
    expect(result.success).toBe(false);
  });
});

describe("take_screenshot schema", () => {
  test("valid config parses", () => {
    const result = takeScreenshotSchema.safeParse({
      type: "take_screenshot",
      config: { path: "shot.png", full_page: true },
    });
    expect(result.success).toBe(true);
  });

  test("missing full_page fails", () => {
    const result = takeScreenshotSchema.safeParse({
      type: "take_screenshot",
      config: { path: "shot.png" },
    });
    expect(result.success).toBe(false);
  });
});

describe("execute_js schema", () => {
  test("valid config parses", () => {
    const result = executeJsSchema.safeParse({
      type: "execute_js",
      config: { script: "return 42;" },
    });
    expect(result.success).toBe(true);
  });

  test("missing script fails", () => {
    const result = executeJsSchema.safeParse({ type: "execute_js", config: {} });
    expect(result.success).toBe(false);
  });
});

describe("validateActionConfig", () => {
  test("valid action returns ok", () => {
    const result = validateActionConfig(node({
      type: "navigate",
      config: { url: "https://example.com" },
    }));
    expect(result.ok).toBe(true);
  });

  test("invalid action returns invalid", () => {
    const result = validateActionConfig(node({
      type: "navigate",
      config: {},
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("invalid");
  });

  test("unknown action type returns no_schema (pass-through)", () => {
    const result = validateActionConfig(node({
      type: "scroll",
      config: { direction: "down" },
    }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_schema");
  });

  test("null config returns no_schema", () => {
    const result = validateActionConfig(node(null));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_schema");
  });
});

describe("registry completeness (PR 1.3 scope)", () => {
  test("top-10 schemas are registered", () => {
    const expected = ["navigate", "click", "input_text", "wait", "extract_text", "if_condition", "set_variable", "take_screenshot", "execute_js"];
    for (const type of expected) {
      expect(actionSchemas[type as keyof typeof actionSchemas]).toBeDefined();
    }
  });
});
