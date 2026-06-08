import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../src/types/workflow.js";
import {
  actionConfigSummary,
  actionEvidenceModel,
  actionTraceMode,
  runtimeErrorDiagnostics,
  summarizeOutputChanges,
} from "./actionTrace.js";

describe("actionTrace", () => {
  test("summarizes targets and output names for action traces", () => {
    const action: ActionConfig = {
      type: "extract_attribute",
      config: {
        target: {
          locators: [{ kind: "css", value: "#email" }],
          constraints: {},
        },
        attribute: "href",
        output_name: "profile_url",
      },
    };

    expect(actionConfigSummary(action)).toBe("CSS #email | Attribute href -> profile_url");
  });

  test("builds runtime diagnostics from nested compiled step context", () => {
    expect(
      runtimeErrorDiagnostics({
        currentStepId: "call-login::fill-email",
        currentStepName: "Login > Fill email",
        currentStepMetadata: {
          subflow: {
            id: "subflow-login",
            name: "Login",
            step_number: 2,
            step_count: 4,
          },
        },
        currentActionSummary: "CSS #email",
        liveState: { current_step_id: "call-login::fill-email" },
      }),
    ).toEqual({
      compiled_step_id: "call-login::fill-email",
      parent_step_id: "call-login",
      subflow_node_id: "fill-email",
      subflow_id: "subflow-login",
      subflow_name: "Login",
      subflow_step_number: 2,
      subflow_step_count: 4,
      label_path: ["Login", "Fill email"],
      action_summary: "CSS #email",
    });
  });

  test("classifies trace modes, evidence categories, and output deltas", () => {
    expect(actionTraceMode({ type: "execute_js", config: { script: "return 1", output_name: "result" } }))
      .toBe("direct_dom");
    expect(actionEvidenceModel({ type: "execute_js", config: { script: "return 1", output_name: "result" } }))
      .toEqual({
        evidence_categories: ["operator_input", "page_observation", "sensitive_redacted"],
        audit_tags: ["direct_dom_script", "requires_review"],
      });
    expect(summarizeOutputChanges(new Map([["old", 1], ["changed", 1]]), { changed: 2, next: 3 }))
      .toEqual({
        added_keys: ["next"],
        changed_keys: ["changed"],
        removed_keys: ["old"],
      });
  });
});
