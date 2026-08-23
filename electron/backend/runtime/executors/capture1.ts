import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { dedupeStrings, outputValueToList, outputValueToText, regexFromActionConfig } from "./dataFormat.js";
import { extractTable, requireLocatorMethod } from "../runtimeHelpers.js";

export function buildCapture1Executors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
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
  };
}
