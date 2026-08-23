import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const focusElementSchema = z.object({
  type: z.literal("focus_element"),
  config: elementTargetActionConfigSchema,
});
