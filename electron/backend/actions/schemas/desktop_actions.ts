import { z } from "zod";

const numericOrStringSchema = z.union([z.number(), z.string()]).optional().nullable();

export const desktopLaunchAppSchema = z.object({
  type: z.literal("desktop_launch_app"),
  config: z.object({
    app_executable_path: z.string(),
    app_arguments: z.array(z.string()).optional().nullable(),
  }),
});

export const desktopClickSchema = z.object({
  type: z.literal("desktop_click"),
  config: z.object({
    pid: numericOrStringSchema,
    x: numericOrStringSchema,
    y: numericOrStringSchema,
    element_index: numericOrStringSchema,
    button: z.enum(["left", "right", "middle"]).optional().nullable(),
  }),
});

export const desktopTypeTextSchema = z.object({
  type: z.literal("desktop_type_text"),
  config: z.object({
    pid: numericOrStringSchema,
    text: z.string(),
    x: numericOrStringSchema,
    y: numericOrStringSchema,
    element_index: numericOrStringSchema,
  }),
});

export const desktopPressKeySchema = z.object({
  type: z.literal("desktop_press_key"),
  config: z.object({
    pid: numericOrStringSchema,
    key: z.string(),
    window_id: numericOrStringSchema,
  }),
});

export const desktopHotkeySchema = z.object({
  type: z.literal("desktop_hotkey"),
  config: z.object({
    keys: z.array(z.string()),
  }),
});

export const desktopScrollSchema = z.object({
  type: z.literal("desktop_scroll"),
  config: z.object({
    pid: numericOrStringSchema,
    direction: z.enum(["up", "down", "left", "right"]).optional().nullable(),
    amount: numericOrStringSchema,
  }),
});

export const desktopScreenshotSchema = z.object({
  type: z.literal("desktop_screenshot"),
  config: z.object({}).optional().nullable(),
});

export const desktopWaitSchema = z.object({
  type: z.literal("desktop_wait"),
  config: z.object({
    duration_ms: numericOrStringSchema,
    timeout_ms: numericOrStringSchema,
  }),
});

export const desktopHoverSchema = z.object({
  type: z.literal("desktop_hover"),
  config: z.object({
    pid: numericOrStringSchema,
    x: numericOrStringSchema,
    y: numericOrStringSchema,
    element_index: numericOrStringSchema,
  }),
});

export const desktopRightClickSchema = z.object({
  type: z.literal("desktop_right_click"),
  config: z.object({
    pid: numericOrStringSchema,
    x: numericOrStringSchema,
    y: numericOrStringSchema,
    element_index: numericOrStringSchema,
  }),
});

export const desktopDoubleClickSchema = z.object({
  type: z.literal("desktop_double_click"),
  config: z.object({
    pid: numericOrStringSchema,
    x: numericOrStringSchema,
    y: numericOrStringSchema,
    element_index: numericOrStringSchema,
  }),
});
