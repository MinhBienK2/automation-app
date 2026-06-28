import { z } from "zod";

export const waitForResponseSchema = z.object({
  type: z.literal("wait_for_response"),
  config: z.object({
    url_contains: z.string(),
    status: z.number().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
