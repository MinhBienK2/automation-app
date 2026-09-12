// @vitest-environment node

import { describe, expect, test } from "vitest";
import { buildVariablesExecutors } from "./variables.js";
import {
  minimalDependencies,
  minimalRuntime,
} from "../testSupport/executorFixtures.js";
import { FakePage } from "../testSupport/inMemoryBrowserDriver.js";
import type { DesktopSurface } from "../surface.js";

describe("variables executors surface seam", () => {
  test("check_conditions in script mode routes through web surface page", async () => {
    const page = new FakePage();
    const runtime = minimalRuntime({ page, outputs: { count: 10 } });
    const executors = buildVariablesExecutors(runtime, minimalDependencies());

    await executors.check_conditions?.({
      type: "check_conditions",
      config: {
        output_name: "is_greater",
        mode: "script",
        script: "outputs.count > 5",
      },
    } as never);

    expect(runtime.outputs.is_greater).toBe(true);
    expect(page.evaluateCalls.length).toBeGreaterThan(0);
  });

  test("check_conditions in script mode rejects when executed on desktop surface", async () => {
    const desktopSurface: DesktopSurface = {
      kind: "desktop",
      driver: {} as never,
      binding: {} as never,
    };
    const runtime = minimalRuntime({
      surface: desktopSurface,
      outputs: { count: 10 },
    });
    const executors = buildVariablesExecutors(runtime, minimalDependencies());

    await expect(
      executors.check_conditions?.({
        type: "check_conditions",
        config: {
          output_name: "is_greater",
          mode: "script",
          script: "outputs.count > 5",
        },
      } as never),
    ).rejects.toThrow(/dispatched on the desktop surface/);
  });

  test("calculate_value routes through web surface page", async () => {
    const page = new FakePage();
    const runtime = minimalRuntime({ page, outputs: { a: 2, b: 3 } });
    const executors = buildVariablesExecutors(runtime, minimalDependencies());

    await executors.calculate_value?.({
      type: "calculate_value",
      config: {
        output_name: "sum",
        expression: "outputs.a + outputs.b",
      },
    } as never);

    expect(runtime.outputs.sum).toBe(5);
  });

  test("calculate_value rejects when executed on desktop surface", async () => {
    const desktopSurface: DesktopSurface = {
      kind: "desktop",
      driver: {} as never,
      binding: {} as never,
    };
    const runtime = minimalRuntime({
      surface: desktopSurface,
      outputs: { a: 2, b: 3 },
    });
    const executors = buildVariablesExecutors(runtime, minimalDependencies());

    await expect(
      executors.calculate_value?.({
        type: "calculate_value",
        config: {
          output_name: "sum",
          expression: "outputs.a + outputs.b",
        },
      } as never),
    ).rejects.toThrow(/dispatched on the desktop surface/);
  });

  test("surface-independent variable actions run without web surface", async () => {
    const desktopSurface: DesktopSurface = {
      kind: "desktop",
      driver: {} as never,
      binding: {} as never,
    };
    const runtime = minimalRuntime({
      surface: desktopSurface,
      outputs: {},
    });
    const executors = buildVariablesExecutors(runtime, minimalDependencies());

    await executors.set_variable?.({
      type: "set_variable",
      config: {
        name: "greeting",
        value: "hello",
        value_type: "text",
      },
    } as never);

    expect(runtime.outputs.greeting).toBe("hello");

    await executors.crypto_operation?.({
      type: "crypto_operation",
      config: {
        operation: "base64_encode",
        value: "hello",
        output_name: "encoded",
      },
    } as never);

    expect(runtime.outputs.encoded).toBe(Buffer.from("hello").toString("base64"));
  });
});
