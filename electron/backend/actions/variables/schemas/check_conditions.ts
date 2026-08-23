import { z } from "zod";

export const checkConditionsSchema = z.object({
  type: z.literal("check_conditions"),
  config: z.object({
    output_name: z.string(),
    mode: z.enum(["visual", "script"]),
    script: z.string().optional(),
    rules_group: z.unknown().optional(),
    evaluation_type: z.enum(["static", "dynamic"]).optional(),
  }),
});
