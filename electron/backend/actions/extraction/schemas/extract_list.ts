import { z } from "zod";
import { dataCaptureElementConfigSchema } from "../../schemas/common.js";

export const extractListSchema = z.object({
  type: z.literal("extract_list"),
  config: dataCaptureElementConfigSchema,
});
