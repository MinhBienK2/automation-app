import { z } from "zod";

export const breakLoopSchema = z.object({
  type: z.literal("break_loop"),
  config: z.object({}),
});
