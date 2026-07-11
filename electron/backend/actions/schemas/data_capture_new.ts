import { z } from "zod";
import { dataCaptureElementConfigSchema } from "./common.js";

// Reusable standard element capture schema
function makeStandardElementCaptureSchema(literalType: string) {
  return z.object({
    type: z.literal(literalType),
    config: dataCaptureElementConfigSchema,
  });
}

export const extractTextContentSchema = makeStandardElementCaptureSchema("extract_text_content");
export const extractInnerHtmlSchema = makeStandardElementCaptureSchema("extract_inner_html");
export const extractOuterHtmlSchema = makeStandardElementCaptureSchema("extract_outer_html");
export const extractAllAttributesSchema = makeStandardElementCaptureSchema("extract_all_attributes");
export const extractDataAttributesSchema = makeStandardElementCaptureSchema("extract_data_attributes");
export const extractClassListSchema = makeStandardElementCaptureSchema("extract_class_list");
export const extractDescendantAttributesSchema = makeStandardElementCaptureSchema("extract_descendant_attributes");
export const extractSelectValueSchema = makeStandardElementCaptureSchema("extract_select_value");
export const extractSelectOptionsSchema = makeStandardElementCaptureSchema("extract_select_options");
export const extractCheckboxStateSchema = makeStandardElementCaptureSchema("extract_checkbox_state");
export const extractFormDataSchema = makeStandardElementCaptureSchema("extract_form_data");
export const extractTableHeadersSchema = makeStandardElementCaptureSchema("extract_table_headers");
export const extractDimensionsSchema = makeStandardElementCaptureSchema("extract_dimensions");
export const extractVisibilitySchema = makeStandardElementCaptureSchema("extract_visibility");
export const extractElementStateSchema = makeStandardElementCaptureSchema("extract_element_state");
export const checkElementExistsSchema = makeStandardElementCaptureSchema("check_element_exists");

// Schemas with element target + specific properties
export const extractComputedStyleSchema = z.object({
  type: z.literal("extract_computed_style"),
  config: dataCaptureElementConfigSchema.extend({
    property: z.string(),
  }),
});

export const extractTableRowSchema = z.object({
  type: z.literal("extract_table_row"),
  config: dataCaptureElementConfigSchema.extend({
    row_index: z.number(),
  }),
});

export const extractTableColumnSchema = z.object({
  type: z.literal("extract_table_column"),
  config: dataCaptureElementConfigSchema.extend({
    column: z.string(),
  }),
});

export const extractTableCellSchema = z.object({
  type: z.literal("extract_table_cell"),
  config: dataCaptureElementConfigSchema.extend({
    row: z.number(),
    column: z.number(),
  }),
});

export const extractListAttributesSchema = z.object({
  type: z.literal("extract_list_attributes"),
  config: dataCaptureElementConfigSchema.extend({
    attribute: z.string(),
  }),
});

export const extractStructuredListSchema = z.object({
  type: z.literal("extract_structured_list"),
  config: dataCaptureElementConfigSchema.extend({
    mappings: z.array(
      z.object({
        name: z.string(),
        selector: z.string(),
        capture_type: z.string(),
        attribute: z.string().optional().nullable(),
      })
    ),
  }),
});

// Page-level capture schemas (no locator required)
export const getPageTitleSchema = z.object({
  type: z.literal("get_page_title"),
  config: z.object({
    output_name: z.string(),
    timeout_ms: z.number().nullable().optional(),
  }),
});

export const extractPageLinksSchema = z.object({
  type: z.literal("extract_page_links"),
  config: z.object({
    output_name: z.string(),
    timeout_ms: z.number().nullable().optional(),
  }),
});

export const getMetaContentSchema = z.object({
  type: z.literal("get_meta_content"),
  config: z.object({
    meta_name: z.string(),
    output_name: z.string(),
    timeout_ms: z.number().nullable().optional(),
  }),
});

// Text-processing / Pattern matching schemas
function makePatternExtractSchema(literalType: string) {
  return z.object({
    type: z.literal(literalType),
    config: z.object({
      source_name: z.string(),
      output_name: z.string(),
    }),
  });
}

export const extractNumbersSchema = makePatternExtractSchema("extract_numbers");
export const extractUrlsSchema = makePatternExtractSchema("extract_urls");
export const extractEmailsSchema = makePatternExtractSchema("extract_emails");
