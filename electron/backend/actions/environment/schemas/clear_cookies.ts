import { z } from "zod";

export const clearCookiesSchema = z.object({
  type: z.literal("clear_cookies"),
  config: z.object({
    domain: z.string().nullable().optional(),
  }),
});
