import { z } from "zod";

export const closeTabSchema = z.object({
  type: z.literal("close_tab"),
  config: z.object({
    index: z.number().nullable().optional(),
  }),
});
