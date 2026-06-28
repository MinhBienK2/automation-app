import { z } from "zod";
import { elementTargetSchema } from "./common.js";

export const assertTextSchema = z.object({
  type: z.literal("assert_text"),
  config: z.object({
    xpath: z.string().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
    iframe_xpath: z.string().nullable().optional(),
    text: z.string(),
    match_mode: z.enum(["contains", "equals"]),
    timeout_ms: z.number().nullable().optional(),
  }),
});
