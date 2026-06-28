import { z } from "zod";
import { nestedActionSchema } from "./common.js";

export const randomChoiceSchema = z.object({
  type: z.literal("random_choice"),
  config: z.object({
    output_name: z.string().nullable().optional(),
    choices: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        weight: z.number(),
        steps: z.array(nestedActionSchema),
      }),
    ),
  }),
});
