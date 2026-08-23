import { z } from "zod";

export const updateNumberVariableSchema = z.object({
  type: z.literal("update_number_variable"),
  config: z.object({
    name: z.string(),
    operation: z.enum([
      "increment",
      "decrement",
      "add",
      "subtract",
      "multiply",
      "divide",
    ]),
    value: z.string().nullable().optional(),
  }),
});
