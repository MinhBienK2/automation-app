import { z } from "zod";
import { elementTargetActionConfigSchema } from "./common.js";

export const pasteClipboardSchema = z.object({
  type: z.literal("paste_clipboard"),
  config: elementTargetActionConfigSchema,
});
