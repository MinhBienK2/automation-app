import { z } from "zod";

export const setSessionStorageSchema = z.object({
  type: z.literal("set_session_storage"),
  config: z.object({
    key: z.string(),
    value: z.string(),
  }),
});
