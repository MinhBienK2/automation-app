// @vitest-environment node

import { describe, expect, test } from "vitest";
import { finalizeEvidenceOutputs } from "./model";

describe("evidence model", () => {
  test("classifies evidence outputs and redacts or limits unsafe values", () => {
    const outputs = finalizeEvidenceOutputs({
      browser_identity: { identity_id: "bi_identity", fingerprint_seed_hash: "hash" },
      fingerprint_preflight: { verdict: "passed", evidence: { canvas_hash_bucket: "stable" } },
      extracted_text: "owned page observation",
      api_token: "secret-token",
      script_result: "x".repeat(5000),
      __action_traces: [
        {
          node_id: "script",
          action_type: "execute_js",
          status: "success",
        },
      ],
      __evidence: [
        {
          artifact_kind: "screenshot",
          path: "runs/run-1/screenshots/001-shot.png",
        },
      ],
    });

    expect(outputs.api_token).toBe("[REDACTED]");
    expect(String(outputs.script_result)).toContain("[TRUNCATED");
    expect(outputs.__action_traces).toEqual([
      {
        node_id: "script",
        action_type: "execute_js",
        status: "success",
      },
    ]);
    expect(outputs.__evidence_model).toMatchObject({
      schema_version: 1,
      categories: [
        "operator_input",
        "browser_identity",
        "network_posture",
        "action_trace",
        "page_observation",
        "generated_output",
        "sensitive_redacted",
      ],
      outputs: expect.arrayContaining([
        expect.objectContaining({ key: "browser_identity", category: "browser_identity" }),
        expect.objectContaining({ key: "fingerprint_preflight", category: "network_posture" }),
        expect.objectContaining({ key: "__action_traces", category: "action_trace" }),
        expect.objectContaining({ key: "__evidence", category: "generated_output" }),
        expect.objectContaining({ key: "api_token", category: "sensitive_redacted", redacted: true }),
        expect.objectContaining({ key: "script_result", truncated: true }),
      ]),
    });
  });
});
