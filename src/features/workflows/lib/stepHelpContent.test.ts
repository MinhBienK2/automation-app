import { describe, expect, test } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { allActionOptions } from "../../../lib/workflowUi";
import type { GraphNodeType } from "../../../types/workflow";
import { graphNodeHelpContent } from "./graphNodeHelpContent";
import { stepHelpContent } from "./stepHelpContent";

const stepHelpContentSource = readFileSync(
  join(process.cwd(), "src/features/workflows/lib/stepHelpContent.ts"),
  "utf8",
);
const stepHelpEnrichmentSource = readFileSync(
  join(process.cwd(), "src/features/workflows/lib/stepHelpEnrichment.ts"),
  "utf8",
);
const stepHelpModalSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/StepHelpModal.tsx"),
  "utf8",
);
const workflowGraphPalettesSource = readFileSync(
  join(process.cwd(), "src/features/workflows/components/WorkflowGraphPalettes.tsx"),
  "utf8",
);

describe("step help content", () => {
  test("keeps shared help contracts outside the generated action catalog", () => {
    expect(stepHelpContentSource).not.toContain("export type StepHelpLanguage");
    expect(stepHelpContentSource).not.toContain("export type StepHelpContent");
    expect(stepHelpModalSource).toContain('../lib/stepHelpTypes');
    expect(workflowGraphPalettesSource).toContain('../lib/stepHelpTypes');
  });

  test("keeps field guidance data outside the generated action catalog", () => {
    expect(stepHelpContentSource).not.toContain("const specificFieldOptions");
    expect(stepHelpContentSource).not.toContain("const specificFieldDetails");
    expect(stepHelpContentSource).toContain("./stepHelpEnrichment");
    expect(stepHelpEnrichmentSource).toContain("./stepHelpFieldGuidance");
  });

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
      "count_elements",
      "extract_regex_matches",
      "take_screenshot",
      "write_text_file",
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
      "set_extra_headers",
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

  test("action help includes action-node port semantics", () => {
    for (const actionType of allActionOptions) {
      expect(stepHelpContent[actionType].en.portSemantics, actionType).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ port: "In", kind: "input" }),
          expect.objectContaining({ port: "Out", kind: "continuation" }),
        ]),
      );
      expect(stepHelpContent[actionType].vi.portSemantics?.[0].description, actionType)
        .toContain("trước");
    }
  });

  test("uses current structured target fields for visible targetable actions", () => {
    for (const actionType of [
      "input_text",
      "clear_input",
      "click",
      "hover",
      "select_option",
      "extract_text",
      "assert_text",
    ] as const) {
      const names = stepHelpContent[actionType].en.fieldReference!.map((field) => field.name);

      expect(names, actionType).toEqual(
        expect.arrayContaining([
          "Target locator type",
          "Target locator",
          "Target visibility",
          "Target enabled",
          "Target contains text",
          "Target index",
        ]),
      );
      expect(names, actionType).not.toEqual(
        expect.arrayContaining([
          "XPath",
          "Iframe XPath",
          "Wait until",
          "Retry interval ms",
          "Post-click wait ms",
        ]),
      );
    }

    expect(stepHelpContent.click.en.minimalConfig?.map((field) => field.name)).toEqual([
      "Target source",
      "Target ref",
      "Target locator type",
    ]);
  });

  test("Drag and Drop help follows the grouped source and drop setup fields", () => {
    expect(stepHelpContent.drag_and_drop.en.fieldReference!.map((field) => field.name))
      .toEqual([
        "Source selection",
        "Source ref",
        "Source locator type",
        "Source locator",
        "Drop target source",
        "Drop target ref",
        "Target locator type",
        "Target locator",
        "Destination position",
        "X percent",
        "Y percent",
        "X offset px",
        "Y offset px",
      ]);
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
    expect(
      stepHelpContent.input_text.en.fieldReference!
        .find((field) => field.name === "Target locator type")?.options
        ?.map((option) => option.label),
    ).toEqual(["Test ID", "Role", "Label", "Placeholder", "Text", "CSS", "XPath", "Attribute"]);
    expect(
      stepHelpContent.input_text.en.fieldReference!
        .find((field) => field.name === "Target visibility")?.options
        ?.map((option) => option.label),
    ).toEqual(["Any", "Visible", "Hidden"]);
    expect(
      stepHelpContent.input_text.en.fieldReference!
        .find((field) => field.name === "Target enabled")?.options
        ?.map((option) => option.label),
    ).toEqual(["Any", "Enabled", "Disabled"]);

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
      { actionType: "input_text", fieldName: "Target locator type", labels: ["Test ID", "Role", "Label", "Placeholder", "Text", "CSS", "XPath", "Attribute"] },
      { actionType: "input_text", fieldName: "Target visibility", labels: ["Any", "Visible", "Hidden"] },
      { actionType: "input_text", fieldName: "Target enabled", labels: ["Any", "Enabled", "Disabled"] },
      { actionType: "wait", fieldName: "Condition", labels: ["Duration", "Element visible", "Element hidden", "Element attached", "Element detached", "Text visible", "URL contains", "Page load", "Element enabled", "Element disabled"] },
      { actionType: "scroll", fieldName: "Direction", labels: ["Down", "Up", "Left", "Right"] },
      { actionType: "select_option", fieldName: "Match by", labels: ["Label", "Value"] },
      { actionType: "set_contenteditable", fieldName: "Clear before input", labels: ["Yes", "No"] },
      { actionType: "take_screenshot", fieldName: "Full page", labels: ["Yes", "No"] },
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

  test("describes Set Viewport as runtime width and height only", () => {
    expect(stepHelpContent.set_viewport.en.summary).toContain("viewport size");
    expect(stepHelpContent.set_viewport.en.summary).not.toContain("device shape");
    expect(
      stepHelpContent.set_viewport.en.fieldReference?.map((field) => field.name),
    ).toEqual(["Width", "Height"]);
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
      "update_number_variable",
      "update_text_variable",
      "update_flag_variable",
      "update_list_variable",
      "update_object_variable",
      "transform_variable",
      "assert_output",
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
    ).toEqual(["Check variable (boolean)", "Text visible", "URL contains", "Element visible"]);
    expect(
      graphNodeHelpContent.assert_output.en.fieldReference?.find((field) => field.name === "Match")
        ?.options?.map((option) => option.label),
    ).toEqual(["Equals", "Contains"]);
  });
});
