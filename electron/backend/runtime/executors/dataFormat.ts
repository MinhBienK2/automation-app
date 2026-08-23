/**
 * Pure data-formatting helpers shared by the capture and variables executor
 * groups. No runtime or dependency access — every function here is a plain
 * transformation over its arguments.
 */

export function outputValueToText(value: unknown, separator = "\n"): string {
  if (Array.isArray(value)) {
    return value.map((item) => outputValueToText(item, separator)).join(separator);
  }
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value, null, 2);
}

export function outputValueToList(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => outputValueToText(item));
  if (value == null || value === "") return [];
  return [outputValueToText(value)];
}

export function regexFromActionConfig(pattern: string, flags: string | null | undefined) {
  const normalizedFlags = normalizeRegexFlags(flags);
  try {
    return new RegExp(pattern, normalizedFlags);
  } catch {
    throw new Error("Regex pattern is invalid");
  }
}

export function normalizeRegexFlags(flags: string | null | undefined) {
  const raw = flags?.trim() || "g";
  const uniqueFlags = Array.from(new Set(raw.split("")));
  if (!uniqueFlags.includes("g")) uniqueFlags.push("g");
  return uniqueFlags.join("");
}

export function dedupeStrings(values: string[]) {
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

export function parseCSV(content: string, delimiter = ",", hasHeaders = true): Array<Record<string, string>> | string[][] {
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

export function writeCSV(data: unknown[], hasHeaders = true): string {
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

export function formatDateTime(date: Date, pattern: string): string {
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
