import { z } from "zod";

export const acceptDialogSchema = z.object({
  type: z.literal("accept_dialog"),
  config: z.object({
    prompt_text: z.string().nullable().optional(),
  }),
});
