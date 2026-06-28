import { z } from "zod";

/**
 * Schema for call_subflow graph node config (not an ActionConfig variant).
 * Used to validate call_subflow node configs during graph load.
 */
export const callSubflowSchema = z.object({
  subflow_id: z.string(),
  input_mapping: z.array(
    z.object({
      input_name: z.string(),
      value: z.string(),
    }),
  ),
  output_prefix: z.string().nullable().optional(),
});
