import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const setContenteditableSchema = z.object({
  type: z.literal("set_contenteditable"),
  config: elementTargetActionConfigSchema.extend({
    text: z.string(),
    clear_before_input: z.boolean(),
  }),
});
