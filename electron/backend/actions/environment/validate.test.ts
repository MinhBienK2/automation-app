// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  assertActionRegistryCoverage,
  validateActionConfig,
} from "../validation.js";

describe("backend action validation registry", () => {
  test("validates action configs through registry-owned validators", () => {
    assertActionRegistryCoverage();

    expect(
      validateActionConfig({
        type: "execute_js",
        config: { script: "", output_name: "result" },
      }),
    ).toEqual({
      field: "script",
      message: "Script is required",
    });
  });
});
