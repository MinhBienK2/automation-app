import { z } from "zod";
import { nestedActionSchema } from "./common.js";

export const switchConditionSchema = z.object({
  type: z.literal("switch_condition"),
  config: z.object({
    expression: z.string(),
    cases: z.array(
      z.object({
        value: z.string(),
        steps: z.array(nestedActionSchema),
      }),
    ),
    default_steps: z.array(nestedActionSchema),
  }),
});
