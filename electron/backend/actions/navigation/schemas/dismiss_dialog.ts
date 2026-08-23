import { z } from "zod";

export const dismissDialogSchema = z.object({
  type: z.literal("dismiss_dialog"),
  config: z.object({}),
});
