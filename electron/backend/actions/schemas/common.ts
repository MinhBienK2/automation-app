import { z } from "zod";

export const locatorKindSchema = z.enum([
  "test_id",
  "role",
  "label",
  "placeholder",
  "text",
  "css",
  "xpath",
  "attribute",
]);

export const locatorSchema = z.object({
  kind: locatorKindSchema,
  value: z.string(),
  role: z.string().nullable().optional(),
  attribute: z.string().nullable().optional(),
  exact: z.boolean().nullable().optional(),
});

export const elementTargetConstraintsSchema = z.object({
  visible: z.boolean().nullable().optional(),
  enabled: z.boolean().nullable().optional(),
  contains_text: z.string().nullable().optional(),
  index: z.number().nullable().optional(),
});

export const elementTargetSchema = z.object({
  locators: z.array(locatorSchema),
  constraints: elementTargetConstraintsSchema.nullable().optional(),
  iframe: z.lazy(() => elementTargetSchema).nullable().optional(),
});

export const elementTargetActionConfigSchema = z.object({
  xpath: z.string().nullable().optional(),
  target: elementTargetSchema.nullable().optional(),
  target_ref: z.string().nullable().optional(),
  iframe_xpath: z.string().nullable().optional(),
  wait_until: z.enum(["attached", "visible", "enabled", "clickable"]).nullable().optional(),
  timeout_ms: z.number().nullable().optional(),
});

export const dataCaptureElementConfigSchema = z.object({
  xpath: z.string().nullable().optional(),
  target: elementTargetSchema.nullable().optional(),
  target_ref: z.string().nullable().optional(),
  iframe_xpath: z.string().nullable().optional(),
  output_name: z.string(),
  timeout_ms: z.number().nullable().optional(),
});

export const workflowConditionSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("variable_is_true"),
    name: z.string(),
  }),
  z.object({
    kind: z.literal("text_visible"),
    text: z.string(),
  }),
  z.object({
    kind: z.literal("url_contains"),
    value: z.string(),
  }),
  z.object({
    kind: z.literal("element_visible"),
    xpath: z.string().nullable().optional(),
    target: elementTargetSchema.nullable().optional(),
    target_ref: z.string().nullable().optional(),
  }),
]);

export const positiveNumberSchema = z.number().positive();

export const optionalPositiveNumberSchema = z.number().positive().nullable().optional();
