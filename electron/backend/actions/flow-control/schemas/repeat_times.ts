import { z } from "zod";
import { nestedActionSchema } from "../../schemas/common.js";

export const repeatTimesSchema = z.object({
  type: z.literal("repeat_times"),
  config: z.object({
    times: z.number(),
    steps: z.array(nestedActionSchema),
  }),
});
