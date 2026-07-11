import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const clickAndSwitchTabSchema = z.object({
  type: z.literal("click_and_switch_tab"),
  config: elementTargetActionConfigSchema,
});
