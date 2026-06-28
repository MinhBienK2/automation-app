import { z } from "zod";

export const extractRegexMatchesSchema = z.object({
  type: z.literal("extract_regex_matches"),
  config: z.object({
    source_name: z.string(),
    pattern: z.string(),
    flags: z.string().nullable().optional(),
    output_name: z.string(),
    append: z.boolean().nullable().optional(),
    dedupe: z.boolean().nullable().optional(),
  }),
});
