import { describe, expect, test } from "vitest";
import type { ActionType } from "../../../types/workflow";
import type { BilingualStepHelp } from "./stepHelpTypes";
import { enrichStepHelpContent } from "./stepHelpEnrichment";

const minimalContent: Record<ActionType, BilingualStepHelp> = {
  navigate: {
    en: {
      title: "Navigate Help",
      summary: "Open a URL.",
      useWhen: ["Open a page."],
      fields: [{ name: "URL", description: "URL to open." }],
      examples: ["https://example.test"],
      commonMistakes: ["Missing protocol."],
    },
    vi: {
      title: "Trợ giúp Navigate",
      summary: "Mở URL.",
      useWhen: ["Mở trang."],
      fields: [{ name: "URL", description: "URL cần mở." }],
      examples: ["https://example.test"],
      commonMistakes: ["Thiếu protocol."],
    },
  },
} as Record<ActionType, BilingualStepHelp>;

describe("step help enrichment", () => {
  test("adds field references and decision metadata to base action help", () => {
    const enriched = enrichStepHelpContent(minimalContent);

    expect(enriched.navigate.en.fieldReference?.map((field) => field.name)).toEqual(["URL"]);
    expect(enriched.navigate.en.minimalConfig?.map((field) => field.name)).toEqual(["URL"]);
    expect(enriched.navigate.en.portSemantics?.map((port) => port.port)).toEqual(["In", "Out"]);
    expect(enriched.navigate.vi.fieldReference?.[0].details?.length).toBeGreaterThan(0);
  });
});
