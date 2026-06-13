import path from "node:path";
import { describe, expect, test } from "vitest";
import {
  CLOAKBROWSER_FONT_PACKAGES,
  buildCloakBrowserFontSetupPlan,
} from "./setup-cloakbrowser-fonts.mjs";

describe("cloakbrowser font setup script", () => {
  test("plans a repo-local Linux font setup from CloakBrowser recommended packages", () => {
    const repoRoot = "/repo";
    const plan = buildCloakBrowserFontSetupPlan(repoRoot);

    expect(CLOAKBROWSER_FONT_PACKAGES).toEqual([
      "fonts-noto-color-emoji",
      "fonts-freefont-ttf",
      "fonts-unifont",
      "fonts-ipafont-gothic",
      "fonts-wqy-zenhei",
      "fonts-tlwg-loma-otf",
    ]);
    expect(plan.fontsDir).toBe(path.join(repoRoot, ".local", "cloakbrowser-fonts", "linux"));
    expect(plan.debsDir).toBe(path.join(repoRoot, ".local", "cloakbrowser-fonts", "debs"));
    expect(plan.extractDir).toBe(path.join(repoRoot, ".local", "cloakbrowser-fonts", "extract"));
    expect(plan.downloadCommand).toEqual({
      command: "apt-get",
      args: ["download", ...CLOAKBROWSER_FONT_PACKAGES],
      cwd: plan.debsDir,
    });
    expect(plan.fontCacheCommand).toEqual({
      command: "fc-cache",
      args: ["-f", plan.fontsDir],
    });
  });
});
