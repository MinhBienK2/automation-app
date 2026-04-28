import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(join(process.cwd(), "src/App.css"), "utf8");

function cssRule(selector: string) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("App CSS", () => {
  test("keeps step help modal content scrollable on small screens", () => {
    const dialog = cssRule(".step-help-dialog");
    const body = cssRule(".step-help-body");

    expect(dialog).toContain("grid-template-rows: auto auto minmax(0, 1fr)");
    expect(dialog).toContain("height: min(760px, calc(100dvh - 48px))");
    expect(body).toContain("overflow-y: auto");
  });
});
