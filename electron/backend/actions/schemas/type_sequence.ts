import { z } from "zod";
import { elementTargetSchema } from "./common.js";

export const typeSequenceSchema = z.object({
  type: z.literal("type_sequence"),
  config: z.object({
    xpath: z.string().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
    iframe_xpath: z.string().nullable().optional(),
    text: z.string(),
    delay_ms: z.number().nullable().optional(),
    wait_until: z
      .enum(["attached", "visible", "enabled", "clickable"])
      .nullable()
      .optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
