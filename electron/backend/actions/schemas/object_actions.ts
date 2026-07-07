import { z } from "zod";
import { variableValueTypeSchema } from "./common.js";

export const objectFieldAssignmentSchema = z.object({
  key: z.string(),
  value_type: variableValueTypeSchema,
  value: z.string(),
});

export const createEmptyObjectSchema = z.object({
  type: z.literal("create_empty_object"),
  config: z.object({
    output_name: z.string(),
  }),
});

export const createObjectManualSchema = z.object({
  type: z.literal("create_object_manual"),
  config: z.object({
    output_name: z.string(),
    fields: z.array(objectFieldAssignmentSchema),
  }),
});

export const parseJsonToObjectSchema = z.object({
  type: z.literal("parse_json_to_object"),
  config: z.object({
    source_text: z.string(),
    output_name: z.string(),
  }),
});

export const setObjectPropertySchema = z.object({
  type: z.literal("set_object_property"),
  config: z.object({
    name: z.string(),
    property_key: z.string(),
    value_type: variableValueTypeSchema,
    value: z.string(),
  }),
});

export const removeObjectPropertySchema = z.object({
  type: z.literal("remove_object_property"),
  config: z.object({
    name: z.string(),
    property_key: z.string(),
  }),
});

export const mergeObjectsSchema = z.object({
  type: z.literal("merge_objects"),
  config: z.object({
    name: z.string(),
    value: z.string(),
    deep: z.boolean(),
  }),
});

export const renameObjectPropertySchema = z.object({
  type: z.literal("rename_object_property"),
  config: z.object({
    name: z.string(),
    old_key: z.string(),
    new_key: z.string(),
  }),
});

export const getObjectPropertySchema = z.object({
  type: z.literal("get_object_property"),
  config: z.object({
    source: z.string(),
    property_key: z.string(),
    output_name: z.string(),
  }),
});

export const getObjectKeysSchema = z.object({
  type: z.literal("get_object_keys"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const getObjectValuesSchema = z.object({
  type: z.literal("get_object_values"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const stringifyObjectSchema = z.object({
  type: z.literal("stringify_object"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});

export const executeObjectScriptSchema = z.object({
  type: z.literal("execute_object_script"),
  config: z.object({
    source: z.string(),
    script: z.string(),
    output_name: z.string(),
  }),
});

export const checkObjectKeyExistsSchema = z.object({
  type: z.literal("check_object_key_exists"),
  config: z.object({
    source: z.string(),
    property_key: z.string(),
    output_name: z.string(),
  }),
});

export const checkObjectEmptySchema = z.object({
  type: z.literal("check_object_empty"),
  config: z.object({
    source: z.string(),
    output_name: z.string(),
  }),
});
