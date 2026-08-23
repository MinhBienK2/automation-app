import { z } from "zod";

export const cryptoOperationSchema = z.object({
  type: z.literal("crypto_operation"),
  config: z.object({
    operation: z.enum(["md5", "sha256", "base64_encode", "base64_decode"]),
    value: z.string(),
    output_name: z.string(),
  }),
});
