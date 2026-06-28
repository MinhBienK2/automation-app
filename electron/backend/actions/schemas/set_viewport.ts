import { z } from "zod";

export const setViewportSchema = z.object({
  type: z.literal("set_viewport"),
  config: z.object({
    width: z.number(),
    height: z.number(),
  }),
});
