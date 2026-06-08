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

  test("uses the app logo assets for the renderer and Electron package", () => {
    const indexHtml = readFileSync(join(process.cwd(), "index.html"), "utf8");
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { build?: { icon?: string } };

    expect(indexHtml).toContain('rel="icon"');
    expect(indexHtml).toContain('href="./app-logo.svg"');
    expect(indexHtml).toContain('href="./app-logo.png"');
    expect(existsSync(join(process.cwd(), "public/app-logo.svg"))).toBe(true);
    expect(existsSync(join(process.cwd(), "public/app-logo.png"))).toBe(true);
    expect(packageJson.build?.icon).toBe("public/app-logo.png");
  });

  test("does not keep unused Radix tabs primitive or dependency", () => {
    const packageJson = JSON.parse(
      readFileSync(join(process.cwd(), "package.json"), "utf8"),
    ) as { dependencies?: Record<string, string> };

    expect(existsSync(join(process.cwd(), "src/components/ui/tabs.tsx"))).toBe(false);
    expect(packageJson.dependencies).not.toHaveProperty("@radix-ui/react-tabs");
  });

  test("keeps workflow package option controls out of App orchestration", () => {
    const appSource = readFileSync(join(process.cwd(), "src/App.tsx"), "utf8");
    const dialogsSource = readFileSync(
      join(process.cwd(), "src/AppPackageDialogs.tsx"),
      "utf8",
    );

    expect(
      existsSync(
        join(
          process.cwd(),
          "src/features/workflows/components/WorkflowPackageOptions.tsx",
        ),
      ),
    ).toBe(true);
    expect(dialogsSource).toContain("WorkflowPackageOptions");
    expect(appSource).not.toContain("WorkflowPackageOptions");
    expect(appSource).not.toContain("function PackageFlowCheckbox");
    expect(appSource).not.toContain("function PackageSectionPicker");
  });
});
