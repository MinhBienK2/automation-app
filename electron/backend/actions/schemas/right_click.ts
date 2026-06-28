import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const rightClickSchema = z.object({
  type: z.literal("right_click"),
  config: elementTargetActionConfigSchema,
});
