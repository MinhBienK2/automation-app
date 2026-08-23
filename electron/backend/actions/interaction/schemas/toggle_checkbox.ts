import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const toggleCheckboxSchema = z.object({
  type: z.literal("toggle_checkbox"),
  config: elementTargetActionConfigSchema,
});
