import { z } from "zod";
import { dataCaptureElementConfigSchema } from "../../schemas/common.js";

export const extractTextSchema = z.object({
  type: z.literal("extract_text"),
  config: dataCaptureElementConfigSchema,
});
