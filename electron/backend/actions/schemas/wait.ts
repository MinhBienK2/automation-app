import { z } from "zod";
import { elementTargetSchema } from "./common.js";

export const waitConditions = [
  "duration",
  "element_visible",
  "element_hidden",
  "element_attached",
  "element_detached",
  "text_visible",
  "url_contains",
  "page_load",
  "element_enabled",
  "element_disabled",
] as const;

const waitConditionSchema = z.enum(waitConditions);

export const waitSchema = z.object({
  type: z.literal("wait"),
  config: z.object({
    condition: waitConditionSchema,
    xpath: z.string().nullable().optional(),
    text: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    duration_ms: z.number().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
  }),
});
