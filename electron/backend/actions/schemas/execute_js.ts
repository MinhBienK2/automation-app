import { z } from "zod";

export const executeJsSchema = z.object({
  type: z.literal("execute_js"),
  config: z.object({
    script: z.string(),
    output_name: z.string().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
