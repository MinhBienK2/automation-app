import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const blurElementSchema = z.object({
  type: z.literal("blur_element"),
  config: elementTargetActionConfigSchema,
});
