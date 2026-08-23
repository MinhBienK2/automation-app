import { z } from "zod";
import { elementTargetSchema } from "../../schemas/common.js";

export const dragTargetPositionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("center") }),
  z.object({
    mode: z.literal("percent"),
    x_percent: z.number(),
    y_percent: z.number(),
  }),
  z.object({
    mode: z.literal("offset"),
    x_px: z.number(),
    y_px: z.number(),
  }),
]);

export const dragAndDropSchema = z.object({
  type: z.literal("drag_and_drop"),
  config: z.object({
    source_xpath: z.string().nullable().optional(),
    source_target: elementTargetSchema.nullable().optional(),
    source_ref: z.string().nullable().optional(),
    target_xpath: z.string().nullable().optional(),
    target_target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
    target_position: dragTargetPositionSchema.nullable().optional(),
    iframe_xpath: z.string().nullable().optional(),
    wait_until: z
      .enum(["attached", "visible", "enabled", "clickable"])
      .nullable()
      .optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
