import { z } from "zod";

export const setCookieSchema = z.object({
  type: z.literal("set_cookie"),
  config: z.object({
    name: z.string(),
    value: z.string(),
    domain: z.string().nullable().optional(),
    path: z.string().nullable().optional(),
  }),
});
