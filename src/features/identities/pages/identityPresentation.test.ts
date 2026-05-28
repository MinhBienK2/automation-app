import { describe, expect, test } from "vitest";
import {
  buildSafeIdentityFields,
  formatIdentityBytes,
  identityEvidenceCountLabel,
  retainedSessionLabel,
  sessionModeLabel,
} from "./identityPresentation";

describe("identity presentation helpers", () => {
  test("labels session state, session mode, evidence count, and byte sizes", () => {
    expect(retainedSessionLabel({ active: true })).toBe("Live retained session");
    expect(retainedSessionLabel({ active: false })).toBe("No retained session");
    expect(sessionModeLabel("persistent_profile", true)).toBe("Persistent profile");
    expect(sessionModeLabel("temporary", false)).toBe("Temporary session");
    expect(identityEvidenceCountLabel(0)).toBe("No recent evidence for this identity yet.");
    expect(identityEvidenceCountLabel(1)).toBe("1 matching evidence item.");
    expect(identityEvidenceCountLabel(3)).toBe("3 matching evidence items.");
    expect(formatIdentityBytes(2048)).toBe("2 KB");
  });

  test("filters sensitive observed identity fields before display", () => {
    expect(buildSafeIdentityFields([
      { key: "fingerprint_seed_hash", value: "safe-hash" },
      { key: "profile_dir", value: "/Users/example/browser-profiles/secret" },
      { key: "proxy_password", value: "super-secret" },
      { key: "localStorage", value: "session-data" },
    ])).toEqual([
      { key: "fingerprint_seed_hash", value: "safe-hash" },
    ]);
  });
});
