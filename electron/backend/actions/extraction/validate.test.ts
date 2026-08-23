// @vitest-environment node

import { describe, expect, test } from "vitest";
import type { ActionConfig } from "../../../../src/types/workflow.js";
import {
  validateActionConfig,
} from "../validation.js";

describe("backend action validation registry", () => {
  test("validates regex extraction and text file action configs", () => {
    expect(
      validateActionConfig({
        type: "extract_regex_matches",
        config: {
          source_name: "comment_text",
          pattern: "@[A-Za-z0-9._-]+",
          flags: "gi",
          output_name: "handles",
          append: true,
          dedupe: true,
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "extract_regex_matches",
        config: {
          source_name: "",
          pattern: "@[A-Za-z0-9._-]+",
          output_name: "handles",
        },
      } as never),
    ).toEqual({
      field: "source_name",
      message: "Source output is required",
    });

    expect(
      validateActionConfig({
        type: "write_text_file",
        config: {
          source_name: "handles",
          path: "tiktok-usernames.txt",
          output_name: "tiktok_username_file",
        },
      } as never),
    ).toBeNull();

    expect(
      validateActionConfig({
        type: "write_text_file",
        config: {
          source_name: "handles",
          path: "../outside.txt",
          output_name: "file",
        },
      } as never),
    ).toEqual({
      field: "path",
      message: "Text file path must be a safe artifact name",
    });
  });
});
