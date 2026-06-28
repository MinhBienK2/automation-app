import { z } from "zod";

export const waitForRequestSchema = z.object({
  type: z.literal("wait_for_request"),
  config: z.object({
    url_contains: z.string(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
