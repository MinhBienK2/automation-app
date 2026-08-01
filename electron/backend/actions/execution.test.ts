// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../src/types/workflow";
import {
  assertActionExecutorCoverage,
  createActionExecutorMap,
  executeRegisteredAction,
  type ActionExecutorMap,
} from "./execution";
import { actionDefinitions } from "./registry";

describe("backend action execution registry", () => {
  test("dispatches action configs through a registry-covered execution handler", async () => {
    const calls: string[] = [];
    // Derived from the registry rather than hand-written. The 160-key literal
    // this replaces was 27 entries short of the registry and had been failing at
    // run time; production coverage is compile-checked by `ActionExecutorMap`
    // being a total map, so a hand-written fixture only ever rots.
    const executors = createActionExecutorMap(
      Object.fromEntries(
        actionDefinitions.map((definition) => [
          definition.type,
          async (action: ActionConfig) =>
            calls.push(
              action.type === "navigate"
                ? `navigate:${(action.config as { url?: string }).url}`
                : action.type === "execute_js"
                  ? `execute_js:${(action.config as { script?: string }).script}`
                  : definition.type,
            ),
        ]),
      ) as ActionExecutorMap,
    );

    assertActionExecutorCoverage(executors);
    await executeRegisteredAction(executors, {
      type: "execute_js",
      config: { script: "return 42", output_name: "answer" },
    });

    expect(calls).toEqual(["execute_js:return 42"]);
  });

  test("rejects unknown action configs before handler lookup", async () => {
    const executors = createActionExecutorMap({} as never);

    await expect(
      executeRegisteredAction(executors, {
        type: "legacy_action",
        config: {},
      } as ActionConfig),
    ).rejects.toThrow("Unsupported action type: legacy_action");
  });

  test("reports registered actions missing execution handlers", () => {
    expect(() => assertActionExecutorCoverage({ navigate: async () => undefined })).toThrow(
      "Action wait is registered without an execution handler",
    );
  });
});
