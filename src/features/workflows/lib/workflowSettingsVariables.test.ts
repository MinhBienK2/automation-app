import { describe, expect, test } from "vitest";
import {
  variableRowsFromJsonText,
  variablesJsonFromRows,
} from "./workflowSettingsVariables";

describe("workflow settings variable helpers", () => {
  test("converts variable JSON to rows and back", () => {
    const parsed = variableRowsFromJsonText(`{"user":{"email":"ada@example.test"},"active":true}`);

    expect(parsed).toEqual({
      rows: [
        { name: "user.email", value_type: "text", value: "ada@example.test" },
        { name: "active", value_type: "boolean", value: "true" },
      ],
      error: null,
    });
    expect(variablesJsonFromRows(parsed.rows)).toBe(
      [
        "{",
        "  \"user\": {",
        "    \"email\": \"ada@example.test\"",
        "  },",
        "  \"active\": true",
        "}",
      ].join("\n"),
    );
  });
});
