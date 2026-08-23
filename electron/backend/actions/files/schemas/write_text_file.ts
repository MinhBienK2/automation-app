import { z } from "zod";

export const writeTextFileSchema = z.object({
  type: z.literal("write_text_file"),
  config: z.object({
    source_name: z.string(),
    path: z.string(),
    output_name: z.string(),
    separator: z.string().nullable().optional(),
    include_trailing_newline: z.boolean().nullable().optional(),
  }),
});
