import { z } from "zod";

export const navigateSchema = z.object({
  type: z.literal("navigate"),
  config: z.object({
    url: z.string(),
    wait_until: z.enum(["load", "dom_content_loaded", "network_idle"]).nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
