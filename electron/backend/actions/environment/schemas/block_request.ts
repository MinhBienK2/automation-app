import { z } from "zod";

export const blockRequestSchema = z.object({
  type: z.literal("block_request"),
  config: z.object({
    url_patterns: z.array(z.string()),
  }),
});
