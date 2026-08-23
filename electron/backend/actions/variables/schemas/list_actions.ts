import { z } from "zod";
import { variableValueTypeSchema } from "../../schemas/common.js";

export const createEmptyListSchema = z.object({
  type: z.literal("create_empty_list"),
  config: z.object({
    output_name: z.string(),
  }),
});

export const createListManualSchema = z.object({
  type: z.literal("create_list_manual"),
  config: z.object({
    output_name: z.string(),
    value_type: variableValueTypeSchema,
    items: z.array(z.string()),
  }),
});

export const splitTextToListSchema = z.object({
  type: z.literal("split_text_to_list"),
  config: z.object({
    output_name: z.string(),
    source_text: z.string(),
    delimiter: z.string(),
  }),
});

export const generateNumberRangeSchema = z.object({
  type: z.literal("generate_number_range"),
  config: z.object({
    output_name: z.string(),
    start: z.union([z.number(), z.string()]),
    end: z.union([z.number(), z.string()]),
    step: z.union([z.number(), z.string()]).nullable().optional(),
  }),
});

export const addToListSchema = z.object({
  type: z.literal("add_to_list"),
  config: z.object({
    name: z.string(),
    position: z.enum(["end", "start", "unique_end"]),
    value_type: variableValueTypeSchema,
    value: z.string(),
  }),
});

export const removeFromListByIndexSchema = z.object({
  type: z.literal("remove_from_list_by_index"),
  config: z.object({
    name: z.string(),
    index: z.union([z.number(), z.string()]),
  }),
});

export const removeFromListByValueSchema = z.object({
  type: z.literal("remove_from_list_by_value"),
  config: z.object({
    name: z.string(),
    value_type: variableValueTypeSchema,
    value: z.string(),
  }),
});

export const mergeListsSchema = z.object({
  type: z.literal("merge_lists"),
  config: z.object({
    name: z.string(),
    value: z.string(),
    unique: z.boolean(),
  }),
});

export const getListItemSchema = z.object({
  type: z.literal("get_list_item"),
  config: z.object({
    source: z.string(),
    position: z.enum(["first", "last", "index"]),
    index: z.union([z.number(), z.string()]).nullable().optional(),
    output_name: z.string(),
  }),
});

export const getListLengthSchema = z.object({
  type: z.literal("get_list_length"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const sliceListSchema = z.object({
  type: z.literal("slice_list"),
  config: z.object({
    source: z.string(),
    start: z.union([z.number(), z.string()]),
    end: z.union([z.number(), z.string()]).nullable().optional(),
    output_name: z.string(),
  }),
});

export const joinListSchema = z.object({
  type: z.literal("join_list"),
  config: z.object({
    source: z.string(),
    separator: z.string(),
    output_name: z.string(),
  }),
});

export const filterListSchema = z.object({
  type: z.literal("filter_list"),
  config: z.object({
    source: z.string(),
    rules_group: z.unknown().nullable().optional(),
    output_name: z.string(),
  }),
});

export const mapListPropertySchema = z.object({
  type: z.literal("map_list_property"),
  config: z.object({
    source: z.string(),
    property_key: z.string(),
    output_name: z.string(),
  }),
});

export const sortReverseListSchema = z.object({
  type: z.literal("sort_reverse_list"),
  config: z.object({
    source: z.string(),
    action: z.enum(["sort_asc", "sort_desc", "reverse"]),
    sort_key: z.string().nullable().optional(),
    output_name: z.string(),
  }),
});

export const executeListScriptSchema = z.object({
  type: z.literal("execute_list_script"),
  config: z.object({
    source: z.string(),
    script: z.string(),
    output_name: z.string(),
  }),
});

export const checkListEmptySchema = z.object({
  type: z.literal("check_list_empty"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const checkListContainsSchema = z.object({
  type: z.literal("check_list_contains"),
  config: z.object({
    source: z.string(),
    value_type: variableValueTypeSchema,
    value: z.string(),
    output_name: z.string(),
  }),
});

export const checkListAnyMatchSchema = z.object({
  type: z.literal("check_list_any_match"),
  config: z.object({
    source: z.string(),
    rules_group: z.unknown().nullable().optional(),
    output_name: z.string(),
  }),
});

export const checkListAllMatchSchema = z.object({
  type: z.literal("check_list_all_match"),
  config: z.object({
    source: z.string(),
    rules_group: z.unknown().nullable().optional(),
    output_name: z.string(),
  }),
});
