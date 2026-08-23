import { z } from "zod";

export const grantPermissionSchema = z.object({
  type: z.literal("grant_permission"),
  config: z.object({
    origin: z.string().nullable().optional(),
    permissions: z.array(z.string()),
  }),
});
