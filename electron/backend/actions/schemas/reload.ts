import { z } from "zod";

export const reloadSchema = z.object({
  type: z.literal("reload"),
  config: z.object({}),
});
