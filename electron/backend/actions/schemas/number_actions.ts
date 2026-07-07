import { z } from "zod";

export const setNumberVariableSchema = z.object({
  type: z.literal("set_number_variable"),
  config: z.object({
    output_name: z.string(),
    value: z.string(),
  }),
});

export const generateRandomNumberSchema = z.object({
  type: z.literal("generate_random_number"),
  config: z.object({
    output_name: z.string(),
    min: z.string(),
    max: z.string(),
    integer: z.boolean().default(true),
  }),
});

export const parseTextToNumberSchema = z.object({
  type: z.literal("parse_text_to_number"),
  config: z.object({
    source: z.string(),
    fallback: z.string().nullable().optional(),
    output_name: z.string(),
  }),
});

export const mathOperationSchema = z.object({
  type: z.literal("math_operation"),
  config: z.object({
    operand1: z.string(),
    operation: z.enum([
      "add",
      "subtract",
      "multiply",
      "divide",
      "modulo",
      "power",
      "abs",
      "sqrt",
      "min",
      "max",
    ]),
    operand2: z.string().nullable().optional(),
    output_name: z.string(),
  }),
});

export const roundNumberSchema = z.object({
  type: z.literal("round_number"),
  config: z.object({
    source: z.string(),
    mode: z.enum(["round", "floor", "ceil"]),
    decimals: z.string().default("0"),
    output_name: z.string(),
  }),
});

export const formatNumberSchema = z.object({
  type: z.literal("format_number"),
  config: z.object({
    source: z.string(),
    format: z.enum(["decimal", "currency", "percent"]),
    decimals: z.string().nullable().optional(),
    currency_code: z.string().nullable().optional(),
    locale: z.string().nullable().optional(),
    output_name: z.string(),
  }),
});

export const compareNumbersSchema = z.object({
  type: z.literal("compare_numbers"),
  config: z.object({
    operand1: z.string(),
    operator: z.enum(["gt", "gte", "lt", "lte", "eq", "neq"]),
    operand2: z.string(),
    output_name: z.string(),
  }),
});

export const checkNumberRangeSchema = z.object({
  type: z.literal("check_number_range"),
  config: z.object({
    value: z.string(),
    min: z.string(),
    max: z.string(),
    inclusive: z.boolean().default(true),
    output_name: z.string(),
  }),
});

export const checkNumberPropertySchema = z.object({
  type: z.literal("check_number_property"),
  config: z.object({
    value: z.string(),
    property: z.enum(["even", "odd", "integer", "positive", "negative"]),
    output_name: z.string(),
  }),
});
