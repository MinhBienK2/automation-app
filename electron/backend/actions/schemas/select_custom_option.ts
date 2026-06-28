import { z } from "zod";
import { elementTargetSchema } from "./common.js";

export const selectCustomOptionSchema = z.object({
  type: z.literal("select_custom_option"),
  config: z.object({
    trigger_xpath: z.string().nullable().optional(),
    trigger_target: elementTargetSchema.nullable().optional(),
    trigger_ref: z.string().nullable().optional(),
    option_text: z.string(),
    iframe_xpath: z.string().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
