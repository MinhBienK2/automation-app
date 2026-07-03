import { z } from "zod";

export const switchToParentFrameSchema = z.object({
  type: z.literal("switch_to_parent_frame"),
  config: z.record(z.unknown()),
});
