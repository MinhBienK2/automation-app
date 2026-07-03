import { z } from "zod";

export const writeCsvExcelSchema = z.object({
  type: z.literal("write_csv_excel"),
  config: z.object({
    path: z.string(),
    source_name: z.string(),
    mode: z.enum(["overwrite", "append"]),
    has_headers: z.boolean(),
  }),
});
