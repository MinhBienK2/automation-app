import { z } from "zod";

export const waitForDownloadSchema = z.object({
  type: z.literal("wait_for_download"),
  config: z.object({
    output_name: z.string(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
