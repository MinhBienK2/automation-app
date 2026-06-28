import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const checkSchema = z.object({
  type: z.literal("check"),
  config: elementTargetActionConfigSchema,
});
