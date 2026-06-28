import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const hoverSchema = z.object({
  type: z.literal("hover"),
  config: elementTargetActionConfigSchema,
});
