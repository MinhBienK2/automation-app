import { z } from "zod";
import { nestedActionSchema } from "../../schemas/common.js";

export const tryCatchSchema = z.object({
  type: z.literal("try_catch"),
  config: z.object({
    try_steps: z.array(nestedActionSchema),
    success_steps: z.array(nestedActionSchema),
    error_steps: z.array(nestedActionSchema),
    finally_steps: z.array(nestedActionSchema),
  }),
});
