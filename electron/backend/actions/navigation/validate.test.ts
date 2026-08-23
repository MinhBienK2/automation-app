// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  validateActionConfig,
} from "../validation.js";

describe("backend action validation registry", () => {
  test("allows variable templates in numeric fields", () => {
    expect(
      validateActionConfig({
        type: "switch_tab",
        config: { index: "{{tab_index}}" as any },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "wait",
        config: {
          condition: "duration",
          duration_ms: "{{my_wait_time}}" as any,
          timeout_ms: "{{my_timeout}}" as any,
        },
      }),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "wait_for_download",
        config: {
          output_name: "file_result",
          timeout_ms: "{{download_timeout}}" as any,
        },
      }),
    ).toBeNull();
  });
});
