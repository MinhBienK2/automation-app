// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  currentPageHostname,
  hostnameAllowed,
  normalizeDomain,
} from "./domainPolicy";

describe("runner domain policy helpers", () => {
  test("normalizes domains and URL strings for allowlist matching", () => {
    expect(normalizeDomain("https://Owned.Test/path")).toBe("owned.test");
    expect(normalizeDomain(".sub.Owned.Test.")).toBe("sub.owned.test");
  });

  test("allows exact hosts and subdomains only", () => {
    expect(hostnameAllowed("owned.test", ["owned.test"])).toBe(true);
    expect(hostnameAllowed("app.owned.test", ["owned.test"])).toBe(true);
    expect(hostnameAllowed("notowned.test", ["owned.test"])).toBe(false);
  });

  test("reads the current page hostname defensively", async () => {
    const page = {
      evaluate: async () => "https://app.owned.test/dashboard",
    };

    await expect(currentPageHostname(page)).resolves.toBe("app.owned.test");
    await expect(currentPageHostname({ evaluate: async () => "not a url" }))
      .resolves.toBeNull();
  });
});
