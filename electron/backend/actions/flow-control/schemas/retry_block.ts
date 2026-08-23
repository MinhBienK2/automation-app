import { z } from "zod";
import { nestedActionSchema } from "../../schemas/common.js";

export const retryBlockSchema = z.object({
  type: z.literal("retry_block"),
  config: z.object({
    max_attempts: z.number(),
    delay_ms: z.number().nullable().optional(),
    steps: z.array(nestedActionSchema),
    failed_steps: z.array(nestedActionSchema).optional(),
  }),
});
