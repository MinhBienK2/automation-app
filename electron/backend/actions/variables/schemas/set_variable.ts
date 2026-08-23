import { z } from "zod";

const variableValueTypeSchema = z.enum(["text", "json", "number", "boolean"]);

const variableAssignmentSchema = z.object({
  name: z.string(),
  value: z.string(),
  value_type: variableValueTypeSchema.optional(),
});

export const setVariableSchema = z.object({
  type: z.literal("set_variable"),
  config: z.object({
    name: z.string().nullable().optional(),
    value: z.string().nullable().optional(),
    value_type: variableValueTypeSchema.nullable().optional(),
    variables: z.array(variableAssignmentSchema).optional(),
  }),
});
