import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const clearInputSchema = z.object({
  type: z.literal("clear_input"),
  config: elementTargetActionConfigSchema,
});
