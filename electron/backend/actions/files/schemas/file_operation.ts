import { z } from "zod";

export const fileOperationSchema = z.object({
  type: z.literal("file_operation"),
  config: z.object({
    operation: z.enum(["exists", "delete", "rename", "move"]),
    path: z.string(),
    target_path: z.string().nullable().optional(),
    output_name: z.string().nullable().optional(),
  }),
});
