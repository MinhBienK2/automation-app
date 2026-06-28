import { z } from "zod";

export const setClipboardSchema = z.object({
  type: z.literal("set_clipboard"),
  config: z.object({
    text: z.string(),
  }),
});
