import { z } from "zod";
import { nestedActionSchema, workflowConditionSchema } from "../../schemas/common.js";

export const whileLoopSchema = z.object({
  type: z.literal("while_loop"),
  config: z.object({
    condition: workflowConditionSchema,
    max_attempts: z.number().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
    steps: z.array(nestedActionSchema),
  }),
});
