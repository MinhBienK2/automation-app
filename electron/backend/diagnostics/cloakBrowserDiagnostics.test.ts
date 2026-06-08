import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, test } from "vitest";
import {
  browserProfileDiagnostics,
  fingerprintFontChecklist,
} from "./cloakBrowserDiagnostics.js";

const tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.splice(0).map((root) => fs.rm(root, { recursive: true, force: true })),
  );
  delete process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES;
});

describe("cloakBrowserDiagnostics", () => {
  test("reports configured fingerprint font directory coverage", async () => {
    const fontsDir = await fs.mkdtemp(path.join(os.tmpdir(), "font-diagnostics-"));
    tempRoots.push(fontsDir);
    await fs.writeFile(path.join(fontsDir, "Arial-Regular.ttf"), "arial");
    await fs.writeFile(path.join(fontsDir, "NotoSans-Regular.otf"), "noto");
    await fs.writeFile(path.join(fontsDir, "CourierNew.ttf"), "courier");

    const checklist = fingerprintFontChecklist(
      new Map([
        [
          fontsDir,
          [
            {
              workflow_id: "workflow-1",
              workflow_name: "Login",
              identity_id: "bi_identity",
            },
          ],
        ],
      ]),
    );

    expect(checklist.status).toBe("ok");
    expect(checklist.directories).toEqual([
      expect.objectContaining({
        path: fontsDir,
        file_count: 3,
        total_size_bytes: 16,
        normalized_hash: expect.stringMatching(/^[a-f0-9]{64}$/),
        expected_families_present: expect.arrayContaining(["arial", "courier", "noto"]),
        missing_expected_families: [],
      }),
    ]);
  });

  test("caps browser profile size traversal during diagnostics", async () => {
    process.env.WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES = "1";
    const profileRoot = await fs.mkdtemp(path.join(os.tmpdir(), "profile-diagnostics-"));
    tempRoots.push(profileRoot);
    await fs.mkdir(path.join(profileRoot, "profile-a"), { recursive: true });
    await fs.writeFile(path.join(profileRoot, "profile-a", "a.bin"), "a".repeat(100));
    await fs.writeFile(path.join(profileRoot, "profile-a", "b.bin"), "b".repeat(100));

    const diagnostics = await browserProfileDiagnostics(
      profileRoot,
      new Map([
        [
          "profile-a",
          {
            identity_id: "bi_identity",
            display_name: "QA Identity",
            workflow_id: "workflow-1",
            workflow_name: "Login",
            last_run_at: null,
          },
        ],
      ]),
      new Set(["profile-a"]),
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        profile_dir: "profile-a",
        display_name: "QA Identity",
        active_session: true,
        approximate_size_bytes: expect.any(Number),
      }),
    ]);
    expect(diagnostics[0]?.approximate_size_bytes).toBeLessThan(200);
  });
});
