import { z } from "zod";

export const pressKeySchema = z.object({
  type: z.literal("press_key"),
  config: z.object({
    key: z.string(),
  }),
});
