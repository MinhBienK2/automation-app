import { z } from "zod";

export const updateTextVariableSchema = z.object({
  type: z.literal("update_text_variable"),
  config: z.object({
    name: z.string(),
    operation: z.enum([
      "append",
      "prepend",
      "replace",
      "uppercase",
      "lowercase",
      "trim",
    ]),
    value: z.string().nullable().optional(),
    search_pattern: z.string().nullable().optional(),
  }),
});
