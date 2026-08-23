import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const inputTextSchema = z.object({
  type: z.literal("input_text"),
  config: elementTargetActionConfigSchema.extend({
    text: z.string(),
    clear_before_input: z.boolean(),
  }),
});
