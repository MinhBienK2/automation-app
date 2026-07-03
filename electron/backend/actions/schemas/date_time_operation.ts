import { z } from "zod";

export const dateTimeOperationSchema = z.object({
  type: z.literal("date_time_operation"),
  config: z.object({
    operation: z.enum(["current_timestamp", "format", "add_subtract", "diff"]),
    value: z.string().nullable().optional(),
    format_pattern: z.string().nullable().optional(),
    offset_value: z.number().nullable().optional(),
    offset_unit: z.enum(["days", "hours", "minutes"]).nullable().optional(),
    output_name: z.string(),
  }),
});
