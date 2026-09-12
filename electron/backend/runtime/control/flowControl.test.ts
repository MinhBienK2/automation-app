// @vitest-environment node

import { describe, expect, test } from "vitest";
import { buildFlowControlExecutors } from "./flowControl.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../testSupport/executorFixtures.js";
import { FakePage } from "../testSupport/inMemoryBrowserDriver.js";
import type { DesktopSurface } from "../surface.js";

describe("flowControl executors surface seam", () => {
  test("domain_allowlist routes through web surface page", async () => {
    const page = new FakePage();
    page.urlValue = "https://owned.test/app";
    const runtime = minimalRuntime({ page });
    const executors = buildFlowControlExecutors(runtime, minimalDependencies());

    await executors.domain_allowlist?.({
      type: "domain_allowlist",
      config: { domains: ["owned.test"] },
    } as never);

    expect(runtime.outputs.domain_allowlist).toEqual(["owned.test"]);
  });

  test("domain_allowlist rejects when executed on desktop surface", async () => {
    const desktopSurface: DesktopSurface = {
      kind: "desktop",
      driver: {} as never,
      binding: {} as never,
    };
    const runtime = minimalRuntime({
      surface: desktopSurface,
    });
    const executors = buildFlowControlExecutors(runtime, minimalDependencies());

    await expect(
      executors.domain_allowlist?.({
        type: "domain_allowlist",
        config: { domains: ["owned.test"] },
      } as never),
    ).rejects.toThrow(/dispatched on the desktop surface/);
  });

  test("surface-independent control actions run without web surface", async () => {
    const desktopSurface: DesktopSurface = {
      kind: "desktop",
      driver: {} as never,
      binding: {} as never,
    };
    const runtime = minimalRuntime({
      surface: desktopSurface,
      outputs: { counter: 1 },
    });
    const executors = buildFlowControlExecutors(runtime, minimalDependencies());

    await executors.transform_variable?.({
      type: "transform_variable",
      config: { target_name: "doubled", expression: "value-{{counter}}" },
    } as never);

    expect(runtime.outputs.doubled).toBe("value-1");

    await executors.assert_output?.({
      type: "assert_output",
      config: { name: "doubled", match_mode: "equals", value: "value-1" },
    } as never);
  });
});
