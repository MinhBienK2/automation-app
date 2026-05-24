export type EvidenceCategory =
  | "operator_input"
  | "browser_identity"
  | "network_posture"
  | "action_trace"
  | "page_observation"
  | "generated_output"
  | "sensitive_redacted";

export type EvidenceOutputManifest = {
  schema_version: 1;
  categories: EvidenceCategory[];
  outputs: Array<{
    key: string;
    category: EvidenceCategory;
    bytes: number;
    redacted: boolean;
    truncated: boolean;
  }>;
};

const evidenceCategories: EvidenceCategory[] = [
  "operator_input",
  "browser_identity",
  "network_posture",
  "action_trace",
  "page_observation",
  "generated_output",
  "sensitive_redacted",
];

const maxStringLength = 4096;
const maxArrayItems = 100;
const maxObjectKeys = 100;
const maxDepth = 8;
const redactedValue = "[REDACTED]";
const sensitiveKeyPattern =
  /(^|[_-])(token|cookie|password|authorization|auth|headers?|ip|account|email|secret|credential)(s)?($|[_-])/i;

export function finalizeEvidenceOutputs(outputs: Record<string, unknown>) {
  const finalized: Record<string, unknown> = {};
  const manifest: EvidenceOutputManifest = {
    schema_version: 1,
    categories: evidenceCategories,
    outputs: [],
  };

  for (const [key, value] of Object.entries(outputs)) {
    if (key === "__evidence_model") continue;
    const category = evidenceCategoryForOutput(key);
    const normalized = normalizeEvidenceValue(value, {
      category,
      key,
      depth: 0,
      preserveStructure:
        category === "action_trace" ||
        category === "browser_identity" ||
        category === "network_posture" ||
        category === "generated_output",
    });
    finalized[key] = normalized.value;
    manifest.outputs.push({
      key,
      category,
      bytes: jsonSize(normalized.value),
      redacted: normalized.redacted,
      truncated: normalized.truncated,
    });
  }

  finalized.__evidence_model = manifest;
  return finalized;
}

export function evidenceCategoryForOutput(key: string): EvidenceCategory {
  if (key === "browser_identity") return "browser_identity";
  if (key === "fingerprint_preflight" || key === "fingerprint_regression") {
    return "network_posture";
  }
  if (key === "__action_traces") return "action_trace";
  if (
    key === "__evidence" ||
    key.includes("screenshot") ||
    key.includes("download") ||
    key.endsWith("_path")
  ) {
    return "generated_output";
  }
  if (isSensitiveEvidenceKey(key)) return "sensitive_redacted";
  if (key.startsWith("input_") || key.startsWith("operator_")) return "operator_input";
  return "page_observation";
}

function normalizeEvidenceValue(
  value: unknown,
  options: {
    category: EvidenceCategory;
    key: string;
    depth: number;
    preserveStructure: boolean;
  },
): { value: unknown; redacted: boolean; truncated: boolean } {
  if (options.category === "sensitive_redacted" || isSensitiveEvidenceKey(options.key)) {
    return { value: redactedValue, redacted: true, truncated: false };
  }

  if (options.preserveStructure) {
    return { value, redacted: false, truncated: false };
  }

  if (typeof value === "string") {
    if (value.length > maxStringLength) {
      return {
        value: `${value.slice(0, maxStringLength)}[TRUNCATED ${value.length - maxStringLength} chars]`,
        redacted: false,
        truncated: true,
      };
    }
    return { value, redacted: false, truncated: false };
  }

  if (Array.isArray(value)) {
    if (options.depth >= maxDepth) {
      return { value: "[TRUNCATED depth]", redacted: false, truncated: true };
    }
    const keptItems = value.slice(0, maxArrayItems);
    let redacted = false;
    let truncated = value.length > maxArrayItems;
    const normalizedItems = keptItems.map((item) => {
      const normalized = normalizeEvidenceValue(item, {
        ...options,
        key: "",
        depth: options.depth + 1,
      });
      redacted ||= normalized.redacted;
      truncated ||= normalized.truncated;
      return normalized.value;
    });
    if (value.length > maxArrayItems) {
      normalizedItems.push(`[TRUNCATED ${value.length - maxArrayItems} items]`);
    }
    return { value: normalizedItems, redacted, truncated };
  }

  if (isPlainRecord(value)) {
    if (options.depth >= maxDepth) {
      return { value: "[TRUNCATED depth]", redacted: false, truncated: true };
    }
    const entries = Object.entries(value);
    const keptEntries = entries.slice(0, maxObjectKeys);
    let redacted = false;
    let truncated = entries.length > maxObjectKeys;
    const normalizedObject: Record<string, unknown> = {};
    for (const [entryKey, entryValue] of keptEntries) {
      const normalized = normalizeEvidenceValue(entryValue, {
        ...options,
        key: entryKey,
        depth: options.depth + 1,
      });
      redacted ||= normalized.redacted;
      truncated ||= normalized.truncated;
      normalizedObject[entryKey] = normalized.value;
    }
    if (entries.length > maxObjectKeys) {
      normalizedObject.__truncated_keys = entries.length - maxObjectKeys;
    }
    return { value: normalizedObject, redacted, truncated };
  }

  return { value, redacted: false, truncated: false };
}

function isSensitiveEvidenceKey(key: string) {
  const normalized = key.replace(/([a-z])([A-Z])/g, "$1_$2");
  return sensitiveKeyPattern.test(normalized);
}

function jsonSize(value: unknown) {
  try {
    return Buffer.byteLength(JSON.stringify(value));
  } catch {
    return 0;
  }
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
