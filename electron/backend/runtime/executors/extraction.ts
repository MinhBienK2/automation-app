import { createExtractionTableExecutors } from "./extraction-tables.js";
import { createExtractionDomExecutors } from "./extraction-dom.js";
import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveEvidenceArtifact } from "../../evidence/artifacts.js";
import {
  assertElementState,
  assertRuntimeEnumValue,
  executableJavaScript,
  requireLocatorMethod,
} from "../runtimeHelpers.js";
import { outputValueToList, outputValueToText } from "./support.js";

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

export type ExtractionExecutors = Pick<
  ActionExecutorMap,
  | "extract_text" | "extract_attribute" | "extract_input_value" | "extract_list" | "count_elements" | "extract_regex_matches"
  | "extract_text_content" | "extract_inner_html" | "extract_outer_html" | "extract_computed_style" | "extract_all_attributes" | "extract_data_attributes"
  | "extract_class_list" | "extract_descendant_attributes" | "extract_select_value" | "extract_select_options" | "extract_checkbox_state" | "extract_form_data"
  | "extract_table" | "extract_table_headers" | "extract_table_row" | "extract_table_column" | "extract_table_cell" | "extract_list_attributes"
  | "extract_structured_list" | "check_element_exists" | "get_page_title"
  | "get_meta_content" | "extract_page_links" | "extract_numbers" | "extract_urls" | "extract_emails" | "take_screenshot"
  | "get_current_url" | "assert_element" | "assert_text"
  | "extract_dimensions" | "extract_visibility" | "extract_element_state"
>;

export function createExtractionExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): ExtractionExecutors {
  return {
    ...createExtractionTableExecutors(runtime, deps),
    ...createExtractionDomExecutors(runtime, deps),
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
    ...createExtractionDomExecutors(runtime, deps),
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
  };
}

