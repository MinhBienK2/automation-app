import { z } from "zod";

export const transformVariableSchema = z.object({
  type: z.literal("transform_variable"),
  config: z.object({
    source_name: z.string(),
    target_name: z.string(),
    expression: z.string(),
  }),
});
