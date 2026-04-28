import { describe, expect, test } from "vitest";
import { actionOptions } from "../../../lib/workflowUi";
import { stepHelpContent } from "./stepHelpContent";

describe("step help content", () => {
  test("covers every action type in Vietnamese and English", () => {
    for (const actionType of actionOptions) {
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
