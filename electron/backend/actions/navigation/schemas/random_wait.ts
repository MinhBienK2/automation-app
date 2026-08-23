import { z } from "zod";

export const randomWaitSchema = z.object({
  type: z.literal("random_wait"),
  config: z.object({
    min_ms: z.number(),
    max_ms: z.number(),
  }),
});
