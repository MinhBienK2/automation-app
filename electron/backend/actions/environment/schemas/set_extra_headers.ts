import { z } from "zod";

const headerPairSchema = z.object({
  name: z.string(),
  value: z.string(),
});

export const setExtraHeadersSchema = z.object({
  type: z.literal("set_extra_headers"),
  config: z.object({
    headers: z.array(headerPairSchema),
  }),
});
