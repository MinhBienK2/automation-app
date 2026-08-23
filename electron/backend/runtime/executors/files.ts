import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import fs from "node:fs/promises";
import path from "node:path";
import { renderTemplate, writeVariableValue } from "../variables.js";
import { outputValueToText } from "./support.js";
import { resolveEvidenceArtifact } from "../../evidence/artifacts.js";

export type FilesExecutors = Pick<
  ActionExecutorMap,
  | "read_text_file" | "write_text_file" | "parse_csv_excel" | "write_csv_excel"
  | "file_operation" | "http_request" | "date_time_operation" | "crypto_operation"
>;

export function createFilesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): FilesExecutors {
  return {
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
  };
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
