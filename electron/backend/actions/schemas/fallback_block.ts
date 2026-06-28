import { z } from "zod";
import { nestedActionSchema } from "./common.js";

export const fallbackBlockSchema = z.object({
  type: z.literal("fallback_block"),
  config: z.object({
    primary_steps: z.array(nestedActionSchema),
    fallback_steps: z.array(nestedActionSchema),
  }),
});
