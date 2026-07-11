import fs from "node:fs/promises";
import path from "node:path";
import type {
  ActionConfig,
  CompiledNestedAction,
  CompiledStepMetadata,
  RunState,
  WorkflowSettings,
} from "../../../src/types/workflow.js";
import type {
  BrowserDriverContext,
  BrowserDriverLocator,
  BrowserDriverPage,
} from "../browser/sessionManager.js";
import {
  createActionExecutorMap,
  type ActionExecutorMap,
} from "../actions/execution.js";
import type { AppPaths } from "../db/database.js";
import { resolveEvidenceArtifact } from "../features/evidence/artifacts.js";
import { isPlainRecord } from "../shared/records.js";
import type { ActionTrace } from "./actionTrace.js";
import {
  currentPageHostname,
  hostnameAllowed,
} from "./domainPolicy.js";
import {
  blurElementTarget,
  rightClickTarget,
  selectRadioTarget,
  submitFormTarget,
} from "./interactionActions.js";
import {
  evaluateMathInObject,
  parseVariableValue,
  renderTemplate,
  setVariables,
  writeVariableValue,
} from "./variables.js";
import {
  assertElementState,
  assertRuntimeEnumValue,
  executableJavaScript,
  extractTable,
  requireLocatorMethod,
  setWebStorage,
  waitUntil,
  weightedRandomChoice,
  withActionTimeout,
} from "./runtimeHelpers.js";
import { locatorFor, locatorForRuntimeElementRef, type RuntimeElementRef } from "./targetResolver.js";
import { getPath, setPath, deletePath, hasPath } from "./objectHelpers.js";

export type RunnerActionRuntime = {
  runId: string;
  settings: WorkflowSettings;
  context: BrowserDriverContext;
  page: BrowserDriverPage;
  domainPolicy: { allowed_domains: string[] } | null;
  outputs: Record<string, unknown>;
  elementRefs: Map<string, RuntimeElementRef>;
  traces: ActionTrace[];
  evidence: Array<{
    run_id: string;
    node_id: string | null;
    step_number: number | null;
    action_type: string;
    artifact_kind: "screenshot" | "download";
    path: string;
    created_at: string;
  }>;
  clipboard: string;
  currentStepNumber: number | null;
  currentStepId: string | null;
  currentStepName: string | null;
  currentActionType: string | null;
  currentActionSummary: string | null;
  currentStepMetadata: CompiledStepMetadata | null;
  liveState: RunState;
  onProgress?: (state: Partial<RunState>) => void;
  activeFrameXpath?: string | null;
  signal?: AbortSignal;
};

export type RunnerActionExecutorDependencies = {
  appPaths: AppPaths;
  random: () => number;
  sleep: (ms: number, signal?: AbortSignal) => Promise<void>;
  enforceNavigationPolicy: (runtime: RunnerActionRuntime, url: string) => Promise<void>;
  executeWait: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "wait" }>,
  ) => Promise<void>;
  locatorForAction: (
    runtime: RunnerActionRuntime,
    config: {
      target?: ActionTargetConfig["target"];
      target_ref?: string | null;
      xpath?: string | null;
      iframe_xpath?: string | null;
      wait_until?: "attached" | "visible" | "enabled" | "clickable" | null;
      timeout_ms?: number | null;
    },
    fallbackXpath?: string,
  ) => Promise<BrowserDriverLocator>;
  executeFindElement: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "find_element" }>,
  ) => Promise<void>;
  executeDragAndDrop: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "drag_and_drop" }>,
  ) => Promise<void>;
  executeScroll: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "scroll" }>,
  ) => Promise<void>;
  pressKeyHuman: (
    page: BrowserDriverPage,
    key: string,
    signal?: AbortSignal,
  ) => Promise<void>;
  pressHotkeyHuman: (
    page: BrowserDriverPage,
    keys: string[],
    signal?: AbortSignal,
  ) => Promise<void>;
  executePasteClipboard: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "paste_clipboard" }>,
  ) => Promise<void>;
  locatorForCustomSelectTrigger: (
    runtime: RunnerActionRuntime,
    action: Extract<ActionConfig, { type: "select_custom_option" }>,
  ) => Promise<BrowserDriverLocator>;
  registerDialogHandler: (
    runtime: RunnerActionRuntime,
    behavior: "accept" | "dismiss",
    promptText?: string,
  ) => void;
  waitForDownload: (
    runtime: RunnerActionRuntime,
    outputName: string,
    timeoutMs: number | null | undefined,
  ) => Promise<string>;
  executeActions: (
    runtime: RunnerActionRuntime,
    actions: CompiledNestedAction[],
  ) => Promise<void>;
  executeLoopBody: (
    runtime: RunnerActionRuntime,
    steps: CompiledNestedAction[],
  ) => Promise<"completed" | "break" | "continue">;
  executeRetry: (
    runtime: RunnerActionRuntime,
    attempts: number,
    delayMs: number,
    steps: CompiledNestedAction[],
    failedSteps: CompiledNestedAction[],
  ) => Promise<void>;
  executeLoop: (
    runtime: RunnerActionRuntime,
    steps: CompiledNestedAction[],
    maxAttempts: number,
    predicate: () => Promise<boolean>,
    timeoutMs?: number | null,
  ) => Promise<"predicate_false" | "max_attempts" | "timeout" | "break">;
  conditionMatches: (runtime: RunnerActionRuntime, condition: unknown) => Promise<boolean>;
  recordEvidence: (
    runtime: RunnerActionRuntime,
    artifact: {
      actionType: string;
      artifactKind: "screenshot" | "download";
      relativePath: string;
    },
  ) => void;
  createLoopControl: (kind: "break" | "continue") => Error;
  createRunnerStop: (
    status: "success" | "failure" | "stopped",
    message: string,
    closeBrowser?: boolean,
  ) => Error;
};

type ActionTargetConfig = {
  target?: Extract<ActionConfig, { type: "click" }>["config"]["target"];
};

function getMockValueForVariable(name: string): string {
  const lower = name.toLowerCase();
  if (lower.includes("video")) {
    return "https://www.tiktok.com/@tiktok/video/7350000000000000000";
  }
  if (lower.includes("url") || lower.includes("link")) {
    return "https://www.tiktok.com/@tiktok";
  }
  if (
    lower.includes("user") ||
    lower.includes("name") ||
    lower.includes("account") ||
    lower.includes("channel") ||
    lower.includes("profile")
  ) {
    return "tiktok";
  }
  if (lower.includes("id")) {
    return "1234567890";
  }
  if (lower.includes("num") || lower.includes("count") || lower.includes("index")) {
    return "1";
  }
  return `mock_${name}`;
}

export function createRunnerActionExecutors(
  runtime: RunnerActionRuntime,
  deps: RunnerActionExecutorDependencies,
): ActionExecutorMap {
  const cleanFlattenedKeys = (outputs: Record<string, unknown>, varName: string) => {
    const prefix = varName + ".";
    for (const key of Object.keys(outputs)) {
      if (key.startsWith(prefix)) {
        delete outputs[key];
      }
    }
  };

  const deepMerge = (target: Record<string, any>, source: Record<string, any>): Record<string, any> => {
    const result = { ...target };
    for (const [key, val] of Object.entries(source)) {
      if (isPlainRecord(val) && isPlainRecord(result[key])) {
        result[key] = deepMerge(result[key], val);
      } else {
        result[key] = val;
      }
    }
    return result;
  };

  return createActionExecutorMap({
    navigate: async (action) => {
      const url = renderTemplate(action.config.url, runtime.outputs);
      await deps.enforceNavigationPolicy(runtime, url);
      await runtime.page.goto(url, {
        waitUntil: waitUntil(action.config.wait_until),
        timeout: action.config.timeout_ms ?? undefined,
      });
    },
    wait: async (action) => {
      await deps.executeWait(runtime, action);
    },
    random_wait: async (action) => {
      const waitMs =
        action.config.min_ms +
        Math.floor(deps.random() * (action.config.max_ms - action.config.min_ms + 1));
      await deps.sleep(waitMs, runtime.signal);
    },
    input_text: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      if (action.config.clear_before_input) await locator.fill("");
      await locator.fill(renderTemplate(action.config.text, runtime.outputs));
    },
    clear_input: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill("");
    },
    click: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    find_element: async (action) => {
      await deps.executeFindElement(runtime, action);
    },
    hover: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "hover",
        action.type,
      )();
    },
    double_click: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "dblclick",
        action.type,
      )();
    },
    right_click: async (action) => {
      await rightClickTarget(
        runtime.page,
        await deps.locatorForAction(runtime, action.config),
        deps.sleep,
        deps.random,
        action.config.timeout_ms,
        runtime.signal,
      );
    },
    drag_and_drop: async (action) => {
      await deps.executeDragAndDrop(runtime, action);
    },
    scroll: async (action) => {
      await deps.executeScroll(runtime, action);
    },
    select_option: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_by,
        ["label", "value"],
        "Match by must be label or value",
      );
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "selectOption",
        action.type,
      )(
        action.config.match_by === "label"
          ? { label: action.config.value }
          : { value: action.config.value },
      );
    },
    check: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "check",
        action.type,
      )();
    },
    select_radio: async (action) => {
      await selectRadioTarget(await deps.locatorForAction(runtime, action.config));
    },
    uncheck: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "uncheck",
        action.type,
      )();
    },
    toggle_checkbox: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    press_key: async (action) => {
      await deps.pressKeyHuman(runtime.page, action.config.key, runtime.signal);
    },
    hotkey: async (action) => {
      await deps.pressHotkeyHuman(runtime.page, action.config.keys, runtime.signal);
    },
    type_sequence: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "type",
        action.type,
      )(
        renderTemplate(action.config.text, runtime.outputs),
        { delay: action.config.delay_ms ?? 0 },
      );
    },
    set_clipboard: async (action) => {
      runtime.clipboard = action.config.text;
    },
    paste_clipboard: async (action) => {
      await deps.executePasteClipboard(runtime, action);
    },
    focus_element: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).click();
    },
    blur_element: async (action) => {
      await blurElementTarget(await deps.locatorForAction(runtime, action.config));
    },
    upload_file: async (action) => {
      await requireLocatorMethod(
        await deps.locatorForAction(runtime, action.config),
        "setInputFiles",
        action.type,
      )(
        action.config.files,
      );
    },
    submit_form: async (action) => {
      if (action.config.xpath || action.config.target || action.config.target_ref?.trim()) {
        await submitFormTarget(await deps.locatorForAction(runtime, action.config, "form"));
      } else {
        await deps.pressKeyHuman(runtime.page, "Enter", runtime.signal);
      }
    },
    select_custom_option: async (action) => {
      await (await deps.locatorForCustomSelectTrigger(runtime, action)).click();
      await runtime.page.locator(`text=${action.config.option_text}`).click();
    },
    set_contenteditable: async (action) => {
      await (await deps.locatorForAction(runtime, action.config)).fill(
        renderTemplate(action.config.text, runtime.outputs),
      );
    },
    extract_text: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      const separator = action.config.separator;
      if (separator) {
        runtime.outputs[action.config.output_name] =
          ((await requireLocatorMethod(
            locator,
            "evaluate",
            action.type,
          )((element: any, sep: any) => {
            return Array.from(element.childNodes)
              .map((node: any) => node.textContent?.trim() || "")
              .filter(Boolean)
              .join(sep);
          }, separator)) as string) ?? "";
      } else {
        runtime.outputs[action.config.output_name] =
          (await requireLocatorMethod(
            locator,
            "textContent",
            action.type,
          )()) ?? "";
      }
    },
    extract_attribute: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          await deps.locatorForAction(runtime, action.config),
          "getAttribute",
          action.type,
        )(
          action.config.attribute,
        )) ?? "";
    },
    extract_input_value: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          await deps.locatorForAction(runtime, action.config),
          "inputValue",
          action.type,
        )()) ?? "";
    },
    extract_list: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      const separator = action.config.separator;
      const count = (await locator.count?.()) ?? 0;
      const values: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const itemLocator = locator.nth?.(index);
        if (itemLocator) {
          if (separator) {
            const itemText = (await requireLocatorMethod(
              itemLocator,
              "evaluate",
              action.type,
            )((element: any, sep: any) => {
              return Array.from(element.childNodes)
                .map((node: any) => node.textContent?.trim() || "")
                .filter(Boolean)
                .join(sep);
            }, separator)) as string;
            values.push(itemText ?? "");
          } else {
            values.push((await itemLocator.textContent?.()) ?? "");
          }
        }
      }
      if (action.config.join_list) {
        runtime.outputs[action.config.output_name] = values.join(action.config.join_separator ?? "");
      } else {
        runtime.outputs[action.config.output_name] = values;
      }
    },
    count_elements: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] = (await locator.count?.()) ?? 0;
    },
    extract_regex_matches: async (action) => {
      const source = outputValueToText(runtime.outputs[action.config.source_name]);
      const regex = regexFromActionConfig(action.config.pattern, action.config.flags);
      const matches = Array.from(source.matchAll(regex), (match) => match[0]).filter(Boolean);
      const existing = action.config.append
        ? outputValueToList(runtime.outputs[action.config.output_name])
        : [];
      const nextValues = [...existing, ...matches];
      runtime.outputs[action.config.output_name] = action.config.dedupe
        ? dedupeStrings(nextValues)
        : nextValues;
    },
    extract_table: async (action) => {
      runtime.outputs[action.config.output_name] = await extractTable(
        await deps.locatorForAction(runtime, action.config),
      );
    },
    extract_text_content: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(locator, "textContent", action.type)()) ?? "";
    },
    extract_inner_html: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => el.innerHTML)) ?? "";
    },
    extract_outer_html: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => el.outerHTML)) ?? "";
    },
    extract_computed_style: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any, prop: string) => {
          return window.getComputedStyle(el).getPropertyValue(prop);
        }, action.config.property)) ?? "";
    },
    extract_all_attributes: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const attrs: Record<string, string> = {};
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            attrs[attr.name] = attr.value;
          }
          return attrs;
        })) ?? {};
    },
    extract_data_attributes: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const attrs: Record<string, string> = {};
          for (let i = 0; i < el.attributes.length; i++) {
            const attr = el.attributes[i];
            if (attr.name.startsWith("data-")) {
              attrs[attr.name] = attr.value;
            }
          }
          return attrs;
        })) ?? {};
    },
    extract_class_list: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => Array.from(el.classList))) ?? [];
    },
    extract_descendant_attributes: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const getAttrs = (element: any) => {
            const attrs: Record<string, string> = {};
            for (let i = 0; i < element.attributes.length; i++) {
              const attr = element.attributes[i];
              attrs[attr.name] = attr.value;
            }
            return attrs;
          };
          const results: Array<{ tag: string; attributes: Record<string, string> }> = [];
          const traverse = (current: any) => {
            results.push({
              tag: current.tagName.toLowerCase(),
              attributes: getAttrs(current),
            });
            for (let i = 0; i < current.children.length; i++) {
              traverse(current.children[i]);
            }
          };
          traverse(el);
          return results;
        })) ?? [];
    },
    extract_select_value: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          if (el instanceof HTMLSelectElement) {
            const opt = el.options[el.selectedIndex];
            return opt ? { value: opt.value, text: opt.text } : null;
          }
          return null;
        })) ?? null;
    },
    extract_select_options: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          if (el instanceof HTMLSelectElement) {
            return Array.from(el.options).map((opt) => ({
              value: opt.value,
              text: opt.text,
              selected: opt.selected,
            }));
          }
          return [];
        })) ?? [];
    },
    extract_checkbox_state: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          if (el instanceof HTMLInputElement && el.type === "checkbox") {
            return { checked: el.checked, indeterminate: el.indeterminate };
          }
          return { checked: false, indeterminate: false };
        })) ?? { checked: false, indeterminate: false };
    },
    extract_form_data: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const form = el instanceof HTMLFormElement ? el : el.closest("form");
          if (!form) return {};
          const formData = new FormData(form);
          const result: Record<string, string> = {};
          formData.forEach((val, key) => {
            result[key] = String(val);
          });
          return result;
        })) ?? {};
    },
    extract_table_headers: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const headers = Array.from((el as any).querySelectorAll("th"));
          return headers.map((th: any) => (th as any).textContent?.trim() || "");
        })) ?? [];
    },
    extract_table_row: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any, rowIndex: number) => {
          const rows = Array.from((el as any).querySelectorAll("tr"));
          const row = rows[rowIndex];
          if (!row) return {};
          const cells = Array.from((row as any).querySelectorAll("td, th"));
          const rowData: Record<string, string> = {};
          cells.forEach((cell: any, i) => {
            rowData[String(i)] = (cell as any).textContent?.trim() || "";
          });
          return rowData;
        }, action.config.row_index)) ?? {};
    },
    extract_table_column: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any, colKey: string) => {
          const rows = Array.from((el as any).querySelectorAll("tr"));
          const values: string[] = [];
          const colIndex = parseInt(colKey, 10);
          rows.forEach((row: any) => {
            const cells = Array.from((row as any).querySelectorAll("td, th"));
            const cell = cells[colIndex];
            if (cell) {
              values.push((cell as any).textContent?.trim() || "");
            }
          });
          return values;
        }, action.config.column)) ?? [];
    },
    extract_table_cell: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any, args: { row: number; col: number }) => {
          const rows = Array.from((el as any).querySelectorAll("tr"));
          const row = rows[args.row];
          if (!row) return "";
          const cells = Array.from((row as any).querySelectorAll("td, th"));
          const cell = cells[args.col];
          return cell ? ((cell as any).textContent?.trim() || "") : "";
        }, { row: action.config.row, col: action.config.column })) ?? "";
    },
    extract_list_attributes: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      const count = (await locator.count?.()) ?? 0;
      const values: string[] = [];
      for (let index = 0; index < count; index += 1) {
        const itemLocator = locator.nth?.(index);
        if (itemLocator) {
          const val = (await requireLocatorMethod(
            itemLocator,
            "getAttribute",
            action.type,
          )(action.config.attribute as string)) as string | null;
          values.push(val ?? "");
        }
      }
      runtime.outputs[action.config.output_name] = values;
    },
    extract_structured_list: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      const count = (await locator.count?.()) ?? 0;
      const results: any[] = [];
      for (let index = 0; index < count; index += 1) {
        const container = locator.nth?.(index);
        if (container) {
          const itemData = await requireLocatorMethod(
            container,
            "evaluate",
            action.type,
          )((el: any, mappings: any[]) => {
            const data: Record<string, string> = {};
            mappings.forEach((m) => {
              const child = el.querySelector(m.selector);
              if (!child) {
                data[m.name] = "";
                return;
              }
              if (m.capture_type === "text") {
                data[m.name] = child.textContent?.trim() || "";
              } else if (m.capture_type === "attribute" && m.attribute) {
                data[m.name] = child.getAttribute(m.attribute) || "";
              } else {
                data[m.name] = "";
              }
            });
            return data;
          }, action.config.mappings);
          results.push(itemData);
        }
      }
      runtime.outputs[action.config.output_name] = results;
    },
    extract_dimensions: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.x,
            y: rect.y,
            width: rect.width,
            height: rect.height,
            top: rect.top,
            left: rect.left,
            right: rect.right,
            bottom: rect.bottom,
          };
        })) ?? {};
    },
    extract_visibility: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          const style = window.getComputedStyle(el);
          const rect = el.getBoundingClientRect();
          const inViewport =
            rect.top >= 0 &&
            rect.left >= 0 &&
            rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
            rect.right <= (window.innerWidth || document.documentElement.clientWidth);
          return {
            visible: style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0,
            display: style.display,
            opacity: parseFloat(style.opacity || "1"),
            inViewport,
          };
        })) ?? { visible: false, display: "none", opacity: 0, inViewport: false };
    },
    extract_element_state: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      runtime.outputs[action.config.output_name] =
        (await requireLocatorMethod(
          locator,
          "evaluate",
          action.type,
        )((el: any) => {
          return {
            disabled: el.disabled === true,
            readonly: el.readOnly === true,
            required: el.required === true,
            focused: document.activeElement === el,
            editable: el.contentEditable === "true" || (el instanceof HTMLInputElement && !el.readOnly && !el.disabled),
          };
        })) ?? { disabled: false, readonly: false, required: false, focused: false, editable: false };
    },
    check_element_exists: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      const count = (await locator.count?.()) ?? 0;
      runtime.outputs[action.config.output_name] = count > 0;
    },
    get_page_title: async (action) => {
      runtime.outputs[action.config.output_name] = await runtime.page.evaluate(() => document.title);
    },
    get_meta_content: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await runtime.page.evaluate((metaName) => {
          const meta = document.querySelector(`meta[name="${metaName}"], meta[property="${metaName}"]`);
          return meta ? meta.getAttribute("content") : null;
        }, action.config.meta_name)) ?? null;
    },
    extract_page_links: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await runtime.page.evaluate(() => {
          return Array.from(document.querySelectorAll("a")).map((a: any) => ({
            text: a.textContent?.trim() || "",
            href: a.href || "",
            rel: a.rel || "",
          }));
        })) ?? [];
    },
    extract_numbers: async (action) => {
      const sourceVal = String(runtime.outputs[action.config.source_name] ?? "");
      const matches = sourceVal.match(/-?\d+(?:\.\d+)?/g);
      runtime.outputs[action.config.output_name] = matches ? matches.map(Number) : [];
    },
    extract_urls: async (action) => {
      const sourceVal = String(runtime.outputs[action.config.source_name] ?? "");
      const urlRegex = /https?:\/\/[^\s$.?#].[^\s]*/g;
      const matches = sourceVal.match(urlRegex);
      runtime.outputs[action.config.output_name] = matches ?? [];
    },
    extract_emails: async (action) => {
      const sourceVal = String(runtime.outputs[action.config.source_name] ?? "");
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
      const matches = sourceVal.match(emailRegex);
      runtime.outputs[action.config.output_name] = matches ?? [];
    },
    take_screenshot: async (action) => {
      const artifact = resolveEvidenceArtifact({
        evidenceDir: deps.appPaths.evidenceDir,
        runId: runtime.runId,
        kind: "screenshots",
        stepNumber: runtime.currentStepNumber,
        nodeId: runtime.currentStepId,
        requestedName: action.config.path,
        fallbackName: "screenshot",
        extension: ".png",
      });
      await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
      const buffer = await runtime.page.screenshot?.({ fullPage: action.config.full_page });
      if (buffer) await fs.writeFile(artifact.absolutePath, buffer);
      deps.recordEvidence(runtime, {
        actionType: action.type,
        artifactKind: "screenshot",
        relativePath: artifact.relativePath,
      });
      if (action.config.output_name) runtime.outputs[action.config.output_name] = artifact.relativePath;
    },
    write_text_file: async (action) => {
      const text = outputValueToText(
        runtime.outputs[action.config.source_name],
        action.config.separator ?? "\n",
      );
      const content = action.config.include_trailing_newline === false || !text
        ? text
        : `${text}\n`;
      const artifact = resolveEvidenceArtifact({
        evidenceDir: deps.appPaths.evidenceDir,
        runId: runtime.runId,
        kind: "downloads",
        stepNumber: runtime.currentStepNumber,
        nodeId: runtime.currentStepId,
        requestedName: action.config.path,
        fallbackName: "text-output",
        extension: ".txt",
      });
      await fs.mkdir(path.dirname(artifact.absolutePath), { recursive: true });
      await fs.writeFile(artifact.absolutePath, content, "utf8");
      deps.recordEvidence(runtime, {
        actionType: action.type,
        artifactKind: "download",
        relativePath: artifact.relativePath,
      });
      runtime.outputs[action.config.output_name] = artifact.relativePath;
    },
    go_back: async () => {
      await runtime.page.goBack?.();
    },
    go_forward: async () => {
      await runtime.page.goForward?.();
    },
    reload: async () => {
      await runtime.page.reload?.();
    },
    open_new_tab: async (action) => {
      runtime.page = await runtime.context.newPage();
      if (action.config.url) {
        const url = renderTemplate(action.config.url, runtime.outputs);
        await deps.enforceNavigationPolicy(runtime, url);
        await runtime.page.goto(url);
      }
    },
    click_and_switch_tab: async (action) => {
      const timeout = action.config.timeout_ms ?? 30000;
      const locator = await deps.locatorForAction(runtime, action.config);

      if (!runtime.context.waitForEvent) {
        throw new Error("Browser context does not support waitForEvent");
      }

      const [newPage] = await Promise.all([
        runtime.context.waitForEvent("page", { timeout }),
        locator.click({ timeout }),
      ]);

      runtime.page = newPage;
      await runtime.page.bringToFront?.();
    },
    switch_tab: async (action) => {
      const page = runtime.context.pages()[action.config.index];
      if (!page) throw new Error(`Tab index ${action.config.index} does not exist`);
      runtime.page = page;
      await runtime.page.bringToFront?.();
    },
    close_tab: async (action) => {
      const pageIndex = action.config.index ?? runtime.context.pages().length - 1;
      const page = runtime.context.pages()[pageIndex];
      if (!page) throw new Error(`Tab index ${pageIndex} does not exist`);
      await page.close?.();
      runtime.page = runtime.context.pages()[0] ?? (await runtime.context.newPage());
    },
    accept_dialog: async (action) => {
      deps.registerDialogHandler(runtime, "accept", action.config.prompt_text ?? undefined);
    },
    dismiss_dialog: async () => {
      deps.registerDialogHandler(runtime, "dismiss");
    },
    wait_for_download: async (action) => {
      const artifactPath = await deps.waitForDownload(runtime, action.config.output_name, action.config.timeout_ms);
      runtime.outputs[action.config.output_name] = artifactPath;
    },
    set_variable: async (action) => {
      setVariables(runtime.outputs, action.config);
    },
    set_json_variables: async (action) => {
      const parsed = JSON.parse(renderTemplate(action.config.json, runtime.outputs));
      if (!isPlainRecord(parsed)) throw new Error("JSON variables must be an object");
      const evaluated = evaluateMathInObject(parsed);
      for (const [key, val] of Object.entries(evaluated)) {
        writeVariableValue(runtime.outputs, key, val);
      }
    },
    update_number_variable: async (action) => {
      const { name, operation, value } = action.config;
      if (!name) return;

      let existing = Number(runtime.outputs[name]);
      if (Number.isNaN(existing)) {
        existing = 0;
      }

      let newVal = existing;
      if (operation === "increment") {
        newVal = existing + 1;
      } else if (operation === "decrement") {
        newVal = existing - 1;
      } else {
        const parsedVal = Number(parseVariableValue("number", value ?? "0", runtime.outputs));
        const val = Number.isNaN(parsedVal) ? 0 : parsedVal;
        if (operation === "add") newVal = existing + val;
        else if (operation === "subtract") newVal = existing - val;
        else if (operation === "multiply") newVal = existing * val;
        else if (operation === "divide") newVal = val !== 0 ? existing / val : 0;
      }

      writeVariableValue(runtime.outputs, name, newVal);
    },
    set_number_variable: async (action) => {
      const { output_name, value } = action.config;
      if (!output_name) return;
      const num = Number(parseVariableValue("number", value, runtime.outputs));
      writeVariableValue(runtime.outputs, output_name, Number.isNaN(num) ? 0 : num);
    },
    generate_random_number: async (action) => {
      const { output_name, min, max, integer } = action.config;
      if (!output_name) return;
      const minVal = Number(parseVariableValue("number", min, runtime.outputs));
      const maxVal = Number(parseVariableValue("number", max, runtime.outputs));
      if (Number.isNaN(minVal) || Number.isNaN(maxVal)) {
        throw new Error("Min and Max must be valid numbers");
      }
      const rand = deps.random();
      let result = minVal + rand * (maxVal - minVal);
      if (integer) {
        result = Math.floor(minVal + rand * (maxVal - minVal + 1));
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    parse_text_to_number: async (action) => {
      const { source, fallback, output_name } = action.config;
      if (!output_name) return;
      const text = renderTemplate(source, runtime.outputs);
      let num = Number(text);
      if (Number.isNaN(num)) {
        const fallbackText = fallback != null ? renderTemplate(fallback, runtime.outputs) : "0";
        num = Number(fallbackText);
        if (Number.isNaN(num)) {
          num = 0;
        }
      }
      writeVariableValue(runtime.outputs, output_name, num);
    },
    math_operation: async (action) => {
      const { operand1, operation, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = Number(parseVariableValue("number", operand1, runtime.outputs));
      if (Number.isNaN(op1)) throw new Error("Operand 1 must be a valid number");

      let result = 0;
      if (["add", "subtract", "multiply", "divide", "modulo", "power", "min", "max"].includes(operation)) {
        if (operand2 == null) throw new Error(`Operand 2 is required for operation: ${operation}`);
        const op2 = Number(parseVariableValue("number", operand2, runtime.outputs));
        if (Number.isNaN(op2)) throw new Error("Operand 2 must be a valid number");

        if (operation === "add") result = op1 + op2;
        else if (operation === "subtract") result = op1 - op2;
        else if (operation === "multiply") result = op1 * op2;
        else if (operation === "divide") result = op2 !== 0 ? op1 / op2 : 0;
        else if (operation === "modulo") result = op2 !== 0 ? op1 % op2 : 0;
        else if (operation === "power") result = Math.pow(op1, op2);
        else if (operation === "min") result = Math.min(op1, op2);
        else if (operation === "max") result = Math.max(op1, op2);
      } else {
        if (operation === "abs") result = Math.abs(op1);
        else if (operation === "sqrt") result = Math.sqrt(op1);
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    round_number: async (action) => {
      const { source, mode, decimals, output_name } = action.config;
      if (!output_name) return;
      const num = Number(parseVariableValue("number", source, runtime.outputs));
      const decimalPlaces = Number(parseVariableValue("number", decimals ?? "0", runtime.outputs));
      if (Number.isNaN(num) || Number.isNaN(decimalPlaces)) {
        throw new Error("Source and decimals must be valid numbers");
      }
      const factor = Math.pow(10, Math.max(0, decimalPlaces));
      let result = num;
      if (mode === "round") result = Math.round(num * factor) / factor;
      else if (mode === "floor") result = Math.floor(num * factor) / factor;
      else if (mode === "ceil") result = Math.ceil(num * factor) / factor;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    format_number: async (action) => {
      const { source, format, decimals, currency_code, locale, output_name } = action.config;
      if (!output_name) return;
      const num = Number(parseVariableValue("number", source, runtime.outputs));
      if (Number.isNaN(num)) throw new Error("Source must be a valid number");

      const l = locale ? renderTemplate(locale, runtime.outputs) : undefined;
      const options: Intl.NumberFormatOptions = {};
      if (decimals != null) {
        const d = Number(parseVariableValue("number", decimals, runtime.outputs));
        if (!Number.isNaN(d)) {
          options.minimumFractionDigits = d;
          options.maximumFractionDigits = d;
        }
      }
      if (format === "currency") {
        options.style = "currency";
        options.currency = currency_code ? renderTemplate(currency_code, runtime.outputs) : "USD";
      } else if (format === "percent") {
        options.style = "percent";
      }
      
      const formatted = new Intl.NumberFormat(l, options).format(num);
      writeVariableValue(runtime.outputs, output_name, formatted);
    },
    compare_numbers: async (action) => {
      const { operand1, operator, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = Number(parseVariableValue("number", operand1, runtime.outputs));
      const op2 = Number(parseVariableValue("number", operand2, runtime.outputs));
      if (Number.isNaN(op1) || Number.isNaN(op2)) {
        throw new Error("Both operands must be valid numbers");
      }
      let result = false;
      if (operator === "gt") result = op1 > op2;
      else if (operator === "gte") result = op1 >= op2;
      else if (operator === "lt") result = op1 < op2;
      else if (operator === "lte") result = op1 <= op2;
      else if (operator === "eq") result = op1 === op2;
      else if (operator === "neq") result = op1 !== op2;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_number_range: async (action) => {
      const { value, min, max, inclusive, output_name } = action.config;
      if (!output_name) return;
      const val = Number(parseVariableValue("number", value, runtime.outputs));
      const minVal = Number(parseVariableValue("number", min, runtime.outputs));
      const maxVal = Number(parseVariableValue("number", max, runtime.outputs));
      if (Number.isNaN(val) || Number.isNaN(minVal) || Number.isNaN(maxVal)) {
        throw new Error("Value, Min, and Max must be valid numbers");
      }
      const result = inclusive
        ? val >= minVal && val <= maxVal
        : val > minVal && val < maxVal;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_number_property: async (action) => {
      const { value, property, output_name } = action.config;
      if (!output_name) return;
      const val = Number(parseVariableValue("number", value, runtime.outputs));
      if (Number.isNaN(val)) throw new Error("Value must be a valid number");
      let result = false;
      if (property === "even") result = val % 2 === 0;
      else if (property === "odd") result = Math.abs(val % 2) === 1;
      else if (property === "integer") result = Number.isInteger(val);
      else if (property === "positive") result = val > 0;
      else if (property === "negative") result = val < 0;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    update_text_variable: async (action) => {
      const { name, operation, value, search_pattern } = action.config;
      if (!name) return;

      const existing = String(runtime.outputs[name] ?? "");
      let newVal = existing;

      if (operation === "append") {
        newVal = existing + renderTemplate(value ?? "", runtime.outputs);
      } else if (operation === "prepend") {
        newVal = renderTemplate(value ?? "", runtime.outputs) + existing;
      } else if (operation === "replace") {
        const search = renderTemplate(search_pattern ?? "", runtime.outputs);
        const replaceVal = renderTemplate(value ?? "", runtime.outputs);
        let searchRegex: RegExp | string = search;
        const match = search.match(/^\/(.*?)\/([gimy]*)$/);
        if (match) {
          try {
            searchRegex = new RegExp(match[1], match[2]);
          } catch {
            // fallback
          }
        }
        if (typeof searchRegex === "string") {
          newVal = existing.replaceAll(searchRegex, replaceVal);
        } else {
          newVal = existing.replace(searchRegex, replaceVal);
        }
      } else if (operation === "uppercase") {
        newVal = existing.toUpperCase();
      } else if (operation === "lowercase") {
        newVal = existing.toLowerCase();
      } else if (operation === "trim") {
        newVal = existing.trim();
      }

      writeVariableValue(runtime.outputs, name, newVal);
    },
    set_text_variable: async (action) => {
      const { output_name, value } = action.config;
      if (!output_name) return;
      const evaluated = renderTemplate(value ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, evaluated);
    },
    append_text: async (action) => {
      const { name, value } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const newVal = existing + renderTemplate(value ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, name, newVal);
    },
    prepend_text: async (action) => {
      const { name, value } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const newVal = renderTemplate(value ?? "", runtime.outputs) + existing;
      writeVariableValue(runtime.outputs, name, newVal);
    },
    replace_text: async (action) => {
      const { name, search_pattern, replacement } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const search = renderTemplate(search_pattern ?? "", runtime.outputs);
      const replaceVal = renderTemplate(replacement ?? "", runtime.outputs);
      let searchRegex: RegExp | string = search;
      const match = search.match(/^\/(.*?)\/([gimy]*)$/);
      if (match) {
        try {
          searchRegex = new RegExp(match[1], match[2]);
        } catch {
          // fallback
        }
      }
      let newVal = existing;
      if (typeof searchRegex === "string") {
        newVal = existing.replaceAll(searchRegex, replaceVal);
      } else {
        newVal = existing.replace(searchRegex, replaceVal);
      }
      writeVariableValue(runtime.outputs, name, newVal);
    },
    trim_text: async (action) => {
      const { name } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      writeVariableValue(runtime.outputs, name, existing.trim());
    },
    change_text_case: async (action) => {
      const { name, to_case } = action.config;
      if (!name) return;
      const existing = String(runtime.outputs[name] ?? "");
      const newVal = to_case === "upper" ? existing.toUpperCase() : existing.toLowerCase();
      writeVariableValue(runtime.outputs, name, newVal);
    },
    slice_text: async (action) => {
      const { source, start, end, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const startIdx = Number(renderTemplate(String(start ?? 0), runtime.outputs));
      const endIdx = end != null ? Number(renderTemplate(String(end), runtime.outputs)) : undefined;
      const newVal = text.slice(startIdx, endIdx);
      writeVariableValue(runtime.outputs, output_name, newVal);
    },
    regex_extract: async (action) => {
      const { source, pattern, group_index, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const regexStr = renderTemplate(pattern ?? "", runtime.outputs);
      const groupIdx = group_index != null ? Number(renderTemplate(String(group_index), runtime.outputs)) : 1;
      try {
        const regex = new RegExp(regexStr);
        const match = text.match(regex);
        if (match) {
          writeVariableValue(runtime.outputs, output_name, match[groupIdx] ?? match[0] ?? "");
        } else {
          writeVariableValue(runtime.outputs, output_name, "");
        }
      } catch {
        writeVariableValue(runtime.outputs, output_name, "");
      }
    },
    get_text_length: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      writeVariableValue(runtime.outputs, output_name, text.length);
    },
    check_text_empty: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const val = runtime.outputs[source];
      const isEmpty = val === undefined || val === null || String(val).trim() === "";
      writeVariableValue(runtime.outputs, output_name, isEmpty);
    },
    check_text_contains: async (action) => {
      const { source, substring, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const search = renderTemplate(substring ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, text.includes(search));
    },
    check_text_regex_matches: async (action) => {
      const { source, pattern, output_name } = action.config;
      if (!output_name) return;
      const text = String(runtime.outputs[source] ?? "");
      const regexStr = renderTemplate(pattern ?? "", runtime.outputs);
      try {
        const regex = new RegExp(regexStr);
        writeVariableValue(runtime.outputs, output_name, regex.test(text));
      } catch {
        writeVariableValue(runtime.outputs, output_name, false);
      }
    },
    update_flag_variable: async (action) => {
      const { name, operation } = action.config;
      if (!name) return;

      const existing = Boolean(runtime.outputs[name]);
      let newVal = existing;

      if (operation === "toggle") {
        newVal = !existing;
      } else if (operation === "set_true") {
        newVal = true;
      } else if (operation === "set_false") {
        newVal = false;
      }

      writeVariableValue(runtime.outputs, name, newVal);
    },
    set_boolean_variable: async (action) => {
      const { output_name, value } = action.config;
      if (!output_name) return;
      const parsedVal = parseVariableValue("boolean", value, runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, parsedVal);
    },
    generate_random_boolean: async (action) => {
      const { output_name, probability } = action.config;
      if (!output_name) return;
      const probStr = probability != null ? String(probability) : "0.5";
      const probVal = Number(parseVariableValue("number", probStr, runtime.outputs));
      const threshold = Number.isNaN(probVal) ? 0.5 : probVal;
      const rand = deps.random();
      writeVariableValue(runtime.outputs, output_name, rand < threshold);
    },
    parse_to_boolean: async (action) => {
      const { source, fallback, output_name } = action.config;
      if (!output_name) return;
      const text = renderTemplate(source, runtime.outputs).trim().toLowerCase();
      let result: boolean;
      if (text === "true" || text === "1" || text === "yes" || text === "on") {
        result = true;
      } else if (text === "false" || text === "0" || text === "no" || text === "off" || text === "") {
        result = false;
      } else {
        const fallbackText = fallback != null ? renderTemplate(fallback, runtime.outputs).trim().toLowerCase() : "false";
        result = (fallbackText === "true" || fallbackText === "1" || fallbackText === "yes" || fallbackText === "on");
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    boolean_logical_op: async (action) => {
      const { operand1, operation, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = parseVariableValue("boolean", operand1, runtime.outputs);
      let result = false;
      if (operation === "not") {
        result = !op1;
      } else {
        if (operand2 == null) throw new Error(`Operand 2 is required for operation: ${operation}`);
        const op2 = parseVariableValue("boolean", operand2, runtime.outputs);
        if (operation === "and") result = op1 && op2;
        else if (operation === "or") result = op1 || op2;
        else if (operation === "xor") result = op1 !== op2;
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    compare_booleans: async (action) => {
      const { operand1, operator, operand2, output_name } = action.config;
      if (!output_name) return;
      const op1 = parseVariableValue("boolean", operand1, runtime.outputs);
      const op2 = parseVariableValue("boolean", operand2, runtime.outputs);
      const result = operator === "eq" ? op1 === op2 : op1 !== op2;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_boolean_property: async (action) => {
      const { source, property, output_name } = action.config;
      if (!output_name) return;
      const val = parseVariableValue("boolean", source, runtime.outputs);
      const result = property === "is_true" ? val === true : val === false;
      writeVariableValue(runtime.outputs, output_name, result);
    },
    update_list_variable: async (action) => {
      const { name, operation, value, value_type, index } = action.config;
      if (!name) return;

      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];

      if (["push", "unshift", "push_unique"].includes(operation)) {
        const parsedValue = parseVariableValue(
          value_type ?? "text",
          value ?? "",
          runtime.outputs,
        );
        if (operation === "push") {
          array.push(parsedValue);
        } else if (operation === "unshift") {
          array.unshift(parsedValue);
        } else if (operation === "push_unique") {
          const exists = array.some((item) => {
            if (
              typeof item === "object" &&
              item !== null &&
              typeof parsedValue === "object" &&
              parsedValue !== null
            ) {
              return JSON.stringify(item) === JSON.stringify(parsedValue);
            }
            return item === parsedValue;
          });
          if (!exists) {
            array.push(parsedValue);
          }
        }
      } else if (["merge", "merge_unique"].includes(operation)) {
        let valToMerge: unknown;
        const varMatch = value?.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
        if (varMatch) {
          valToMerge = runtime.outputs[varMatch[1]];
        } else if (value !== null && value !== undefined) {
          valToMerge = parseVariableValue(
            value_type ?? "json",
            value,
            runtime.outputs,
          );
        }

        if (valToMerge !== undefined) {
          const itemsToMerge = Array.isArray(valToMerge) ? valToMerge : [valToMerge];
          if (operation === "merge") {
            array.push(...itemsToMerge);
          } else if (operation === "merge_unique") {
            for (const item of itemsToMerge) {
              const exists = array.some((existingItem) => {
                if (
                  typeof existingItem === "object" &&
                  existingItem !== null &&
                  typeof item === "object" &&
                  item !== null
                ) {
                  return JSON.stringify(existingItem) === JSON.stringify(item);
                }
                return existingItem === item;
              });
              if (!exists) {
                array.push(item);
              }
            }
          }
        }
      } else if (operation === "pop") {
        array.pop();
      } else if (operation === "shift") {
        array.shift();
      } else if (operation === "remove_by_index") {
        const idx = Number(renderTemplate(String(index ?? ""), runtime.outputs));
        if (!Number.isNaN(idx)) {
          array.splice(idx, 1);
        }
      } else if (operation === "remove_by_value") {
        const valToRemove = parseVariableValue(
          value_type ?? "text",
          value ?? "",
          runtime.outputs,
        );
        const nextArray = array.filter((item) => {
          if (
            typeof item === "object" &&
            item !== null &&
            typeof valToRemove === "object" &&
            valToRemove !== null
          ) {
            return JSON.stringify(item) !== JSON.stringify(valToRemove);
          }
          return item !== valToRemove;
        });
        array.length = 0;
        array.push(...nextArray);
      }

      writeVariableValue(runtime.outputs, name, array);
    },
    create_empty_list: async (action) => {
      const { output_name } = action.config;
      if (!output_name) return;
      writeVariableValue(runtime.outputs, output_name, []);
    },
    create_list_manual: async (action) => {
      const { output_name, value_type, items } = action.config;
      if (!output_name) return;
      const parsedItems = (items || []).map((item) =>
        parseVariableValue(value_type || "text", item, runtime.outputs),
      );
      writeVariableValue(runtime.outputs, output_name, parsedItems);
    },
    split_text_to_list: async (action) => {
      const { output_name, source_text, delimiter } = action.config;
      if (!output_name) return;
      const text = renderTemplate(source_text || "", runtime.outputs);
      const parsedDelimiter = renderTemplate(delimiter ?? ",", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, text.split(parsedDelimiter));
    },
    generate_number_range: async (action) => {
      const { output_name, start, end, step } = action.config;
      if (!output_name) return;
      const evaluatedStart = Number(renderTemplate(String(start ?? 0), runtime.outputs));
      const evaluatedEnd = Number(renderTemplate(String(end ?? 0), runtime.outputs));
      const evaluatedStep = Number(renderTemplate(String(step ?? 1), runtime.outputs)) || 1;
      
      const list: number[] = [];
      if (evaluatedStep > 0) {
        for (let i = evaluatedStart; i <= evaluatedEnd; i += evaluatedStep) {
          list.push(i);
        }
      } else if (evaluatedStep < 0) {
        for (let i = evaluatedStart; i >= evaluatedEnd; i += evaluatedStep) {
          list.push(i);
        }
      }
      writeVariableValue(runtime.outputs, output_name, list);
    },
    add_to_list: async (action) => {
      const { name, position, value_type, value } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
      
      if (position === "start") {
        array.unshift(parsedVal);
      } else if (position === "unique_end") {
        const exists = array.some((item) => {
          if (typeof item === "object" && item !== null && typeof parsedVal === "object" && parsedVal !== null) {
            return JSON.stringify(item) === JSON.stringify(parsedVal);
          }
          return item === parsedVal;
        });
        if (!exists) {
          array.push(parsedVal);
        }
      } else {
        array.push(parsedVal);
      }
      writeVariableValue(runtime.outputs, name, array);
    },
    remove_from_list_by_index: async (action) => {
      const { name, index } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      const idx = Number(renderTemplate(String(index ?? ""), runtime.outputs));
      if (!Number.isNaN(idx)) {
        array.splice(idx, 1);
      }
      writeVariableValue(runtime.outputs, name, array);
    },
    remove_from_list_by_value: async (action) => {
      const { name, value_type, value } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
      const nextArray = array.filter((item) => {
        if (typeof item === "object" && item !== null && typeof parsedVal === "object" && parsedVal !== null) {
          return JSON.stringify(item) !== JSON.stringify(parsedVal);
        }
        return item !== parsedVal;
      });
      writeVariableValue(runtime.outputs, name, nextArray);
    },
    merge_lists: async (action) => {
      const { name, value, unique } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const array = Array.isArray(existing) ? [...existing] : [];
      
      let valToMerge: unknown;
      const varMatch = value?.trim().match(/^\{\{\s*([^}]+?)\s*\}\}$/);
      if (varMatch) {
        valToMerge = runtime.outputs[varMatch[1]];
      } else if (value !== null && value !== undefined) {
        valToMerge = parseVariableValue("json", value, runtime.outputs);
      }
      
      if (valToMerge !== undefined) {
        const itemsToMerge = Array.isArray(valToMerge) ? valToMerge : [valToMerge];
        if (unique) {
          for (const item of itemsToMerge) {
            const exists = array.some((existingItem) => {
              if (typeof existingItem === "object" && existingItem !== null && typeof item === "object" && item !== null) {
                return JSON.stringify(existingItem) === JSON.stringify(item);
              }
              return existingItem === item;
            });
            if (!exists) {
              array.push(item);
            }
          }
        } else {
          array.push(...itemsToMerge);
        }
      }
      writeVariableValue(runtime.outputs, name, array);
    },
    get_list_item: async (action) => {
      const { source, position, index, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array) || array.length === 0) {
        if (runtime.currentStepId?.startsWith("__prelude:loop_item:")) {
          const mockVal = getMockValueForVariable(output_name);
          writeVariableValue(runtime.outputs, output_name, mockVal);
          return;
        }
        writeVariableValue(runtime.outputs, output_name, undefined);
        return;
      }
      
      let result: unknown;
      if (position === "first") {
        result = array[0];
      } else if (position === "last") {
        result = array[array.length - 1];
      } else if (position === "index") {
        const idx = Number(renderTemplate(String(index ?? ""), runtime.outputs));
        result = array[idx];
      }
      writeVariableValue(runtime.outputs, output_name, result);
    },
    get_list_length: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      writeVariableValue(runtime.outputs, output_name, Array.isArray(array) ? array.length : 0);
    },
    slice_list: async (action) => {
      const { source, start, end, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      const evaluatedStart = Number(renderTemplate(String(start ?? 0), runtime.outputs)) || 0;
      const evaluatedEnd = end !== undefined && end !== null && end !== "" 
        ? Number(renderTemplate(String(end), runtime.outputs))
        : undefined;
      writeVariableValue(runtime.outputs, output_name, array.slice(evaluatedStart, evaluatedEnd));
    },
    join_list: async (action) => {
      const { source, separator, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, "");
        return;
      }
      const parsedSeparator = renderTemplate(separator ?? "", runtime.outputs);
      writeVariableValue(runtime.outputs, output_name, array.join(parsedSeparator));
    },
    filter_list: async (action) => {
      const { source, rules_group, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      
      const filtered: unknown[] = [];
      const oldItem = runtime.outputs["item"];
      for (const item of array) {
        runtime.outputs["item"] = item;
        const matches = await evaluateRuleGroup(rules_group, runtime);
        if (matches) {
          filtered.push(item);
        }
      }
      
      if (oldItem === undefined) {
        delete runtime.outputs["item"];
      } else {
        runtime.outputs["item"] = oldItem;
      }
      writeVariableValue(runtime.outputs, output_name, filtered);
    },
    map_list_property: async (action) => {
      const { source, property_key, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      const mapped = array.map((item) => {
        if (item && typeof item === "object") {
          return (item as any)[property_key];
        }
        return undefined;
      });
      writeVariableValue(runtime.outputs, output_name, mapped);
    },
    sort_reverse_list: async (action) => {
      const { source, action: sortAction, sort_key, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, []);
        return;
      }
      
      const copied = [...array];
      if (sortAction === "reverse") {
        copied.reverse();
      } else {
        copied.sort((a: any, b: any) => {
          let valA = a;
          let valB = b;
          if (sort_key) {
            valA = a && typeof a === "object" ? a[sort_key] : undefined;
            valB = b && typeof b === "object" ? b[sort_key] : undefined;
          }
          if (valA === valB) return 0;
          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;
          
          if (typeof valA === "string" && typeof valB === "string") {
            return sortAction === "sort_asc" ? valA.localeCompare(valB) : valB.localeCompare(valA);
          }
          return sortAction === "sort_asc" ? (valA < valB ? -1 : 1) : (valA > valB ? -1 : 1);
        });
      }
      writeVariableValue(runtime.outputs, output_name, copied);
    },
    execute_list_script: async (action) => {
      const { source, script, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        throw new Error(`Source variable "${source}" is not an array.`);
      }
      if (!script) throw new Error("Script is required");
      
      const result = await runtime.page.evaluate((args) => {
        if (!args) throw new Error("Arguments are required");
        const { scriptText, list } = args;
        try {
          const fn = new Function("list", `return (${scriptText});`);
          return fn(list);
        } catch (err: any) {
          throw new Error(`Failed to evaluate JS on list: ${err.message}`);
        }
      }, { scriptText: script, list: array });
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_list_empty: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      writeVariableValue(runtime.outputs, output_name, Array.isArray(array) ? array.length === 0 : true);
    },
    check_list_contains: async (action) => {
      const { source, value_type, value, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, false);
        return;
      }
      const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
      const exists = array.some((item) => {
        if (typeof item === "object" && item !== null && typeof parsedVal === "object" && parsedVal !== null) {
          return JSON.stringify(item) === JSON.stringify(parsedVal);
        }
        return item === parsedVal;
      });
      writeVariableValue(runtime.outputs, output_name, exists);
    },
    check_list_any_match: async (action) => {
      const { source, rules_group, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, false);
        return;
      }
      
      let matches = false;
      const oldItem = runtime.outputs["item"];
      for (const item of array) {
        runtime.outputs["item"] = item;
        const currentMatches = await evaluateRuleGroup(rules_group, runtime);
        if (currentMatches) {
          matches = true;
          break;
        }
      }
      
      if (oldItem === undefined) {
        delete runtime.outputs["item"];
      } else {
        runtime.outputs["item"] = oldItem;
      }
      writeVariableValue(runtime.outputs, output_name, matches);
    },
    check_list_all_match: async (action) => {
      const { source, rules_group, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        writeVariableValue(runtime.outputs, output_name, false);
        return;
      }
      
      let matches = true;
      const oldItem = runtime.outputs["item"];
      for (const item of array) {
        runtime.outputs["item"] = item;
        const currentMatches = await evaluateRuleGroup(rules_group, runtime);
        if (!currentMatches) {
          matches = false;
          break;
        }
      }
      
      if (oldItem === undefined) {
        delete runtime.outputs["item"];
      } else {
        runtime.outputs["item"] = oldItem;
      }
      writeVariableValue(runtime.outputs, output_name, matches);
    },
    create_empty_object: async (action) => {
      const { output_name } = action.config;
      if (!output_name) return;
      cleanFlattenedKeys(runtime.outputs, output_name);
      writeVariableValue(runtime.outputs, output_name, {});
    },
    create_object_manual: async (action) => {
      const { output_name, fields } = action.config;
      if (!output_name) return;
      const obj: Record<string, unknown> = {};
      for (const field of fields || []) {
        const parsedVal = parseVariableValue(field.value_type || "text", field.value || "", runtime.outputs);
        obj[field.key] = parsedVal;
      }
      const evaluated = evaluateMathInObject(obj);
      cleanFlattenedKeys(runtime.outputs, output_name);
      writeVariableValue(runtime.outputs, output_name, evaluated);
    },
    parse_json_to_object: async (action) => {
      const { source_text, output_name } = action.config;
      if (!output_name) return;
      const rendered = renderTemplate(source_text || "{}", runtime.outputs);
      const parsedValue = JSON.parse(rendered);
      if (!isPlainRecord(parsedValue)) {
        throw new Error("Parsed value must be a JSON object");
      }
      cleanFlattenedKeys(runtime.outputs, output_name);
      writeVariableValue(runtime.outputs, output_name, parsedValue);
    },
    set_object_property: async (action) => {
      const { name, property_key, value_type, value } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const obj = isPlainRecord(existing) ? { ...existing } : {};
      const propKey = renderTemplate(property_key || "", runtime.outputs);
      if (propKey) {
        const parsedVal = parseVariableValue(value_type || "text", value || "", runtime.outputs);
        setPath(obj, propKey, parsedVal);
        const evaluated = evaluateMathInObject(obj);
        cleanFlattenedKeys(runtime.outputs, name);
        writeVariableValue(runtime.outputs, name, evaluated);
      }
    },
    remove_object_property: async (action) => {
      const { name, property_key } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      if (isPlainRecord(existing)) {
        const obj = { ...existing };
        const propKey = renderTemplate(property_key || "", runtime.outputs);
        if (propKey) {
          deletePath(obj, propKey);
          cleanFlattenedKeys(runtime.outputs, name);
          writeVariableValue(runtime.outputs, name, obj);
        }
      }
    },
    merge_objects: async (action) => {
      const { name, value, deep } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      const obj = isPlainRecord(existing) ? { ...existing } : {};
      const rendered = renderTemplate(value ?? "{}", runtime.outputs);
      const parsedValue = JSON.parse(rendered);
      if (!isPlainRecord(parsedValue)) {
        throw new Error("Merged value must be a JSON object");
      }
      const newObj = deep ? deepMerge(obj, parsedValue) : { ...obj, ...parsedValue };
      const evaluated = evaluateMathInObject(newObj);
      cleanFlattenedKeys(runtime.outputs, name);
      writeVariableValue(runtime.outputs, name, evaluated);
    },
    rename_object_property: async (action) => {
      const { name, old_key, new_key } = action.config;
      if (!name) return;
      const existing = runtime.outputs[name];
      if (isPlainRecord(existing)) {
        const obj = { ...existing };
        const oldKeyResolved = renderTemplate(old_key || "", runtime.outputs);
        const newKeyResolved = renderTemplate(new_key || "", runtime.outputs);
        if (oldKeyResolved && newKeyResolved && oldKeyResolved in obj) {
          obj[newKeyResolved] = obj[oldKeyResolved];
          delete obj[oldKeyResolved];
          cleanFlattenedKeys(runtime.outputs, name);
          writeVariableValue(runtime.outputs, name, obj);
        }
      }
    },
    get_object_property: async (action) => {
      const { source, property_key, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const propKey = renderTemplate(property_key || "", runtime.outputs);
      const val = getPath(existing, propKey);
      writeVariableValue(runtime.outputs, output_name, val);
    },
    get_object_keys: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const keys = isPlainRecord(existing) ? Object.keys(existing) : [];
      writeVariableValue(runtime.outputs, output_name, keys);
    },
    get_object_values: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const values = isPlainRecord(existing) ? Object.values(existing) : [];
      writeVariableValue(runtime.outputs, output_name, values);
    },
    stringify_object: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const stringified = isPlainRecord(existing) ? JSON.stringify(existing) : "{}";
      writeVariableValue(runtime.outputs, output_name, stringified);
    },
    execute_object_script: async (action) => {
      const { source, script, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      if (!isPlainRecord(existing)) {
        throw new Error(`Source variable "${source}" is not an object.`);
      }
      if (!script) throw new Error("Script is required");
      
      const result = await runtime.page.evaluate((args) => {
        if (!args) throw new Error("Arguments are required");
        const { scriptText, obj } = args;
        try {
          const fn = new Function("obj", `return (${scriptText});`);
          return fn(obj);
        } catch (err: any) {
          throw new Error(`Failed to evaluate JS on object: ${err.message}`);
        }
      }, { scriptText: script, obj: existing });
      writeVariableValue(runtime.outputs, output_name, result);
    },
    check_object_key_exists: async (action) => {
      const { source, property_key, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const propKey = renderTemplate(property_key || "", runtime.outputs);
      const exists = hasPath(existing, propKey);
      writeVariableValue(runtime.outputs, output_name, exists);
    },
    check_object_empty: async (action) => {
      const { source, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      const isEmpty = isPlainRecord(existing) ? Object.keys(existing).length === 0 : true;
      writeVariableValue(runtime.outputs, output_name, isEmpty);
    },
    assert_element: async (action) => {
      const locator = await deps.locatorForAction(runtime, action.config);
      await assertElementState(locator, action.config.state, action.config.timeout_ms);
    },
    assert_text: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_mode,
        ["contains", "equals"],
        "Match mode must be contains or equals",
      );
      const text = await (await deps.locatorForAction(runtime, action.config, "body")).textContent?.();
      if (action.config.match_mode === "equals" && text !== action.config.text) {
        throw new Error(`Text did not equal ${action.config.text}`);
      }
      if (action.config.match_mode === "contains" && !String(text ?? "").includes(action.config.text)) {
        throw new Error(`Text did not contain ${action.config.text}`);
      }
    },
    graph_noop: async () => undefined,
    if_condition: async (action) => {
      await deps.executeActions(
        runtime,
        await deps.conditionMatches(runtime, action.config.condition)
          ? action.config.then_steps
          : action.config.else_steps,
      );
    },
    router_condition: async (action) => {
      for (const caseValue of action.config.cases) {
        let matched = false;
        try {
          matched = await deps.conditionMatches(runtime, caseValue.condition);
        } catch (error) {
          throw new Error(
            `Router ${runtime.currentStepId ?? "unknown"} case "${caseValue.label}" condition failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
        if (matched) {
          await deps.executeActions(runtime, caseValue.steps);
          return;
        }
      }
      await deps.executeActions(runtime, action.config.default_steps);
    },
    random_choice: async (action) => {
      const choice = weightedRandomChoice(action.config.choices, deps.random);
      if (action.config.output_name?.trim()) {
        runtime.outputs[action.config.output_name] = choice.id;
      }
      await deps.executeActions(runtime, choice.steps);
    },
    repeat_times: async (action) => {
      for (let index = 0; index < action.config.times; index += 1) {
        runtime.outputs["system.loop.index"] = index;
        runtime.outputs["system.loop.number"] = index + 1;
        const control = await deps.executeLoopBody(runtime, action.config.steps);
        if (control === "break") break;
      }
    },
    repeat_for_each: async (action) => {
      const items = action.config.array_variable
        ? (runtime.outputs[action.config.array_variable] as unknown[])
        : action.config.items;
      if (!Array.isArray(items)) throw new Error("repeat_for_each source is not an array");

      let processedItems = [...items];

      // 1. Range Slicing
      let start = 0;
      if (action.config.start_index) {
        const renderedStart = renderTemplate(action.config.start_index, runtime.outputs);
        const parsedStart = parseInt(renderedStart, 10);
        if (!isNaN(parsedStart)) {
          start = parsedStart;
        }
      }

      let end: number | undefined;
      if (action.config.end_index) {
        const renderedEnd = renderTemplate(action.config.end_index, runtime.outputs);
        const parsedEnd = parseInt(renderedEnd, 10);
        if (!isNaN(parsedEnd)) {
          end = parsedEnd;
        }
      }

      if (end !== undefined) {
        processedItems = processedItems.slice(start, end);
      } else {
        processedItems = processedItems.slice(start);
      }

      // 2. Max loops (limit)
      if (action.config.max_loops) {
        const renderedMax = renderTemplate(action.config.max_loops, runtime.outputs);
        const parsedMax = parseInt(renderedMax, 10);
        if (!isNaN(parsedMax) && parsedMax >= 0) {
          processedItems = processedItems.slice(0, parsedMax);
        }
      }

      // 3. Min loops (padding)
      if (action.config.min_loops) {
        const renderedMin = renderTemplate(action.config.min_loops, runtime.outputs);
        const parsedMin = parseInt(renderedMin, 10);
        if (!isNaN(parsedMin) && parsedMin > 0) {
          while (processedItems.length < parsedMin) {
            processedItems.push(null);
          }
        }
      }

      let index = 0;
      for (const item of processedItems) {
        writeVariableValue(runtime.outputs, action.config.item_name, item);
        runtime.outputs["system.loop.index"] = index;
        runtime.outputs["system.loop.number"] = index + 1;
        const control = await deps.executeLoopBody(runtime, action.config.steps);
        index += 1;
        if (control === "break") break;
      }
    },
    retry_block: async (action) => {
      await deps.executeRetry(runtime, action.config.max_attempts, action.config.delay_ms ?? 0, action.config.steps, action.config.failed_steps ?? []);
    },
    switch_condition: async (action) => {
      const value = String(runtime.outputs[action.config.expression] ?? action.config.expression);
      const branch = action.config.cases.find((candidate) => candidate.value === value);
      await deps.executeActions(runtime, branch?.steps ?? action.config.default_steps);
    },
    while_loop: async (action) => {
      await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        () => deps.conditionMatches(runtime, action.config.condition),
        action.config.timeout_ms ?? null,
      );
    },
    repeat_until: async (action) => {
      const result = await deps.executeLoop(
        runtime,
        action.config.steps,
        action.config.max_attempts ?? 100,
        async () => !(await deps.conditionMatches(runtime, action.config.condition)),
        action.config.timeout_ms ?? null,
      );
      if (
        (result === "max_attempts" || result === "timeout") &&
        !(await deps.conditionMatches(runtime, action.config.condition))
      ) {
        await deps.executeActions(runtime, action.config.timeout_steps);
      }
    },
    try_catch: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.try_steps);
        await deps.executeActions(runtime, action.config.success_steps);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        runtime.outputs["last_error"] = message;
        runtime.outputs["system.last_error"] = message;
        if (action.config.error_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.error_steps);
      } finally {
        await deps.executeActions(runtime, action.config.finally_steps);
      }
    },
    fallback_block: async (action) => {
      try {
        await deps.executeActions(runtime, action.config.primary_steps);
      } catch (error) {
        if (action.config.fallback_steps.length === 0) throw error;
        await deps.executeActions(runtime, action.config.fallback_steps);
      }
    },
    break_loop: async () => {
      throw deps.createLoopControl("break");
    },
    continue_loop: async () => {
      throw deps.createLoopControl("continue");
    },
    stop_workflow: async (action) => {
      throw deps.createRunnerStop(
        action.config.status === "success" ? "success" : "failure",
        action.config.reason ?? "Workflow stopped",
        Boolean(action.config.close_browser),
      );
    },
    transform_variable: async (action) => {
      runtime.outputs[action.config.target_name] = renderTemplate(action.config.expression, runtime.outputs);
    },
    assert_output: async (action) => {
      assertRuntimeEnumValue(
        action.config.match_mode,
        ["contains", "equals"],
        "Match mode must be contains or equals",
      );
      const actual = String(runtime.outputs[action.config.name] ?? "");
      if (action.config.match_mode === "equals" && actual !== action.config.value) {
        throw new Error(`Output ${action.config.name} did not equal ${action.config.value}`);
      }
      if (action.config.match_mode === "contains" && !actual.includes(action.config.value)) {
        throw new Error(`Output ${action.config.name} did not contain ${action.config.value}`);
      }
    },
    domain_allowlist: async (action) => {
      const hostname = await currentPageHostname(runtime.page);
      if (!hostname || !hostnameAllowed(hostname, action.config.domains)) {
        throw new Error(
          `Current domain ${hostname ?? "unknown"} is not in the allowlist`,
        );
      }
      runtime.outputs.domain_allowlist = action.config.domains;
    },
    set_viewport: async (action) => {
      await runtime.page.setViewportSize?.({
        width: action.config.width,
        height: action.config.height,
      });
      runtime.outputs.last_set_viewport = action.config;
    },
    set_geolocation: async (action) => {
      await runtime.context.setGeolocation?.(action.config);
      runtime.outputs.last_set_geolocation = action.config;
    },
    set_extra_headers: async (action) => {
      await runtime.context.setExtraHTTPHeaders?.(
        Object.fromEntries(
          action.config.headers.map((header) => [header.name, header.value]),
        ),
      );
      runtime.outputs.last_set_extra_headers = action.config;
    },
    grant_permission: async (action) => {
      await runtime.context.grantPermissions?.(
        action.config.permissions,
        action.config.origin ? { origin: action.config.origin } : undefined,
      );
      runtime.outputs.last_grant_permission = action.config;
    },
    set_cookie: async (action) => {
      const domain = action.config.domain?.trim() || await currentPageHostname(runtime.page);
      if (!domain) {
        throw new Error("Set cookie requires a current page host when Domain is blank");
      }
      await runtime.context.addCookies?.([
        {
          name: action.config.name,
          value: action.config.value,
          domain,
          path: action.config.path ?? "/",
        },
      ]);
      runtime.outputs.last_set_cookie = { ...action.config, domain };
    },
    clear_cookies: async (action) => {
      await runtime.context.clearCookies?.(
        action.config.domain ? { domain: action.config.domain } : undefined,
      );
      runtime.outputs.last_clear_cookies = action.config;
    },
    execute_js: async (action) => {
      if (runtime.settings.run_policy.execute_js_enabled === false) {
        throw new Error("Execute JavaScript is disabled by Run Policy");
      }
      if (action.config.output_name) {
        runtime.outputs[action.config.output_name] = await withActionTimeout(
          runtime.page.evaluate(executableJavaScript(action.config.script)),
          action.config.timeout_ms,
          (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
        );
      } else {
        await withActionTimeout(
          runtime.page.evaluate(executableJavaScript(action.config.script)),
          action.config.timeout_ms,
          (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
        );
      }
    },
    wait_for_request: async (action) => {
      runtime.outputs.last_request_url = (
        await runtime.page.waitForRequest?.(
          (request) => request.url().includes(action.config.url_contains),
          { timeout: action.config.timeout_ms ?? undefined },
        )
      )?.url();
    },
    wait_for_response: async (action) => {
      const response = await runtime.page.waitForResponse?.(
        (candidate) =>
          candidate.url().includes(action.config.url_contains) &&
          (!action.config.status || candidate.status() === action.config.status),
        { timeout: action.config.timeout_ms ?? undefined },
      );
      runtime.outputs.last_response_url = response?.url();
    },
    block_request: async (action) => {
      for (const pattern of action.config.url_patterns) {
        await runtime.context.route?.(pattern, async (route) => route.abort());
      }
    },
    mock_response: async (action) => {
      await runtime.context.route?.(
        (url) => url.toString().includes(action.config.url_contains),
        async (route) =>
          route.fulfill({
            status: action.config.status,
            body: action.config.body,
            contentType: action.config.content_type ?? "text/plain",
          }),
      );
    },
    set_local_storage: async (action) => {
      await setWebStorage(runtime.page, "local", action.config.key, action.config.value);
      runtime.outputs[action.config.key] = action.config.value;
    },
    set_session_storage: async (action) => {
      await setWebStorage(runtime.page, "session", action.config.key, action.config.value);
      runtime.outputs[action.config.key] = action.config.value;
    },
    check_conditions: async (action) => {
      const { output_name, mode, script, rules_group, evaluation_type } = action.config;
      const resolvers = (runtime.outputs as any).__dynamicResolvers;
      if (evaluation_type === "dynamic" && resolvers) {
        const { findReferencedVariables } = await import("./variables.js");
        const refs = new Set<string>();
        if (mode === "script" && script) {
          findReferencedVariables(script, refs);
        } else if (mode === "visual" && rules_group) {
          findReferencedVariables(rules_group, refs);
        }
        resolvers.set(output_name, {
          dependencies: Array.from(refs),
          resolve: async () => {
            if (mode === "script") {
              if (!script) throw new Error("Script is required in script mode");
              const result = await runtime.page.evaluate((args) => {
                if (!args) throw new Error("Arguments are required");
                const { scriptText, outputs } = args;
                try {
                  const fn = new Function("outputs", `return (${scriptText});`);
                  return Boolean(fn(outputs));
                } catch (err: any) {
                  throw new Error(`Failed to evaluate JS: ${err.message}`);
                }
              }, { scriptText: renderTemplate(script, runtime.outputs), outputs: runtime.outputs });
              return result;
            } else {
              return await evaluateRuleGroup(rules_group, runtime);
            }
          },
        });
        runtime.outputs[output_name] = undefined;
      } else {
        if (resolvers) {
          resolvers.delete(output_name);
        }
        if (mode === "script") {
          if (!script) throw new Error("Script is required in script mode");
          const result = await runtime.page.evaluate((args) => {
            if (!args) throw new Error("Arguments are required");
            const { scriptText, outputs } = args;
            try {
              const fn = new Function("outputs", `return (${scriptText});`);
              return Boolean(fn(outputs));
            } catch (err: any) {
              throw new Error(`Failed to evaluate JS: ${err.message}`);
            }
          }, { scriptText: script, outputs: runtime.outputs });
          runtime.outputs[output_name] = result;
        } else {
          runtime.outputs[output_name] = await evaluateRuleGroup(rules_group, runtime);
        }
      }
    },
    calculate_value: async (action) => {
      const { output_name, expression, evaluation_type } = action.config;
      const resolvers = (runtime.outputs as any).__dynamicResolvers;
      if (evaluation_type === "dynamic" && resolvers) {
        const { findReferencedVariables } = await import("./variables.js");
        const refs = new Set<string>();
        if (expression) {
          findReferencedVariables(expression, refs);
        }
        resolvers.set(output_name, {
          dependencies: Array.from(refs),
          resolve: async () => {
            if (!expression) throw new Error("Expression is required");
            const result = await runtime.page.evaluate((args) => {
              if (!args) throw new Error("Arguments are required");
              const { scriptText, outputs } = args;
              try {
                const fn = new Function("outputs", `return (${scriptText});`);
                return fn(outputs);
              } catch (err: any) {
                throw new Error(`Failed to evaluate JS: ${err.message}`);
              }
            }, { scriptText: renderTemplate(expression, runtime.outputs), outputs: runtime.outputs });
            return result;
          },
        });
        runtime.outputs[output_name] = undefined;
      } else {
        if (resolvers) {
          resolvers.delete(output_name);
        }
        if (!expression) throw new Error("Expression is required");
        const result = await runtime.page.evaluate((args) => {
          if (!args) throw new Error("Arguments are required");
          const { scriptText, outputs } = args;
          try {
            const fn = new Function("outputs", `return (${scriptText});`);
            return fn(outputs);
          } catch (err: any) {
            throw new Error(`Failed to evaluate JS: ${err.message}`);
          }
        }, { scriptText: expression, outputs: runtime.outputs });
        runtime.outputs[output_name] = result;
      }
    },
    get_current_url: async () => {
      const href = await runtime.page.evaluate<string>(executableJavaScript("return window.location.href"));
      const url = new URL(href);
      const urlData = {
        href: url.href,
        origin: url.origin,
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port,
        pathname: url.pathname,
        search: url.search,
        hash: url.hash,
        params: Object.fromEntries(url.searchParams.entries()),
        segments: url.pathname.split("/").filter(Boolean),
        base: url.origin + url.pathname,
      };
      if (!runtime.outputs.system || typeof runtime.outputs.system !== "object") {
        runtime.outputs.system = {};
      }
      (runtime.outputs.system as Record<string, unknown>).current_url = urlData;
    },
    read_text_file: async (action) => {
      const { path: filePath, output_name, encoding } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);
      const content = await fs.readFile(resolvedPath, { encoding: (encoding as "utf-8" | "base64") ?? "utf-8" });
      writeVariableValue(runtime.outputs, output_name, content);
    },
    parse_csv_excel: async (action) => {
      const { path: filePath, output_name, has_headers, delimiter } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);
      
      if (resolvedPath.endsWith(".xlsx") || resolvedPath.endsWith(".xls")) {
        throw new Error("Excel format (.xlsx/.xls) is not natively supported. Please convert to CSV.");
      }
      
      const content = await fs.readFile(resolvedPath, { encoding: "utf-8" });
      const parsed = parseCSV(content, delimiter ?? ",", has_headers);
      writeVariableValue(runtime.outputs, output_name, parsed);
    },
    write_csv_excel: async (action) => {
      const { path: filePath, source_name, mode, has_headers } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);

      if (resolvedPath.endsWith(".xlsx") || resolvedPath.endsWith(".xls")) {
        throw new Error("Excel format (.xlsx/.xls) is not natively supported. Please convert to CSV.");
      }

      const sourceVal = runtime.outputs[source_name];
      if (!Array.isArray(sourceVal)) {
        throw new Error(`Source variable "${source_name}" must be an array to write to CSV.`);
      }

      const csvContent = writeCSV(sourceVal, has_headers);
      
      await fs.mkdir(path.dirname(resolvedPath), { recursive: true });

      if (mode === "append") {
        await fs.appendFile(resolvedPath, csvContent, { encoding: "utf-8" });
      } else {
        await fs.writeFile(resolvedPath, csvContent, { encoding: "utf-8" });
      }
    },
    file_operation: async (action) => {
      const { operation, path: filePath, target_path, output_name } = action.config;
      const renderedPath = renderTemplate(filePath, runtime.outputs);
      const resolvedPath = path.isAbsolute(renderedPath)
        ? renderedPath
        : path.resolve(deps.appPaths.rootDir, renderedPath);

      if (operation === "exists") {
        let exists = false;
        try {
          await fs.access(resolvedPath);
          exists = true;
        } catch {
          // not exists
        }
        if (output_name) {
          writeVariableValue(runtime.outputs, output_name, exists);
        }
      } else if (operation === "delete") {
        await fs.rm(resolvedPath, { force: true, recursive: true });
      } else if (operation === "rename" || operation === "move") {
        if (!target_path) throw new Error("Target path is required for rename/move operations");
        const renderedTarget = renderTemplate(target_path, runtime.outputs);
        const resolvedTarget = path.isAbsolute(renderedTarget)
          ? renderedTarget
          : path.resolve(deps.appPaths.rootDir, renderedTarget);
        
        await fs.mkdir(path.dirname(resolvedTarget), { recursive: true });
        await fs.rename(resolvedPath, resolvedTarget);
        if (output_name) {
          writeVariableValue(runtime.outputs, output_name, resolvedTarget);
        }
      }
    },
    http_request: async (action) => {
      const { method, url: targetUrl, headers, body, content_type, output_name, timeout_ms } = action.config;
      const renderedUrl = renderTemplate(targetUrl, runtime.outputs);
      
      const requestHeaders: Record<string, string> = {};
      if (content_type) {
        requestHeaders["Content-Type"] = content_type;
      }
      if (headers) {
        for (const pair of headers) {
          requestHeaders[pair.name] = renderTemplate(pair.value, runtime.outputs);
        }
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout_ms ?? 30000);

      try {
        const fetchOptions: RequestInit = {
          method,
          headers: requestHeaders,
          signal: controller.signal,
        };

        if (body && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
          fetchOptions.body = renderTemplate(body, runtime.outputs);
        }

        const response = await fetch(renderedUrl, fetchOptions);
        clearTimeout(timeoutId);

        const responseText = await response.text();
        let parsedBody: any = responseText;
        try {
          parsedBody = JSON.parse(responseText);
        } catch {
          // keep as string
        }

        const result = {
          status: response.status,
          statusText: response.statusText,
          ok: response.ok,
          headers: Object.fromEntries(response.headers.entries()),
          body: parsedBody,
        };

        writeVariableValue(runtime.outputs, output_name, result);
      } catch (err: any) {
        clearTimeout(timeoutId);
        throw new Error(`HTTP Request failed: ${err.message}`);
      }
    },
    date_time_operation: async (action) => {
      const { operation, value, format_pattern, offset_value, offset_unit, output_name } = action.config;
      let date = new Date();
      if (value) {
        const renderedVal = renderTemplate(value, runtime.outputs);
        const parsedTime = Date.parse(renderedVal);
        if (!Number.isNaN(parsedTime)) {
          date = new Date(parsedTime);
        }
      }

      if (operation === "current_timestamp") {
        writeVariableValue(runtime.outputs, output_name, date.toISOString());
      } else if (operation === "format") {
        const pattern = format_pattern ?? "YYYY-MM-DD HH:mm:ss";
        writeVariableValue(runtime.outputs, output_name, formatDateTime(date, pattern));
      } else if (operation === "add_subtract") {
        const offset = offset_value ?? 0;
        if (offset_unit === "days") {
          date.setDate(date.getDate() + offset);
        } else if (offset_unit === "hours") {
          date.setHours(date.getHours() + offset);
        } else if (offset_unit === "minutes") {
          date.setMinutes(date.getMinutes() + offset);
        }
        writeVariableValue(runtime.outputs, output_name, date.toISOString());
      } else if (operation === "diff") {
        const val2 = format_pattern ? renderTemplate(format_pattern, runtime.outputs) : "";
        const parsedTime2 = Date.parse(val2);
        if (Number.isNaN(parsedTime2)) {
          throw new Error(`Second date value "${val2}" is invalid`);
        }
        const diffMs = date.getTime() - parsedTime2;
        writeVariableValue(runtime.outputs, output_name, diffMs);
      }
    },
    crypto_operation: async (action) => {
      const { operation, value, output_name } = action.config;
      const renderedVal = renderTemplate(value, runtime.outputs);
      
      let result = "";
      if (operation === "md5") {
        const { createHash } = await import("node:crypto");
        result = createHash("md5").update(renderedVal).digest("hex");
      } else if (operation === "sha256") {
        const { createHash } = await import("node:crypto");
        result = createHash("sha256").update(renderedVal).digest("hex");
      } else if (operation === "base64_encode") {
        result = Buffer.from(renderedVal, "utf-8").toString("base64");
      } else if (operation === "base64_decode") {
        result = Buffer.from(renderedVal, "base64").toString("utf-8");
      }

      writeVariableValue(runtime.outputs, output_name, result);
    },
    switch_frame: async (action) => {
      const iframeXpath = renderTemplate(action.config.iframe_xpath, runtime.outputs);
      runtime.activeFrameXpath = iframeXpath;
    },
    switch_to_parent_frame: async () => {
      runtime.activeFrameXpath = null;
    },
    quarantined: async () => {
      // No-op: quarantined nodes are skipped at compile time.
      // This executor exists only to satisfy the registry coverage assertion.
    },
  });
}

async function evaluateRuleGroup(group: any, runtime: RunnerActionRuntime): Promise<boolean> {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) {
    return true;
  }

  const results: boolean[] = [];
  for (const rule of group.rules) {
    if ("operator" in rule) {
      results.push(await evaluateRuleGroup(rule, runtime));
    } else {
      results.push(await evaluateSingleRule(rule, runtime));
    }
  }

  if (group.operator === "or") {
    return results.some(r => r === true);
  }
  return results.every(r => r === true);
}

async function evaluateSingleRule(rule: any, runtime: RunnerActionRuntime): Promise<boolean> {
  switch (rule.type) {
    case "value_compare": {
      const left = renderTemplate(rule.left_operand ?? "", runtime.outputs);
      const right = renderTemplate(rule.right_operand ?? "", runtime.outputs);

      switch (rule.comparison) {
        case "equals": return left === right;
        case "not_equals": return left !== right;
        case "contains": return left.includes(right);
        case "not_contains": return !left.includes(right);
        case "greater_than": return Number(left) > Number(right);
        case "less_than": return Number(left) < Number(right);
        case "greater_than_or_equals": return Number(left) >= Number(right);
        case "less_than_or_equals": return Number(left) <= Number(right);
        case "is_empty": return !left || left.trim() === "";
        case "is_not_empty": return left.trim() !== "";
        case "matches_regex": return new RegExp(right).test(left);
        default: return false;
      }
    }
    case "element_state": {
      let locator;
      if (rule.element_source === "ref") {
        if (!rule.target_ref) throw new Error("Target ref is required");
        const ref = runtime.elementRefs.get(rule.target_ref);
        if (!ref) throw new Error(`Element ref not found: ${rule.target_ref}`);
        locator = await locatorForRuntimeElementRef(runtime.page, ref);
      } else {
        locator = await locatorFor(runtime.page, null, rule.xpath || "body");
      }

      switch (rule.element_property) {
        case "visible": return locator.isVisible ? await locator.isVisible() : false;
        case "hidden": return locator.isVisible ? !(await locator.isVisible()) : true;
        case "enabled": return locator.isEnabled ? await locator.isEnabled() : false;
        case "disabled": return locator.isEnabled ? !(await locator.isEnabled()) : true;
        case "checked": return locator.evaluate ? await locator.evaluate((el) => (el as HTMLInputElement).checked) : false;
        case "unchecked": return locator.evaluate ? !(await locator.evaluate((el) => (el as HTMLInputElement).checked)) : true;
        default: return false;
      }
    }
    case "url_check": {
      const href = await runtime.page.evaluate(() => window.location.href);
      const val = rule.url_value ?? "";
      switch (rule.url_comparison) {
        case "contains": return href.includes(val);
        case "not_contains": return !href.includes(val);
        case "matches_regex": return new RegExp(val).test(href);
        default: return false;
      }
    }
    default:
      return false;
  }
}


function outputValueToText(value: unknown, separator = "\n"): string {
  if (Array.isArray(value)) {
    return value.map((item) => outputValueToText(item, separator)).join(separator);
  }
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

function outputValueToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => outputValueToText(item));
  if (value == null || value === "") return [];
  return [outputValueToText(value)];
}

function regexFromActionConfig(pattern: string, flags: string | null | undefined) {
  const normalizedFlags = normalizeRegexFlags(flags);
  try {
    return new RegExp(pattern, normalizedFlags);
  } catch {
    throw new Error("Regex pattern is invalid");
  }
}

function normalizeRegexFlags(flags: string | null | undefined) {
  const raw = flags?.trim() || "g";
  const uniqueFlags = Array.from(new Set(raw.split("")));
  if (!uniqueFlags.includes("g")) uniqueFlags.push("g");
  return uniqueFlags.join("");
}

function dedupeStrings(values: string[]) {
  const seen = new Set<string>();
  const deduped: string[] = [];
  for (const value of values) {
    if (!seen.has(value)) {
      seen.add(value);
      deduped.push(value);
    }
  }
  return deduped;
}

function parseCSV(content: string, delimiter = ",", hasHeaders = true): Array<Record<string, string>> | string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let entry = "";
  
  for (let i = 0; i < content.length; i++) {
    const char = content[i];
    const nextChar = content[i + 1];
    
    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          entry += '"';
          i++; // skip double quote
        } else {
          inQuotes = false;
        }
      } else {
        entry += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        row.push(entry.trim());
        entry = "";
      } else if (char === "\n" || char === "\r") {
        row.push(entry.trim());
        if (row.length > 0 && (row.length > 1 || row[0] !== "")) {
          lines.push(row);
        }
        row = [];
        entry = "";
        if (char === "\r" && nextChar === "\n") {
          i++; // skip LF
        }
      } else {
        entry += char;
      }
    }
  }
  
  if (entry || row.length > 0) {
    row.push(entry.trim());
    if (row.length > 0 && (row.length > 1 || row[0] !== "")) {
      lines.push(row);
    }
  }
  
  if (hasHeaders) {
    if (lines.length === 0) return [];
    const headers = lines[0];
    const result: Array<Record<string, string>> = [];
    for (let i = 1; i < lines.length; i++) {
      const obj: Record<string, string> = {};
      const currentRow = lines[i];
      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentRow[j] ?? "";
      }
      result.push(obj);
    }
    return result;
  }
  
  return lines;
}

function writeCSV(data: unknown[], hasHeaders = true): string {
  if (!Array.isArray(data) || data.length === 0) return "";
  const lines: string[] = [];
  
  const firstItem = data[0];
  const isObject = firstItem !== null && typeof firstItem === "object" && !Array.isArray(firstItem);
  
  if (isObject) {
    const headers = Object.keys(firstItem);
    if (hasHeaders) {
      lines.push(headers.map(h => `"${h.replace(/"/g, '""')}"`).join(","));
    }
    for (const item of data) {
      const row = headers.map(h => {
        const val = String((item as Record<string, any>)[h] ?? "");
        return `"${val.replace(/"/g, '""')}"`;
      });
      lines.push(row.join(","));
    }
  } else {
    for (const item of data) {
      if (Array.isArray(item)) {
        lines.push(item.map(val => `"${String(val ?? "").replace(/"/g, '""')}"`).join(","));
      } else {
        lines.push(`"${String(item ?? "").replace(/"/g, '""')}"`);
      }
    }
  }
  
  return lines.join("\n") + "\n";
}

function formatDateTime(date: Date, pattern: string): string {
  const pad = (num: number) => String(num).padStart(2, "0");
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const min = pad(date.getMinutes());
  const ss = pad(date.getSeconds());
  
  return pattern
    .replace("YYYY", String(yyyy))
    .replace("MM", mm)
    .replace("DD", dd)
    .replace("HH", hh)
    .replace("mm", min)
    .replace("ss", ss);
}
