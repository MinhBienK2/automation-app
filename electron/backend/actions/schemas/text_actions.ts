import { z } from "zod";

export const setTextVariableSchema = z.object({
  type: z.literal("set_text_variable"),
  config: z.object({
    output_name: z.string(),
    value: z.string().nullable().optional(),
  }),
});

export const appendTextSchema = z.object({
  type: z.literal("append_text"),
  config: z.object({
    name: z.string(),
    value: z.string().nullable().optional(),
  }),
});

export const prependTextSchema = z.object({
  type: z.literal("prepend_text"),
  config: z.object({
    name: z.string(),
    value: z.string().nullable().optional(),
  }),
});

export const replaceTextSchema = z.object({
  type: z.literal("replace_text"),
  config: z.object({
    name: z.string(),
    search_pattern: z.string(),
    replacement: z.string().nullable().optional(),
  }),
});

export const trimTextSchema = z.object({
  type: z.literal("trim_text"),
  config: z.object({
    name: z.string(),
  }),
});

export const changeTextCaseSchema = z.object({
  type: z.literal("change_text_case"),
  config: z.object({
    name: z.string(),
    to_case: z.enum(["upper", "lower"]),
  }),
});

export const sliceTextSchema = z.object({
  type: z.literal("slice_text"),
  config: z.object({
    source: z.string(),
    start: z.union([z.number(), z.string()]),
    end: z.union([z.number(), z.string()]).nullable().optional(),
    output_name: z.string(),
  }),
});

export const regexExtractSchema = z.object({
  type: z.literal("regex_extract"),
  config: z.object({
    source: z.string(),
    pattern: z.string(),
    group_index: z.union([z.number(), z.string()]).nullable().optional(),
    output_name: z.string(),
  }),
});

export const getTextLengthSchema = z.object({
  type: z.literal("get_text_length"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const checkTextEmptySchema = z.object({
  type: z.literal("check_text_empty"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const checkTextContainsSchema = z.object({
  type: z.literal("check_text_contains"),
  config: z.object({
    source: z.string(),
    substring: z.string(),
    output_name: z.string(),
  }),
});

export const checkTextRegexMatchesSchema = z.object({
  type: z.literal("check_text_regex_matches"),
  config: z.object({
    source: z.string(),
    pattern: z.string(),
    output_name: z.string(),
  }),
});
