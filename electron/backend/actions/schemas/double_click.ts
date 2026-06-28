import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const doubleClickSchema = z.object({
  type: z.literal("double_click"),
  config: elementTargetActionConfigSchema,
});
