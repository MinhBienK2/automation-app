import { z } from "zod";
import { nestedActionSchema } from "./common.js";

export const repeatForEachSchema = z.object({
  type: z.literal("repeat_for_each"),
  config: z.object({
    item_name: z.string(),
    array_variable: z.string().nullable().optional(),
    items: z.array(z.string()),
    steps: z.array(nestedActionSchema),
  }),
});
