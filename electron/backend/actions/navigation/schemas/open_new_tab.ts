import { z } from "zod";

export const openNewTabSchema = z.object({
  type: z.literal("open_new_tab"),
  config: z.object({
    url: z.string().nullable().optional(),
  }),
});
