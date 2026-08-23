import type {
  ActionExecutorMap,
  RunnerActionExecutorDependencies,
  RunnerActionRuntime,
} from "../runnerActionExecutors.js";
import { extractTable, requireLocatorMethod } from "../runtimeHelpers.js";

export type ExtractionTableExecutors = Pick<
  ActionExecutorMap,
  | "extract_table" | "extract_table_headers" | "extract_table_row" | "extract_table_column"
  | "extract_table_cell"
>;

export function createExtractionTableExecutors<Runtime extends RunnerActionRuntime>(
  runtime: Runtime,
  deps: RunnerActionExecutorDependencies<Runtime>,
): ExtractionTableExecutors {
  return {
    extract_table: async (action) => {
      runtime.outputs[action.config.output_name] = await extractTable(
        await deps.locatorForAction(runtime, action.config),
      );
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
