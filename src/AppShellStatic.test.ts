import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

describe("app shell static assets", () => {
  test("does not ship starter Vite or React assets", () => {
    const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");

    expect(indexHtml).not.toContain("/vite.svg");
    expect(existsSync(join(process.cwd(), "public/vite.svg"))).toBe(false);
    expect(existsSync(join(process.cwd(), "src/assets/react.svg"))).toBe(false);
  });

  test("does not keep unused Radix tabs primitive or dependency", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };

    expect(existsSync(join(process.cwd(), "src/components/ui/tabs.tsx"))).toBe(false);
    expect(packageJson.dependencies).not.toHaveProperty("@radix-ui/react-tabs");
  });
});
