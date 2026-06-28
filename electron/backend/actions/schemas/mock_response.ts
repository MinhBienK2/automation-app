import { z } from "zod";

export const mockResponseSchema = z.object({
  type: z.literal("mock_response"),
  config: z.object({
    url_contains: z.string(),
    status: z.number(),
    body: z.string(),
    content_type: z.string().nullable().optional(),
  }),
});
