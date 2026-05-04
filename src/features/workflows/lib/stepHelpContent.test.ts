import { describe, expect, test } from "vitest";
import { allActionOptions } from "../../../lib/workflowUi";
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
});
