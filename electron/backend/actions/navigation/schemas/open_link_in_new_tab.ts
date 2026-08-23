import { z } from "zod";
import { elementTargetActionConfigSchema } from "../../schemas/common.js";

export const openLinkInNewTabSchema = z.object({
  type: z.literal("open_link_in_new_tab"),
  config: elementTargetActionConfigSchema,
});
