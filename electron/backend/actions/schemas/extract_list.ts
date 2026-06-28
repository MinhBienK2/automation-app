import { z } from "zod";
import { dataCaptureElementConfigSchema } from "./common.js";

export const extractListSchema = z.object({
  type: z.literal("extract_list"),
  config: dataCaptureElementConfigSchema,
});
