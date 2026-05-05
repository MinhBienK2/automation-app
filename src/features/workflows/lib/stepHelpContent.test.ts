import { describe, expect, test } from "vitest";
import { allActionOptions } from "../../../lib/workflowUi";
import type { GraphNodeType } from "../../../types/workflow";
import { graphNodeHelpContent } from "./graphNodeHelpContent";
import { stepHelpContent } from "./stepHelpContent";

describe("step help content", () => {
  test("covers every action type in Vietnamese and English", () => {
    for (const actionType of allActionOptions) {
      expect(stepHelpContent[actionType].vi.summary).not.toHaveLength(0);
      expect(stepHelpContent[actionType].en.summary).not.toHaveLength(0);
      expect(stepHelpContent[actionType].vi.fields.length).toBeGreaterThan(0);
      expect(stepHelpContent[actionType].en.fields.length).toBeGreaterThan(0);
      for (const field of stepHelpContent[actionType].vi.fields) {
        expect(field.details?.length, `${actionType} vi ${field.name}`).toBeGreaterThan(0);
      }
      for (const field of stepHelpContent[actionType].en.fields) {
        expect(field.details?.length, `${actionType} en ${field.name}`).toBeGreaterThan(0);
      }
    }
  });

  test("adds decision guidance for similar form-field actions", () => {
    expect(stepHelpContent.input_text.vi.title).toContain("Fill Field");
    expect(stepHelpContent.input_text.en.title).toContain("Fill Field");
    expect(stepHelpContent.input_text.en.notFor).toEqual(
      expect.arrayContaining([expect.stringContaining("real keyboard events")]),
    );
    expect(stepHelpContent.input_text.en.chooseInstead).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Type Keys" }),
        expect.objectContaining({ action: "Paste Into Field" }),
        expect.objectContaining({ action: "Fill Rich Text" }),
      ]),
    );
    expect(stepHelpContent.toggle_checkbox.en.chooseInstead).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "Check" }),
        expect.objectContaining({ action: "Uncheck" }),
      ]),
    );
  });

  test("documents outputs for output-producing actions", () => {
    for (const actionType of [
      "extract_text",
      "extract_attribute",
      "extract_input_value",
      "extract_table",
      "extract_list",
      "take_screenshot",
      "wait_for_download",
      "execute_js",
    ] as const) {
      expect(stepHelpContent[actionType].en.outputs?.[0]).toEqual(
        expect.objectContaining({
          usedBy: expect.arrayContaining(["If", "Assertions", "Variables", "Later actions"]),
        }),
      );
      expect(stepHelpContent[actionType].vi.outputs?.[0].description).toContain("output");
    }
  });

  test("marks advanced and sensitive actions with safety notes", () => {
    for (const actionType of [
      "execute_js",
      "use_proxy",
      "set_extra_headers",
      "detect_challenge",
      "pause_for_human",
      "resume_when_condition",
    ] as const) {
      expect(stepHelpContent[actionType].en.safetyNotes?.join(" ")).toMatch(
        /authorized|pause|advanced/i,
      );
      expect(stepHelpContent[actionType].en.safetyNotes?.join(" ")).not.toMatch(
        /bypass|stealth|anti-detection/i,
      );
    }
  });

  test("graph logic help includes port semantics and workflow-shaped examples", () => {
    for (const nodeType of [
      "if",
      "switch",
      "repeat_times",
      "repeat_for_each",
      "while",
      "repeat_until",
      "break_loop",
      "continue_loop",
      "retry",
    ] as const) {
      expect(graphNodeHelpContent[nodeType].en.portSemantics?.length).toBeGreaterThan(0);
      expect(graphNodeHelpContent[nodeType].vi.workflowExamples?.[0].steps.join(" "))
        .toContain("->");
    }
    expect(graphNodeHelpContent.retry.en.portSemantics).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ port: "try", required: true }),
        expect.objectContaining({ port: "failed", required: false }),
      ]),
    );
  });

  test("explains every scroll mode in detail", () => {
    const viMode = stepHelpContent.scroll.vi.fields.find((field) => field.name === "Mode");
    const enMode = stepHelpContent.scroll.en.fields.find((field) => field.name === "Mode");

    expect(viMode?.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Page"),
        expect.stringContaining("Container"),
        expect.stringContaining("Into View"),
        expect.stringContaining("Until Visible"),
      ]),
    );
    expect(enMode?.details).toEqual(
      expect.arrayContaining([
        expect.stringContaining("Page"),
        expect.stringContaining("Container"),
        expect.stringContaining("Into View"),
        expect.stringContaining("Until Visible"),
      ]),
    );
  });

  test("provides a detailed field reference for every action", () => {
    for (const actionType of allActionOptions) {
      for (const language of ["vi", "en"] as const) {
        const content = stepHelpContent[actionType][language];

        const fieldReference = content.fieldReference!;
        expect(fieldReference.length, `${actionType} ${language}`).toBeGreaterThan(0);
        for (const field of fieldReference) {
          expect(field.description, `${actionType} ${language} ${field.name}`).not.toHaveLength(0);
          expect(field.requiredWhen, `${actionType} ${language} ${field.name}`).not.toHaveLength(0);
          expect(
            ["required", "optional", "advanced"],
            `${actionType} ${language} ${field.name} category`,
          ).toContain(field.category);
          if (field.name !== "No fields") {
            expect(
              field.valueGuidance ?? field.example,
              `${actionType} ${language} ${field.name} guidance`,
            ).toBeTruthy();
          }
        }
      }
    }
  });

  test("does not use generic fallback text for real action fields", () => {
    const genericFallbacks = [
      "This field appears in this action's configuration form.",
      "Field này xuất hiện trong form cấu hình của action này.",
      "Required when this field appears in the action's minimum setup; otherwise it tunes behavior.",
      "Bắt buộc nếu field này xuất hiện trong cấu hình tối thiểu của action; nếu không thì dùng để tinh chỉnh.",
    ];

    for (const actionType of allActionOptions) {
      for (const language of ["vi", "en"] as const) {
        for (const field of stepHelpContent[actionType][language].fieldReference ?? []) {
          if (field.name === "No fields") continue;
          expect(genericFallbacks, `${actionType} ${language} ${field.name}`).not.toContain(
            field.description,
          );
          expect(genericFallbacks, `${actionType} ${language} ${field.name}`).not.toContain(
            field.requiredWhen,
          );
        }
      }
    }
  });

  test("documents select-like field options in the field reference", () => {
    expect(stepHelpContent.navigate.en.fieldReference!.find((field) => field.name === "Wait until")?.options)
      .toEqual([
        expect.objectContaining({ label: "Load", value: "load" }),
        expect.objectContaining({ label: "DOMContentLoaded", value: "dom_content_loaded" }),
        expect.objectContaining({ label: "Network idle", value: "network_idle" }),
      ]);
    expect(
      stepHelpContent.navigate.en.fieldReference!.find((field) => field.name === "Wait until")?.options
        ?.map((option) => option.label),
    ).not.toEqual(expect.arrayContaining(["Clickable", "Visible", "Enabled", "Attached"]));

    expect(stepHelpContent.scroll.en.fieldReference!.find((field) => field.name === "Mode")?.options)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "Page", useWhen: expect.stringContaining("main page") }),
        expect.objectContaining({ label: "Container", avoidWhen: expect.stringContaining("target") }),
        expect.objectContaining({ label: "Into View" }),
        expect.objectContaining({ label: "Until Visible" }),
      ]));

    expect(stepHelpContent.click.en.fieldReference!.find((field) => field.name === "Position")?.options)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "Center" }),
        expect.objectContaining({ label: "Offset", useWhen: expect.stringContaining("exact") }),
      ]));

    expect(stepHelpContent.wait.en.fieldReference!.find((field) => field.name === "Condition")?.options)
      .toEqual(expect.arrayContaining([
        expect.objectContaining({ label: "Duration", useWhen: expect.stringContaining("fixed") }),
        expect.objectContaining({ label: "Element visible", useWhen: expect.stringContaining("see") }),
        expect.objectContaining({ label: "URL contains" }),
      ]));
  });

  test("keeps action help option labels aligned with actual select fields", () => {
    const expectedOptions: Array<{
      actionType: keyof typeof stepHelpContent;
      fieldName: string;
      labels: string[];
    }> = [
      { actionType: "navigate", fieldName: "Wait until", labels: ["Load", "DOMContentLoaded", "Network idle"] },
      { actionType: "wait", fieldName: "Condition", labels: ["Duration", "Element visible", "Element hidden", "Element attached", "Element detached", "Text visible", "URL contains", "Page load", "Element enabled", "Element disabled"] },
      { actionType: "input_text", fieldName: "Clear before input", labels: ["Yes", "No"] },
      { actionType: "input_text", fieldName: "Typing mode", labels: ["Set value", "Type keys"] },
      { actionType: "input_text", fieldName: "Wait until", labels: ["Clickable", "Visible", "Enabled", "Attached"] },
      { actionType: "clear_input", fieldName: "Method", labels: ["Select all", "Backspace", "DOM value"] },
      { actionType: "clear_input", fieldName: "Wait until", labels: ["Clickable", "Visible", "Enabled", "Attached"] },
      { actionType: "click", fieldName: "Mode", labels: ["Real click", "Force DOM click"] },
      { actionType: "click", fieldName: "Click count", labels: ["Single", "Double"] },
      { actionType: "click", fieldName: "Button", labels: ["Left", "Right", "Middle"] },
      { actionType: "click", fieldName: "Scroll into view", labels: ["Yes", "No"] },
      { actionType: "click", fieldName: "Block", labels: ["Start", "Center", "End", "Nearest"] },
      { actionType: "click", fieldName: "Inline", labels: ["Start", "Center", "End", "Nearest"] },
      { actionType: "click", fieldName: "Position", labels: ["Center", "Top left", "Top right", "Bottom left", "Bottom right", "Offset"] },
      { actionType: "click", fieldName: "Wait until", labels: ["Clickable", "Visible", "Enabled", "Attached"] },
      { actionType: "scroll", fieldName: "Mode", labels: ["Page", "Container", "Into View", "Until Visible"] },
      { actionType: "scroll", fieldName: "Direction", labels: ["Down", "Up", "Left", "Right"] },
      { actionType: "scroll", fieldName: "Behavior", labels: ["Instant", "Smooth"] },
      { actionType: "scroll", fieldName: "Block", labels: ["Start", "Center", "End", "Nearest"] },
      { actionType: "scroll", fieldName: "Inline", labels: ["Start", "Center", "End", "Nearest"] },
      { actionType: "select_option", fieldName: "Match by", labels: ["Label", "Value"] },
      { actionType: "select_option", fieldName: "Wait until", labels: ["Clickable", "Visible", "Enabled", "Attached"] },
      { actionType: "set_checkbox", fieldName: "State", labels: ["Checked", "Unchecked"] },
      { actionType: "set_checkbox", fieldName: "Wait until", labels: ["Clickable", "Visible", "Enabled", "Attached"] },
      { actionType: "set_contenteditable", fieldName: "Clear before input", labels: ["Yes", "No"] },
      { actionType: "set_contenteditable", fieldName: "Wait until", labels: ["Clickable", "Visible", "Enabled", "Attached"] },
      { actionType: "take_screenshot", fieldName: "Full page", labels: ["Yes", "No"] },
      { actionType: "set_viewport", fieldName: "Mobile", labels: ["False", "True"] },
      { actionType: "set_viewport", fieldName: "Touch", labels: ["False", "True"] },
      { actionType: "assert_element", fieldName: "State", labels: ["Visible", "Hidden", "Attached", "Enabled", "Disabled"] },
      { actionType: "assert_text", fieldName: "Match mode", labels: ["Contains", "Equals"] },
      { actionType: "stop_workflow", fieldName: "Status", labels: ["Success", "Failure"] },
    ];

    for (const { actionType, fieldName, labels } of expectedOptions) {
      const field = stepHelpContent[actionType].en.fieldReference!
        .find((item) => item.name === fieldName);
      expect(
        field?.options?.map((option) => option.label),
        `${actionType} ${fieldName}`,
      ).toEqual(labels);
    }
  });

  test("schema-backed graph node help covers fields, ports, and select options", () => {
    const graphNodeTypes: GraphNodeType[] = [
      "start",
      "end_success",
      "end_failure",
      "action",
      "if",
      "switch",
      "repeat_times",
      "repeat_for_each",
      "repeat_until",
      "while",
      "retry",
      "try_catch",
      "fallback",
      "break_loop",
      "continue_loop",
      "stop_workflow",
      "set_variable",
      "set_json_variables",
      "transform_variable",
      "assert_output",
      "run_subworkflow",
      "manual_approval",
      "rate_limit",
      "domain_allowlist",
    ];

    for (const nodeType of graphNodeTypes) {
      for (const language of ["vi", "en"] as const) {
        const content = graphNodeHelpContent[nodeType][language];
        expect(content.summary, `${nodeType} ${language}`).not.toHaveLength(0);
        expect(content.fieldReference?.length, `${nodeType} ${language}`).toBeGreaterThan(0);
        for (const field of content.fieldReference ?? []) {
          expect(field.description, `${nodeType} ${language} ${field.name}`).not.toHaveLength(0);
          expect(field.requiredWhen, `${nodeType} ${language} ${field.name}`).not.toHaveLength(0);
          expect(["required", "optional", "advanced"]).toContain(field.category);
          if (field.name !== "Ports") {
            expect(field.valueGuidance ?? field.example, `${nodeType} ${language} ${field.name}`)
              .toBeTruthy();
          }
        }
      }
    }

    expect(
      graphNodeHelpContent.if.en.fieldReference?.find((field) => field.name === "Condition")
        ?.options?.map((option) => option.label),
    ).toEqual(["Output equals", "Output contains", "Text visible", "URL contains", "Element visible"]);
    expect(
      graphNodeHelpContent.assert_output.en.fieldReference?.find((field) => field.name === "Match")
        ?.options?.map((option) => option.label),
    ).toEqual(["Equals", "Contains"]);
  });
});
