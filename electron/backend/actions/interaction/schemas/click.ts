import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const clickSchema = z.object({
  type: z.literal("click"),
  config: elementTargetActionConfigSchema,
});
