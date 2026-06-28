import { z } from "zod";
import { dataCaptureElementConfigSchema } from "./common.js";

export const extractAttributeSchema = z.object({
  type: z.literal("extract_attribute"),
  config: dataCaptureElementConfigSchema.extend({
    attribute: z.string(),
  }),
});
