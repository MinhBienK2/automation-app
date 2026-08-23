import { z } from "zod";
import { dataCaptureElementConfigSchema } from "../../schemas/common.js";

export const extractInputValueSchema = z.object({
  type: z.literal("extract_input_value"),
  config: dataCaptureElementConfigSchema,
});
