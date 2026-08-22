// @vitest-environment node

import { describe, expect, test } from "vitest";
import {
  arrayField,
  asRecord,
  isPlainRecord,
  numberField,
  parseJson,
  parseJsonRecord,
  stringField,
  stringValue,
  stringValueTrimmed,
  validationError,
} from "./records";

describe("backend shared record helpers", () => {
  test("normalizes unknown values to safe record reads", () => {
    expect(asRecord({ id: "node-1" })).toEqual({ id: "node-1" });
    expect(asRecord(null)).toEqual({});
    expect(asRecord("not-record")).toEqual({});
    expect(asRecord(["not", "a", "record"])).toEqual({});
  });

  test("detects non-array plain records", () => {
    expect(isPlainRecord({ nested: true })).toBe(true);
    expect(isPlainRecord([])).toBe(false);
    expect(isPlainRecord(null)).toBe(false);
  });

  test("reads typed fields without coercion", () => {
    const value = {
      name: " Submit ",
      empty: "   ",
      timeout: 250,
      invalidNumber: Number.NaN,
      values: ["a", "b"],
    };

    expect(stringField(value, "name")).toBe(" Submit ");
    expect(stringField(value, "empty")).toBeNull();
    expect(stringField(value, "missing")).toBeNull();
    expect(numberField(value, "timeout")).toBe(250);
    expect(numberField(value, "invalidNumber")).toBeNull();
    expect(numberField(value, "name")).toBeNull();
    expect(arrayField(value, "values")).toEqual(["a", "b"]);
    expect(arrayField(value, "name")).toEqual([]);
  });

  test("creates field-addressable validation errors", () => {
    expect(validationError("config.name", "Name is required")).toEqual({
      field: "config.name",
      message: "Name is required",
    });
  });

  test("reads string values with and without trimming", () => {
    expect(stringValue(" Submit ")).toBe(" Submit ");
    expect(stringValue("   ")).toBeNull();
    expect(stringValue(null)).toBeNull();
    expect(stringValueTrimmed(" Submit ")).toBe("Submit");
    expect(stringValueTrimmed("   ")).toBeNull();
    expect(stringValueTrimmed(42)).toBeNull();
  });

  test("parses json strings and rejects non-record json", () => {
    expect(parseJson<{ a: number }>('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonRecord('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonRecord([1, 2])).toBeNull();
    expect(parseJsonRecord("nope")).toBeNull();
    expect(parseJsonRecord(42)).toBeNull();
  });
});
