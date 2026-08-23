import { z } from "zod";

export const domainAllowlistSchema = z.object({
  type: z.literal("domain_allowlist"),
  config: z.object({
    domains: z.array(z.string()),
  }),
});
