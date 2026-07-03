import { z } from "zod";

const headerPairSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const httpRequestSchema = z.object({
  type: z.literal("http_request"),
  config: z.object({
    method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]),
    url: z.string(),
    headers: z.array(headerPairSchema).nullable().optional(),
    body: z.string().nullable().optional(),
    content_type: z.string().nullable().optional(),
    output_name: z.string(),
    timeout_ms: z.number().nullable().optional(),
  }),
});
