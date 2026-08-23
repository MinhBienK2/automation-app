import { z } from "zod";

export const getCurrentUrlSchema = z.object({
  type: z.literal("get_current_url"),
  config: z.object({}),
});
