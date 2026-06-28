import { z } from "zod";

export const assertOutputSchema = z.object({
  type: z.literal("assert_output"),
  config: z.object({
    name: z.string(),
    match_mode: z.enum(["contains", "equals"]),
    value: z.string(),
  }),
});
