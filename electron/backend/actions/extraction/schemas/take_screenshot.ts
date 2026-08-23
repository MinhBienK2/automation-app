import { z } from "zod";

export const takeScreenshotSchema = z.object({
  type: z.literal("take_screenshot"),
  config: z.object({
    path: z.string(),
    output_name: z.string().nullable().optional(),
    full_page: z.boolean(),
  }),
});
