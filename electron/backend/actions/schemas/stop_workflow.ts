import { z } from "zod";

export const stopWorkflowSchema = z.object({
  type: z.literal("stop_workflow"),
  config: z.object({
    status: z.enum(["success", "failure"]),
    reason: z.string().nullable().optional(),
    close_browser: z.boolean().nullable().optional(),
  }),
});
