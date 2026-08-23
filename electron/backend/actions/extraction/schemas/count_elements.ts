import { z } from "zod";
import { dataCaptureElementConfigSchema } from "../../schemas/common.js";

export const countElementsSchema = z.object({
  type: z.literal("count_elements"),
  config: dataCaptureElementConfigSchema,
});
