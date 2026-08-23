import { z } from "zod";
import { nestedActionSchema, workflowConditionSchema } from "../../schemas/common.js";

export const routerConditionSchema = z.object({
  type: z.literal("router_condition"),
  config: z.object({
    mode: z.literal("first_match"),
    cases: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        condition: workflowConditionSchema,
        steps: z.array(nestedActionSchema),
      }),
    ),
    default_steps: z.array(nestedActionSchema),
  }),
});
