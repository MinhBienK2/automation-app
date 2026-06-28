import { z } from "zod";

export const graphNoopSchema = z.object({
  type: z.literal("graph_noop"),
  config: z.object({
    kind: z.literal("merge"),
  }),
});
