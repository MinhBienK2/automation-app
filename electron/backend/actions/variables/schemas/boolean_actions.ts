import { z } from "zod";

export const setBooleanVariableSchema = z.object({
  type: z.literal("set_boolean_variable"),
  config: z.object({
    output_name: z.string(),
    value: z.string(),
  }),
});

export const generateRandomBooleanSchema = z.object({
  type: z.literal("generate_random_boolean"),
  config: z.object({
    output_name: z.string(),
    probability: z.union([z.string(), z.number()]).nullable().optional(),
  }),
});

export const parseToBooleanSchema = z.object({
  type: z.literal("parse_to_boolean"),
  config: z.object({
    source: z.string(),
    fallback: z.string().nullable().optional(),
    output_name: z.string(),
  }),
});

export const booleanLogicalOpSchema = z.object({
  type: z.literal("boolean_logical_op"),
  config: z.object({
    operand1: z.string(),
    operation: z.enum(["and", "or", "not", "xor"]),
    operand2: z.string().nullable().optional(),
    output_name: z.string(),
  }),
});

export const compareBooleansSchema = z.object({
  type: z.literal("compare_booleans"),
  config: z.object({
    operand1: z.string(),
    operator: z.enum(["eq", "neq"]),
    operand2: z.string(),
    output_name: z.string(),
  }),
});

export const checkBooleanPropertySchema = z.object({
  type: z.literal("check_boolean_property"),
  config: z.object({
    source: z.string(),
    property: z.enum(["is_true", "is_false"]),
    output_name: z.string(),
  }),
});
