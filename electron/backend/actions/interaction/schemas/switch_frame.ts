import { z } from "zod";

export const switchFrameSchema = z.object({
  type: z.literal("switch_frame"),
  config: z.object({
    iframe_xpath: z.string(),
  }),
});
