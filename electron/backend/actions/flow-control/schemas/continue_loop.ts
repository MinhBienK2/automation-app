import { z } from "zod";

export const continueLoopSchema = z.object({
  type: z.literal("continue_loop"),
  config: z.object({}),
});
