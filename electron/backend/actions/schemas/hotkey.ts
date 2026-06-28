import { z } from "zod";

export const hotkeySchema = z.object({
  type: z.literal("hotkey"),
  config: z.object({
    keys: z.array(z.string()),
  }),
});
