import { z } from "zod";

export const switchTabSchema = z.object({
  type: z.literal("switch_tab"),
  config: z.object({
    index: z.number(),
  }),
});
