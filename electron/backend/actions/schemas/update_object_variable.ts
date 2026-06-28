import { z } from "zod";
import { variableValueTypeSchema } from "./common.js";

export const updateObjectVariableSchema = z.object({
  type: z.literal("update_object_variable"),
  config: z.object({
    name: z.string(),
    operation: z.enum(["merge", "deep_merge", "set_key", "delete_key"]),
    value: z.string().nullable().optional(),
    property_key: z.string().nullable().optional(),
    property_value: z.string().nullable().optional(),
    property_value_type: variableValueTypeSchema.nullable().optional(),
  }),
});
