import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const selectOptionSchema = z.object({
  type: z.literal("select_option"),
  config: elementTargetActionConfigSchema.extend({
    match_by: z.enum(["label", "value"]),
    value: z.string(),
  }),
});
