// @vitest-environment node
import { describe, expect, test } from "vitest";
import { getPath, setPath, deletePath, hasPath } from "./objectHelpers.js";

describe("object dot-path helpers", () => {
  test("getPath retrieves nested values", () => {
    const obj = { a: { b: { c: 42 } } };
    expect(getPath(obj, "a.b.c")).toBe(42);
    expect(getPath(obj, "a.b")).toEqual({ c: 42 });
    expect(getPath(obj, "a.x")).toBeUndefined();
    expect(getPath(obj, "a.b.c.d")).toBeUndefined();
  });

  test("setPath sets nested values and creates intermediate structures", () => {
    const obj: any = {};
    setPath(obj, "a.b.c", 42);
    expect(obj).toEqual({ a: { b: { c: 42 } } });

    setPath(obj, "a.b.d", "hello");
    expect(obj).toEqual({ a: { b: { c: 42, d: "hello" } } });
  });

  test("deletePath removes nested properties", () => {
    const obj = { a: { b: { c: 42, d: 24 } } };
    deletePath(obj, "a.b.c");
    expect(obj).toEqual({ a: { b: { d: 24 } } });

    deletePath(obj, "a.x"); // should not throw
    expect(obj).toEqual({ a: { b: { d: 24 } } });
  });

  test("hasPath checks existence of nested properties", () => {
    const obj = { a: { b: { c: 42, d: null } } };
    expect(hasPath(obj, "a.b.c")).toBe(true);
    expect(hasPath(obj, "a.b.d")).toBe(true);
    expect(hasPath(obj, "a.b.x")).toBe(false);
    expect(hasPath(obj, "a.x.y")).toBe(false);
  });
});
