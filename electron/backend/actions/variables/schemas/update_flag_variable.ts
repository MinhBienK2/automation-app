import { z } from "zod";

export const updateFlagVariableSchema = z.object({
  type: z.literal("update_flag_variable"),
  config: z.object({
    name: z.string(),
    operation: z.enum(["toggle", "set_true", "set_false"]),
  }),
});
