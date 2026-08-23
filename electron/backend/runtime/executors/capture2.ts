import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import fs from "node:fs/promises";
import path from "node:path";
import { assertElementState, assertRuntimeEnumValue, executableJavaScript, requireLocatorMethod } from "../runtimeHelpers.js";
import { outputValueToText, parseCSV, writeCSV } from "./dataFormat.js";
import { renderTemplate, writeVariableValue } from "../variables.js";
import { resolveEvidenceArtifact } from "../../evidence/artifacts.js";

export function buildCapture2Executors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
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
wait_for_download: async (action) => {
      const artifactPath = await deps.waitForDownload(runtime, action.config.output_name, action.config.timeout_ms);
      runtime.outputs[action.config.output_name] = artifactPath;
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
  };
}
