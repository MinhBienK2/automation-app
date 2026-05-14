import type {
  ElementTarget,
  GraphEdge,
  WorkflowGraph,
  WorkflowCondition,
  WorkflowGraphMigrationNote,
} from "../../src/types/workflow.js";

export const CURRENT_WORKFLOW_GRAPH_VERSION = 2;

const nestedActionArrayFields = [
  "then_steps",
  "else_steps",
  "steps",
  "failed_steps",
  "default_steps",
  "try_steps",
  "success_steps",
  "error_steps",
  "finally_steps",
  "primary_steps",
  "fallback_steps",
  "timeout_steps",
] as const;

const primaryTargetActions = new Set([
  "wait",
  "input_text",
  "clear_input",
  "click",
  "scroll",
  "select_option",
  "set_checkbox",
  "hover",
  "double_click",
  "right_click",
  "focus_element",
  "blur_element",
  "type_sequence",
  "paste_clipboard",
  "check",
  "uncheck",
  "toggle_checkbox",
  "select_radio",
  "upload_file",
  "submit_form",
  "set_contenteditable",
  "extract_text",
  "extract_attribute",
  "extract_input_value",
  "extract_table",
  "extract_list",
  "assert_element",
  "assert_text",
  "switch_frame",
]);

const droppedActionFields: Record<string, string[]> = {
  navigate: ["wait_until", "timeout_ms"],
  wait: ["timeout_ms"],
  input_text: ["typing_mode", "delay_ms", "wait_until", "timeout_ms"],
  clear_input: ["method", "wait_until", "timeout_ms"],
  click: [
    "mode",
    "button",
    "click_count",
    "scroll_into_view",
    "block",
    "inline",
    "position",
    "offset_x",
    "offset_y",
    "wait_until",
    "timeout_ms",
    "retry_interval_ms",
    "post_click_wait_ms",
  ],
  scroll: ["block", "inline", "max_attempts", "wait_ms"],
  select_option: ["wait_until", "timeout_ms"],
  set_checkbox: ["wait_until", "timeout_ms"],
  hover: ["wait_until", "timeout_ms"],
  double_click: ["wait_until", "timeout_ms"],
  right_click: ["wait_until", "timeout_ms"],
  drag_and_drop: ["wait_until", "timeout_ms"],
  focus_element: ["wait_until", "timeout_ms"],
  blur_element: ["wait_until", "timeout_ms"],
  type_sequence: ["delay_ms", "wait_until", "timeout_ms"],
  paste_clipboard: ["wait_until", "timeout_ms"],
  check: ["wait_until", "timeout_ms"],
  uncheck: ["wait_until", "timeout_ms"],
  toggle_checkbox: ["wait_until", "timeout_ms"],
  select_radio: ["wait_until", "timeout_ms"],
  upload_file: ["wait_until", "timeout_ms"],
  submit_form: ["wait_until", "timeout_ms"],
  select_custom_option: ["timeout_ms"],
  set_contenteditable: ["wait_until", "timeout_ms"],
  extract_text: ["timeout_ms"],
  extract_attribute: ["timeout_ms"],
  extract_input_value: ["timeout_ms"],
  extract_table: ["timeout_ms"],
  extract_list: ["timeout_ms"],
  wait_for_download: ["timeout_ms"],
  assert_element: ["timeout_ms"],
  assert_text: ["timeout_ms"],
  execute_js: ["timeout_ms"],
  wait_for_request: ["timeout_ms"],
  wait_for_response: ["timeout_ms"],
};

export function migrateWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  if (graph.version === CURRENT_WORKFLOW_GRAPH_VERSION) {
    return {
      ...graph,
      migration_notes: graph.migration_notes ?? [],
    };
  }

  if (graph.version > CURRENT_WORKFLOW_GRAPH_VERSION) {
    return graph;
  }

  const notes = [...(graph.migration_notes ?? [])];
  const migrated: WorkflowGraph = {
    ...structuredClone(graph),
    version: CURRENT_WORKFLOW_GRAPH_VERSION,
    nodes: graph.nodes.map((node) => {
      const config = migrateNodeConfig(node.config, `nodes.${node.id}.config`, notes);
      return { ...node, config };
    }),
    edges: graph.edges.map((edge) => migrateEdge(edge, notes)),
    migration_notes: notes,
  };

  if (graph.version !== CURRENT_WORKFLOW_GRAPH_VERSION) {
    converted(notes, "version", "Upgraded workflow graph contract to version 2.");
  }
  return migrated;
}

function migrateEdge(
  edge: GraphEdge,
  notes: WorkflowGraphMigrationNote[],
): GraphEdge {
  return {
    ...edge,
    condition: edge.condition
      ? (migrateWorkflowCondition(
          edge.condition,
          `edges.${edge.id}.condition`,
          notes,
        ) as WorkflowCondition)
      : edge.condition,
  };
}

export function elementTargetFromXpath(xpath: string, iframeXpath?: string | null): ElementTarget {
  const target: ElementTarget = {
    locators: [{ kind: "xpath", value: xpath.trim() }],
  };
  if (iframeXpath?.trim()) {
    target.iframe = {
      locators: [{ kind: "xpath", value: iframeXpath.trim() }],
    };
  }
  return target;
}

function migrateNodeConfig(
  config: unknown,
  path: string,
  notes: WorkflowGraphMigrationNote[],
): unknown {
  if (isActionConfigRecord(config)) {
    return migrateActionConfig(config, path, notes);
  }
  const record = objectRecord(config);
  if (!record) return config;
  let next: Record<string, unknown> = { ...record };
  if (next.condition) {
    next = {
      ...next,
      condition: migrateWorkflowCondition(next.condition, `${path}.condition`, notes),
    };
  }
  return next;
}

function migrateActionConfig(
  action: Record<string, unknown>,
  path: string,
  notes: WorkflowGraphMigrationNote[],
): Record<string, unknown> {
  const type = typeof action.type === "string" ? action.type : "";
  const config = objectRecord(action.config);
  if (!type || !config) return action;

  let next: Record<string, unknown> = { ...config };

  if (primaryTargetActions.has(type)) {
    next = migrateTargetField(next, "xpath", "target", path, notes);
  }

  if (type === "drag_and_drop") {
    next = migrateTargetField(next, "source_xpath", "source_target", path, notes);
    next = migrateTargetField(next, "target_xpath", "target_target", path, notes);
  }

  if (type === "select_custom_option") {
    next = migrateTargetField(next, "trigger_xpath", "trigger_target", path, notes);
  }

  if ("iframe_xpath" in next) {
    dropped(notes, `${path}.iframe_xpath`, "Removed legacy iframe XPath after target migration.");
    delete next.iframe_xpath;
  }

  for (const field of droppedActionFields[type] ?? []) {
    if (field in next) {
      dropped(notes, `${path}.${field}`, "Dropped obsolete engine-level action field.");
      delete next[field];
    }
  }

  for (const field of nestedActionArrayFields) {
    const value = next[field];
    if (!Array.isArray(value)) continue;
    next[field] = value.map((nested, index) =>
      isActionConfigRecord(nested)
        ? migrateActionConfig(nested, `${path}.${field}.${index}`, notes)
        : nested,
    );
  }

  if (next.condition) {
    next.condition = migrateWorkflowCondition(next.condition, `${path}.condition`, notes);
  }

  return {
    ...action,
    config: next,
  };
}

function migrateTargetField(
  config: Record<string, unknown>,
  legacyField: string,
  targetField: string,
  path: string,
  notes: WorkflowGraphMigrationNote[],
) {
  if (!(legacyField in config)) {
    return attachIframeToExistingTarget(config, targetField);
  }

  const next = attachIframeToExistingTarget({ ...config }, targetField);
  const xpath = text(next[legacyField]);
  const iframeXpath = text(next.iframe_xpath);
  const existingTarget = elementTarget(next[targetField]);

  if (!existingTarget && xpath) {
    next[targetField] = elementTargetFromXpath(xpath, iframeXpath);
    converted(notes, `${path}.${legacyField}`, `Converted legacy ${legacyField} into ${targetField}.`);
  } else if (existingTarget && iframeXpath && !existingTarget.iframe) {
    next[targetField] = withIframe(existingTarget, iframeXpath);
    converted(notes, `${path}.iframe_xpath`, `Converted legacy iframe XPath into ${targetField}.iframe.`);
  } else {
    dropped(notes, `${path}.${legacyField}`, `Removed empty or superseded legacy ${legacyField}.`);
  }

  delete next[legacyField];
  return next;
}

function attachIframeToExistingTarget(config: Record<string, unknown>, targetField: string) {
  const iframeXpath = text(config.iframe_xpath);
  const existingTarget = elementTarget(config[targetField]);
  if (!iframeXpath || !existingTarget || existingTarget.iframe) return config;
  return {
    ...config,
    [targetField]: withIframe(existingTarget, iframeXpath),
  };
}

function migrateWorkflowCondition(
  condition: unknown,
  path: string,
  notes: WorkflowGraphMigrationNote[],
): unknown {
  const record = objectRecord(condition);
  if (!record || record.kind !== "element_visible") return condition;
  if (!("xpath" in record)) return condition;

  const next = { ...record };
  const xpath = text(next.xpath);
  if (!elementTarget(next.target) && xpath) {
    next.target = elementTargetFromXpath(xpath);
    converted(notes, `${path}.xpath`, "Converted legacy condition XPath into target.");
  } else {
    dropped(notes, `${path}.xpath`, "Removed empty or superseded legacy condition XPath.");
  }
  delete next.xpath;
  return next;
}

function withIframe(target: ElementTarget, iframeXpath: string): ElementTarget {
  return {
    ...target,
    iframe: elementTargetFromXpath(iframeXpath),
  };
}

function isActionConfigRecord(value: unknown): value is Record<string, unknown> {
  const record = objectRecord(value);
  return Boolean(record && typeof record.type === "string" && objectRecord(record.config));
}

function elementTarget(value: unknown): ElementTarget | null {
  const record = objectRecord(value);
  if (!record || !Array.isArray(record.locators)) return null;
  return record as ElementTarget;
}

function objectRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function converted(notes: WorkflowGraphMigrationNote[], path: string, message: string) {
  notes.push({ path, action: "converted", message });
}

function dropped(notes: WorkflowGraphMigrationNote[], path: string, message: string) {
  notes.push({ path, action: "dropped", message });
}
