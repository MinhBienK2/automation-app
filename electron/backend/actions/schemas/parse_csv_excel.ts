import { z } from "zod";

export const parseCsvExcelSchema = z.object({
  type: z.literal("parse_csv_excel"),
  config: z.object({
    path: z.string(),
    output_name: z.string(),
    has_headers: z.boolean(),
    delimiter: z.string().nullable().optional(),
  }),
});
