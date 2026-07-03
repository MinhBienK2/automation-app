import { z } from "zod";

export const readTextFileSchema = z.object({
  type: z.literal("read_text_file"),
  config: z.object({
    path: z.string(),
    output_name: z.string(),
    encoding: z.enum(["utf-8", "base64"]).nullable().optional(),
  }),
});
