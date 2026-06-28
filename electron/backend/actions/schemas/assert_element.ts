import { z } from "zod";
import { elementTargetSchema } from "./common.js";

export const assertElementSchema = z.object({
  type: z.literal("assert_element"),
  config: z.object({
    xpath: z.string().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
    iframe_xpath: z.string().nullable().optional(),
    state: z.enum(["attached", "visible", "hidden", "enabled", "disabled"]),
    timeout_ms: z.number().nullable().optional(),
  }),
});
