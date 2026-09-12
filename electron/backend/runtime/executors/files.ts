import fs from "node:fs/promises";
import path from "node:path";
import type { ActionExecutorMap } from "../../actions/execution.js";
import type { RunnerActionExecutorDependencies, RunnerActionRuntime } from "./types.js";
import { resolveEvidenceArtifact } from "../../evidence/artifacts.js";
import { outputValueToText, parseCSV, writeCSV } from "./dataFormat.js";
import { renderTemplate, writeVariableValue } from "../variables.js";

export function buildFilesExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): Partial<ActionExecutorMap> {
  return {
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
