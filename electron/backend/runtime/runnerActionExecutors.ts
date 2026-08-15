import fs from "node:fs/promises";
import path from "node:path";
import {
  createActionExecutorMap,
  type ActionExecutorMap,
} from "../actions/execution.js";
import { createDataActionExecutors } from "./dataActionExecutors.js";
import type {
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "./actionRuntime.js";
import { resolveEvidenceArtifact } from "../features/evidence/artifacts.js";
import { isPlainRecord } from "../shared/records.js";
import { locatorFor, locatorForRuntimeElementRef } from "./targetResolver.js";
import { requireWebSurface } from "./surface.js";
import { createDesktopActionExecutors } from "../surfaces/desktop/executors/index.js";
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
  renderTemplate,
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
  withActionTimeout,
} from "./runtimeHelpers.js";
import {
  outputValueToText,
} from "./actionValueHelpers.js";


export type {
  ActionTargetConfig,
  DataActionDependencies,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
  VariableScope,
} from "./actionRuntime.js";

export function createRunnerActionExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): ActionExecutorMap {
  // Narrowed once, here. Every entry below is a web action, so none of them
  // branches on the surface again.
  const web = requireWebSurface(runtime.surface);
  // The desktop family is registered so the registry stays complete and a
  // missing executor stays a build failure. Its entries narrow to the desktop
  // surface themselves and throw if a desktop step is reached in a web run,
  // which the compiler cannot prevent until a workflow carries its surface.
  const desktopFamily = createDesktopActionExecutorsLazily(runtime);

  return createActionExecutorMap({
    ...desktopFamily,
    // Data-only and flow-control actions come from a module that cannot
    // reach a page: `createDataActionExecutors` takes a `VariableScope`.
    ...createDataActionExecutors(runtime, deps),
    // These read like data actions and are not: their rule groups can address
    // elements, so evaluating one may resolve a locator against the page.
    paste_clipboard: async (action) => {
      await deps.executePasteClipboard(runtime, action);
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
    navigate: async (action) => {
      const url = renderTemplate(action.config.url, runtime.outputs);
      await deps.enforceNavigationPolicy(runtime, url);
      await web.page.goto(url, {
        waitUntil: waitUntil(action.config.wait_until),
        timeout: action.config.timeout_ms ?? undefined,
      });
    },
    wait: async (action) => {
      await deps.executeWait(runtime, action);
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
        web.page,
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
      await deps.pressKeyHuman(web.page, action.config.key, runtime.signal);
    },
    hotkey: async (action) => {
      await deps.pressHotkeyHuman(web.page, action.config.keys, runtime.signal);
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
        await deps.pressKeyHuman(web.page, "Enter", runtime.signal);
      }
    },
    select_custom_option: async (action) => {
      await (await deps.locatorForCustomSelectTrigger(runtime, action)).click();
      await web.page.locator(`text=${action.config.option_text}`).click();
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
      runtime.outputs[action.config.output_name] = await web.page.evaluate(() => document.title);
    },
    get_meta_content: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await web.page.evaluate((metaName) => {
          const meta = document.querySelector(`meta[name="${metaName}"], meta[property="${metaName}"]`);
          return meta ? meta.getAttribute("content") : null;
        }, action.config.meta_name)) ?? null;
    },
    extract_page_links: async (action) => {
      runtime.outputs[action.config.output_name] =
        (await web.page.evaluate(() => {
          return Array.from(document.querySelectorAll("a")).map((a: any) => ({
            text: a.textContent?.trim() || "",
            href: a.href || "",
            rel: a.rel || "",
          }));
        })) ?? [];
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
      const buffer = await web.page.screenshot?.({ fullPage: action.config.full_page });
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
      await web.page.goBack?.();
    },
    go_forward: async () => {
      await web.page.goForward?.();
    },
    reload: async () => {
      await web.page.reload?.();
    },
    open_new_tab: async (action) => {
      web.page = await web.context.newPage();
      if (action.config.url) {
        const url = renderTemplate(action.config.url, runtime.outputs);
        await deps.enforceNavigationPolicy(runtime, url);
        await web.page.goto(url);
      }
    },
    open_link_in_new_tab: async (action) => {
      const timeout = action.config.timeout_ms ?? 30000;
      const locator = await deps.locatorForAction(runtime, action.config);

      if (!web.context.waitForEvent) {
        throw new Error("Browser context does not support waitForEvent");
      }

      // Check if it's an <a> tag with a valid navigation href
      let href: string | null = null;
      try {
        if (locator.waitFor) {
          await locator.waitFor({ state: "attached", timeout });
        }
        if (locator.evaluate) {
          href = await locator.evaluate((el) => {
            if (el.tagName.toLowerCase() === "a") {
              const rawHref = el.getAttribute("href");
              const resolvedHref = (el as HTMLAnchorElement).href;
              // The http/https check below is what actually makes this safe, but
              // a scheme list that names `javascript:` without `data:` and
              // `vbscript:` reads as an incomplete guard — to a reviewer and to
              // CodeQL alike. Name all three so the intent survives an edit.
              const scheme = rawHref?.trim().toLowerCase() ?? "";
              if (
                rawHref &&
                rawHref !== "#" &&
                !scheme.startsWith("javascript:") &&
                !scheme.startsWith("data:") &&
                !scheme.startsWith("vbscript:") &&
                !scheme.startsWith("mailto:") &&
                !scheme.startsWith("tel:")
              ) {
                if (resolvedHref && (resolvedHref.startsWith("http:") || resolvedHref.startsWith("https:"))) {
                  return resolvedHref;
                }
              }
            }
            return null;
          });
        }
      } catch (err) {
        // Fallback to clicking if evaluation fails
      }

      if (href) {
        await deps.enforceNavigationPolicy(runtime, href);
        const newPage = await web.context.newPage();
        await newPage.goto(href, { timeout, waitUntil: "load" });
        web.page = newPage;
        await web.page.bringToFront?.();
      } else {
        const [newPage] = await Promise.all([
          web.context.waitForEvent("page", { timeout }),
          locator.click({ timeout }),
        ]);
        web.page = newPage;
        await web.page.bringToFront?.();
      }
    },
    switch_tab: async (action) => {
      const page = web.context.pages()[action.config.index];
      if (!page) throw new Error(`Tab index ${action.config.index} does not exist`);
      web.page = page;
      await web.page.bringToFront?.();
    },
    close_tab: async (action) => {
      const pageIndex = action.config.index ?? web.context.pages().length - 1;
      const page = web.context.pages()[pageIndex];
      if (!page) throw new Error(`Tab index ${pageIndex} does not exist`);
      await page.close?.();
      web.page = web.context.pages()[0] ?? (await web.context.newPage());
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
    execute_list_script: async (action) => {
      const { source, script, output_name } = action.config;
      if (!output_name) return;
      const array = runtime.outputs[source];
      if (!Array.isArray(array)) {
        throw new Error(`Source variable "${source}" is not an array.`);
      }
      if (!script) throw new Error("Script is required");
      
      const result = await web.page.evaluate((args) => {
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
    execute_object_script: async (action) => {
      const { source, script, output_name } = action.config;
      if (!output_name) return;
      const existing = runtime.outputs[source];
      if (!isPlainRecord(existing)) {
        throw new Error(`Source variable "${source}" is not an object.`);
      }
      if (!script) throw new Error("Script is required");
      
      const result = await web.page.evaluate((args) => {
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
    domain_allowlist: async (action) => {
      const hostname = await currentPageHostname(web.page);
      if (!hostname || !hostnameAllowed(hostname, action.config.domains)) {
        throw new Error(
          `Current domain ${hostname ?? "unknown"} is not in the allowlist`,
        );
      }
      runtime.outputs.domain_allowlist = action.config.domains;
    },
    set_viewport: async (action) => {
      await web.page.setViewportSize?.({
        width: action.config.width,
        height: action.config.height,
      });
      runtime.outputs.last_set_viewport = action.config;
    },
    set_geolocation: async (action) => {
      await web.context.setGeolocation?.(action.config);
      runtime.outputs.last_set_geolocation = action.config;
    },
    set_extra_headers: async (action) => {
      await web.context.setExtraHTTPHeaders?.(
        Object.fromEntries(
          action.config.headers.map((header) => [header.name, header.value]),
        ),
      );
      runtime.outputs.last_set_extra_headers = action.config;
    },
    grant_permission: async (action) => {
      await web.context.grantPermissions?.(
        action.config.permissions,
        action.config.origin ? { origin: action.config.origin } : undefined,
      );
      runtime.outputs.last_grant_permission = action.config;
    },
    set_cookie: async (action) => {
      const domain = action.config.domain?.trim() || await currentPageHostname(web.page);
      if (!domain) {
        throw new Error("Set cookie requires a current page host when Domain is blank");
      }
      await web.context.addCookies?.([
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
      await web.context.clearCookies?.(
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
          web.page.evaluate(executableJavaScript(action.config.script)),
          action.config.timeout_ms,
          (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
        );
      } else {
        await withActionTimeout(
          web.page.evaluate(executableJavaScript(action.config.script)),
          action.config.timeout_ms,
          (timeoutMs) => `Execute JavaScript timed out after ${timeoutMs} ms`,
        );
      }
    },
    wait_for_request: async (action) => {
      runtime.outputs.last_request_url = (
        await web.page.waitForRequest?.(
          (request) => request.url().includes(action.config.url_contains),
          { timeout: action.config.timeout_ms ?? undefined },
        )
      )?.url();
    },
    wait_for_response: async (action) => {
      const response = await web.page.waitForResponse?.(
        (candidate) =>
          candidate.url().includes(action.config.url_contains) &&
          (!action.config.status || candidate.status() === action.config.status),
        { timeout: action.config.timeout_ms ?? undefined },
      );
      runtime.outputs.last_response_url = response?.url();
    },
    block_request: async (action) => {
      for (const pattern of action.config.url_patterns) {
        await web.context.route?.(pattern, async (route) => route.abort());
      }
    },
    mock_response: async (action) => {
      await web.context.route?.(
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
      await setWebStorage(web.page, "local", action.config.key, action.config.value);
      runtime.outputs[action.config.key] = action.config.value;
    },
    set_session_storage: async (action) => {
      await setWebStorage(web.page, "session", action.config.key, action.config.value);
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
              const result = await web.page.evaluate((args) => {
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
          const result = await web.page.evaluate((args) => {
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
            const result = await web.page.evaluate((args) => {
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
        const result = await web.page.evaluate((args) => {
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
      const href = await web.page.evaluate<string>(executableJavaScript("return window.location.href"));
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
    switch_frame: async (action) => {
      const iframeXpath = renderTemplate(action.config.iframe_xpath, runtime.outputs);
      web.activeFrameXpath = iframeXpath;
    },
    switch_to_parent_frame: async () => {
      web.activeFrameXpath = null;
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
  const web = requireWebSurface(runtime.surface);
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
        locator = await locatorForRuntimeElementRef(web.page, ref);
      } else {
        locator = await locatorFor(web.page, null, rule.xpath || "body");
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
      const href = await web.page.evaluate(() => window.location.href);
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

/**
 * Desktop executors bound lazily.
 *
 * `createDesktopActionExecutors` narrows to the desktop surface at its entry,
 * which would throw the moment a web run built its executor map. So the
 * narrowing is deferred to the call: a web run that never dispatches a desktop
 * action never pays for it, and one that does gets the honest error.
 */
function createDesktopActionExecutorsLazily<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
) {
  const lazy = <K extends keyof ReturnType<typeof createDesktopActionExecutors>>(
    key: K,
  ): ActionExecutorMap[K & keyof ActionExecutorMap] =>
    (async (action: never) => {
      const family = createDesktopActionExecutors(runtime);
      await (family[key] as (a: never) => Promise<void>)(action);
    }) as ActionExecutorMap[K & keyof ActionExecutorMap];

  return {
    desktop_click: lazy("desktop_click"),
    desktop_set_value: lazy("desktop_set_value"),
    desktop_type_text: lazy("desktop_type_text"),
    desktop_press_key: lazy("desktop_press_key"),
    desktop_hotkey: lazy("desktop_hotkey"),
    desktop_read_text: lazy("desktop_read_text"),
    desktop_wait_for: lazy("desktop_wait_for"),
    desktop_screenshot: lazy("desktop_screenshot"),
    desktop_focus_window: lazy("desktop_focus_window"),
    desktop_invoke_menu: lazy("desktop_invoke_menu"),
  };
}
