import { z } from "zod";

export const goBackSchema = z.object({
  type: z.literal("go_back"),
  config: z.object({}),
});
