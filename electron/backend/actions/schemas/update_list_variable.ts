import { z } from "zod";
import { variableValueTypeSchema } from "./common.js";

export const updateListVariableSchema = z.object({
  type: z.literal("update_list_variable"),
  config: z.object({
    name: z.string(),
    operation: z.enum([
      "push",
      "unshift",
      "push_unique",
      "pop",
      "shift",
      "remove_by_index",
      "remove_by_value",
      "merge",
      "merge_unique",
    ]),
    value: z.string().nullable().optional(),
    value_type: variableValueTypeSchema.nullable().optional(),
    index: z.union([z.number(), z.string()]).nullable().optional(),
  }),
});
