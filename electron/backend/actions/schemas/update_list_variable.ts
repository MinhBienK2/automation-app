import { z } from "zod";
import { listVariableOperations } from "../../../../src/types/actionEnums.js";
import { variableValueTypeSchema } from "./common.js";

export const updateListVariableSchema = z.object({
  type: z.literal("update_list_variable"),
  config: z.object({
    name: z.string(),
    operation: z.enum(listVariableOperations),
    value: z.string().nullable().optional(),
    value_type: variableValueTypeSchema.nullable().optional(),
    index: z.union([z.number(), z.string()]).nullable().optional(),
  }),
});
