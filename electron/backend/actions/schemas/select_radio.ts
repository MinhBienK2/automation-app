import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const selectRadioSchema = z.object({
  type: z.literal("select_radio"),
  config: elementTargetActionConfigSchema,
});
