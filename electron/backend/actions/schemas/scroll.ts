import { z } from "zod";
import { elementTargetSchema } from "./common.js";

export const scrollModeSchema = z.enum([
  "page",
  "into_view",
  "until_element_visible",
]);

export const scrollDirectionSchema = z.enum(["up", "down", "left", "right"]);

export const scrollStyleSchema = z.enum(["human_like", "smooth_single"]);

export const scrollSchema = z.object({
  type: z.literal("scroll"),
  config: z.object({
    mode: scrollModeSchema.nullable().optional(),
    direction: scrollDirectionSchema,
    pixels: z.number(),
    scroll_style: scrollStyleSchema.nullable().optional(),
    xpath: z.string().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
    iframe_xpath: z.string().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
