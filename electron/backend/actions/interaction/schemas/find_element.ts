import { z } from "zod";
import { elementTargetSchema } from "../../schemas/common.js";

export const findElementRankSchema = z.enum([
  "first",
  "nearest_viewport_center",
  "largest_visible_area",
]);

export const findElementFilterSchema = z.object({
  in_viewport: z.boolean().nullable().optional(),
});

export const findElementSchema = z.object({
  type: z.literal("find_element"),
  config: z.object({
    xpath: z.string().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    iframe_xpath: z.string().nullable().optional(),
    output_name: z.string(),
    filter: findElementFilterSchema.nullable().optional(),
    rank: findElementRankSchema.nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
