import { z } from "zod";
import { dataCaptureElementConfigSchema } from "../../schemas/common.js";

export const extractTableSchema = z.object({
  type: z.literal("extract_table"),
  config: dataCaptureElementConfigSchema,
});
