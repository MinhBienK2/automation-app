import { z } from "zod";
import { nestedActionSchema, workflowConditionSchema } from "../../schemas/common.js";

export const repeatUntilSchema = z.object({
  type: z.literal("repeat_until"),
  config: z.object({
    condition: workflowConditionSchema,
    max_attempts: z.number().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
    steps: z.array(nestedActionSchema),
    timeout_steps: z.array(nestedActionSchema),
  }),
});
