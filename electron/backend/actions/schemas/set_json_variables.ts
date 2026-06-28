import { z } from "zod";

export const setJsonVariablesSchema = z.object({
  type: z.literal("set_json_variables"),
  config: z.object({
    json: z.string(),
  }),
});
