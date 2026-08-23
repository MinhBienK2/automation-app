import { z } from "zod";
import { workflowConditionSchema } from "../../schemas/common.js";

const nestedActionSchema = z.object({
  type: z.string(),
  config: z.record(z.unknown()),
}).passthrough();

export const ifConditionSchema = z.object({
  type: z.literal("if_condition"),
  config: z.object({
    condition: workflowConditionSchema,
    then_steps: z.array(nestedActionSchema),
    else_steps: z.array(nestedActionSchema),
  }),
});
