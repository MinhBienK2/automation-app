/**
 * Zod schemas for the Desktop Surface action family.
 *
 * Shape only — whether a config is complete enough to run is `validation.ts`,
 * the same asymmetry the web schemas keep.
 *
 * Spec: `docs/domain/desktop/action-family.md`.
 */

import { z } from "zod";

const nameMatchSchema = z.object({
  kind: z.enum(["exact", "prefix", "pattern"]),
  value: z.string(),
});

const locatorSchema = z.object({
  role: z.string(),
  name: nameMatchSchema.nullable().optional(),
  ancestors: z
    .array(z.object({ role: z.string(), name: nameMatchSchema.nullable().optional() }))
    .nullable()
    .optional(),
  ordinal: z.number().nullable().optional(),
  automation_id: z.string().nullable().optional(),
});

/**
 * A discriminated union, not optional coordinates on the locator: the two
 * carry different reliability contracts, and a step must not be able to sit
 * half-specified between them.
 */
const targetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("element"), locator: locatorSchema }),
  z.object({
    kind: z.literal("pixel"),
    x: z.number(),
    y: z.number(),
    // Window-relative. Screen coordinates break when the window moves.
    origin: z.literal("window"),
  }),
]);

const predicateSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("window_exists") }),
  z.object({ kind: z.literal("element_present"), locator: locatorSchema }),
  z.object({ kind: z.literal("element_value"), locator: locatorSchema, expected: z.string() }),
]);

const stepConfig = {
  target: targetSchema,
  expect: z.array(predicateSchema).nullable().optional(),
  timeout_ms: z.number().nullable().optional(),
  sensitive: z.boolean().nullable().optional(),
};

export const desktopClickSchema = z.object({
  type: z.literal("desktop_click"),
  config: z.object({
    ...stepConfig,
    button: z.enum(["left", "right", "middle"]).nullable().optional(),
    count: z.number().nullable().optional(),
  }),
});

export const desktopSetValueSchema = z.object({
  type: z.literal("desktop_set_value"),
  config: z.object({ ...stepConfig, value: z.string() }),
});

export const desktopTypeTextSchema = z.object({
  type: z.literal("desktop_type_text"),
  config: z.object({ ...stepConfig, text: z.string() }),
});

export const desktopPressKeySchema = z.object({
  type: z.literal("desktop_press_key"),
  config: z.object({
    ...stepConfig,
    key: z.string(),
    modifiers: z.array(z.string()).nullable().optional(),
  }),
});

export const desktopHotkeySchema = z.object({
  type: z.literal("desktop_hotkey"),
  config: z.object({ ...stepConfig, keys: z.array(z.string()) }),
});

export const desktopReadTextSchema = z.object({
  type: z.literal("desktop_read_text"),
  config: z.object({ ...stepConfig, output_name: z.string() }),
});

export const desktopWaitForSchema = z.object({
  type: z.literal("desktop_wait_for"),
  config: z.object({ ...stepConfig, expect: z.array(predicateSchema) }),
});

export const desktopScreenshotSchema = z.object({
  type: z.literal("desktop_screenshot"),
  config: z.object({
    output_name: z.string().nullable().optional(),
    sensitive: z.boolean().nullable().optional(),
    timeout_ms: z.number().nullable().optional(),
  }),
});

export const desktopFocusWindowSchema = z.object({
  type: z.literal("desktop_focus_window"),
  config: z.object({ timeout_ms: z.number().nullable().optional() }),
});

export const desktopInvokeMenuSchema = z.object({
  type: z.literal("desktop_invoke_menu"),
  config: z.object({ ...stepConfig, path: z.array(z.string()) }),
});
