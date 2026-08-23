import { z } from "zod";

export const setLocalStorageSchema = z.object({
  type: z.literal("set_local_storage"),
  config: z.object({
    key: z.string(),
    value: z.string(),
  }),
});
