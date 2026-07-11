import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const clickOpenTabSchema = z.object({
  type: z.literal("click_open_tab"),
  config: elementTargetActionConfigSchema,
});
