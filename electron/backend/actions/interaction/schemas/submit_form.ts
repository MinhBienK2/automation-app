import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const submitFormSchema = z.object({
  type: z.literal("submit_form"),
  config: elementTargetActionConfigSchema,
});
