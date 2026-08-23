import { z } from "zod";

export const goForwardSchema = z.object({
  type: z.literal("go_forward"),
  config: z.object({}),
});
