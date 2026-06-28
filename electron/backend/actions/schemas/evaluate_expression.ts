import { z } from "zod";

export const evaluateExpressionSchema = z.object({
  type: z.literal("evaluate_expression"),
  config: z.object({
    output_name: z.string(),
    expression: z.string(),
    evaluation_type: z.enum(["static", "dynamic"]).optional(),
  }),
});
