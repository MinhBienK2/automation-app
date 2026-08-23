import { z } from "zod";

export const calculateValueSchema = z.object({
  type: z.literal("calculate_value"),
  config: z.object({
    output_name: z.string(),
    expression: z.string(),
    evaluation_type: z.enum(["static", "dynamic"]).optional(),
  }),
});
