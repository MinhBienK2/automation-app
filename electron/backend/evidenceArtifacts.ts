import path from "node:path";

export type EvidenceArtifactInput = {
  evidenceDir: string;
  runId: string;
  kind: "screenshots" | "downloads";
  stepNumber: number | null;
  nodeId: string | null;
  requestedName: string | null | undefined;
  fallbackName: string;
  extension: string;
};

export function sanitizePathSegment(value: string) {
  return value.trim().replace(/[^a-zA-Z0-9._-]+/g, "-") || "default";
}

export function resolveEvidenceArtifact(input: EvidenceArtifactInput) {
  const artifactName = safeArtifactName(input.requestedName, input.fallbackName);
  const stepPart = String(input.stepNumber ?? 0).padStart(3, "0");
  const nodePart = slugifyArtifactPart(input.nodeId ?? "workflow");
  const fileName = `${stepPart}-${nodePart}-${artifactName}${safeArtifactExtension(input.extension)}`;
  const runPart = sanitizePathSegment(input.runId);
  const relativePath = path.posix.join("runs", runPart, input.kind, fileName);
  const absolutePath = path.join(input.evidenceDir, relativePath);
  const relativeToEvidence = path.relative(input.evidenceDir, absolutePath);
  if (
    relativeToEvidence.startsWith("..") ||
    path.isAbsolute(relativeToEvidence)
  ) {
    throw new Error("Evidence path resolved outside the app evidence directory");
  }
  return { relativePath, absolutePath };
}

function safeArtifactExtension(extension: string) {
  const normalized = extension.trim().toLowerCase();
  return /^\.[a-z0-9]{1,12}$/.test(normalized) ? normalized : ".artifact";
}

function safeArtifactName(value: string | null | undefined, fallbackName: string) {
  const raw = value?.trim() || fallbackName;
  if (
    !raw ||
    /^file:/i.test(raw) ||
    path.isAbsolute(raw) ||
    raw.includes("/") ||
    raw.includes("\\") ||
    raw.split(/[\\/]+/).includes("..")
  ) {
    throw new Error("Screenshot path must be a safe artifact name");
  }
  const parsed = path.parse(raw);
  if (parsed.dir || parsed.base === ".." || parsed.name === "..") {
    throw new Error("Screenshot path must be a safe artifact name");
  }
  const slug = slugifyArtifactPart(parsed.name || fallbackName);
  if (!slug) throw new Error("Screenshot path must be a safe artifact name");
  return slug.endsWith(".png") ? slug.slice(0, -4) : slug;
}

function slugifyArtifactPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/\.[a-z0-9]{1,8}$/i, "")
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "artifact";
}
