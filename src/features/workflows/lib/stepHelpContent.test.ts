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
    }
  });
});
