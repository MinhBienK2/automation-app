import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const uncheckSchema = z.object({
  type: z.literal("uncheck"),
  config: elementTargetActionConfigSchema,
});
