import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const uploadFileSchema = z.object({
  type: z.literal("upload_file"),
  config: elementTargetActionConfigSchema.extend({
    files: z.array(z.string()),
  }),
});
