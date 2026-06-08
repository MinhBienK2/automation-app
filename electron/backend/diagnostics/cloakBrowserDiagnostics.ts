import fs from "node:fs/promises";
import nodeFs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import type {
  BrowserProfileDiagnostics,
  CloakBrowserDiagnostics,
  WorkflowSettings,
  WorkflowSummary,
} from "../../../src/types/workflow.js";
import type { AppPaths } from "../persistence/database.js";

const nodeRequire = createRequire(import.meta.url);

type CloakBrowserDiagnosticsModule = {
  binaryInfo: () => {
    version?: string;
    platform?: string;
    binaryPath?: string;
    installed?: boolean;
    cacheDir?: string;
    downloadUrl?: string;
  };
  ensureBinary: () => Promise<string>;
};

export function isOptionalModuleAvailable(name: string) {
  try {
    nodeRequire.resolve(name);
    return true;
  } catch {
    return false;
  }
}

export function directoryReadable(value: string) {
  try {
    const stat = nodeFs.statSync(value);
    if (!stat.isDirectory()) return false;
    nodeFs.accessSync(value, nodeFs.constants.R_OK);
    return true;
  } catch {
    return false;
  }
}

export function resolveDefaultFingerprintFontsDir(
  override: string | null | (() => string | null) | undefined,
) {
  if (typeof override === "function") return override();
  if (override !== undefined) return override;
  const candidate = path.join(process.cwd(), ".local", "cloakbrowser-fonts", "linux");
  return directoryReadable(candidate) ? candidate : null;
}

export async function buildCloakBrowserDiagnostics({
  appPaths,
  workflows,
  settingsForWorkflow,
  lastRunAtForWorkflow,
  retainedProfileNames,
}: {
  appPaths: AppPaths;
  workflows: WorkflowSummary[];
  settingsForWorkflow: (workflowId: string) => WorkflowSettings;
  lastRunAtForWorkflow: (workflowId: string) => string | null;
  retainedProfileNames: Set<string>;
}): Promise<CloakBrowserDiagnostics> {
  const binary = await cloakBinaryInfo();
  const identityByProfileDir = new Map<
    string,
    Pick<
      BrowserProfileDiagnostics,
      "identity_id" | "display_name" | "workflow_id" | "workflow_name" | "last_run_at"
    >
  >();
  const fontDirectoryWorkflows = new Map<
    string,
    Array<{ workflow_id: string; workflow_name: string; identity_id: string }>
  >();
  for (const workflow of workflows) {
    const settings = settingsForWorkflow(workflow.id);
    const profileDir = settings.browser_launch.profile_dir?.trim();
    if (!profileDir) continue;
    identityByProfileDir.set(profileDir, {
      identity_id: settings.browser_launch.identity_id,
      display_name: settings.browser_launch.display_name,
      workflow_id: workflow.id,
      workflow_name: workflow.name,
      last_run_at: lastRunAtForWorkflow(workflow.id),
    });
    const fontsDir = settings.browser_launch.fingerprint_fonts_dir?.trim();
    if (fontsDir) {
      const existing = fontDirectoryWorkflows.get(fontsDir) ?? [];
      existing.push({
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        identity_id: settings.browser_launch.identity_id,
      });
      fontDirectoryWorkflows.set(fontsDir, existing);
    }
  }

  return {
    wrapper_version: await cloakWrapperVersion(),
    binary,
    auto_update_enabled: process.env.CLOAKBROWSER_AUTO_UPDATE !== "false",
    checksum_skip_enabled: process.env.CLOAKBROWSER_SKIP_CHECKSUM === "true",
    geoip_available: isOptionalModuleAvailable("mmdb-lib"),
    profile_root: appPaths.browserProfilesDir,
    font_checklist: fingerprintFontChecklist(fontDirectoryWorkflows),
    last_smoke_result: {
      status: "not_recorded",
      reason: "Smoke tests are recorded by the npm run test:smoke command output",
    },
    headed_display: headedDisplayAvailability(),
    profiles: await browserProfileDiagnostics(
      appPaths.browserProfilesDir,
      identityByProfileDir,
      retainedProfileNames,
    ),
  };
}

const expectedFontFamilies = [
  { id: "arial", label: "arial" },
  { id: "courier", label: "courier" },
  { id: "notosans", label: "noto" },
];

export function fingerprintFontChecklist(
  fontDirectoryWorkflows: Map<
    string,
    Array<{ workflow_id: string; workflow_name: string; identity_id: string }>
  >,
): CloakBrowserDiagnostics["font_checklist"] {
  if (fontDirectoryWorkflows.size === 0) {
    return {
      status: "not_configured",
      reason: "No workflow has a fingerprint fonts directory configured",
      directories: [],
    };
  }
  const directories = [...fontDirectoryWorkflows.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([fontPath, workflows]) => inspectFingerprintFontDirectory(fontPath, workflows));
  const status = directories.some((directory) => directory.status === "missing")
    ? "error"
    : directories.some((directory) => directory.status === "warning")
      ? "warning"
      : "ok";
  const reason = status === "ok"
    ? null
    : directories
        .filter((directory) => directory.reason)
        .map((directory) => `${directory.path}: ${directory.reason}`)
        .join("; ");
  return { status, reason, directories };
}

function inspectFingerprintFontDirectory(
  fontPath: string,
  workflows: Array<{ workflow_id: string; workflow_name: string; identity_id: string }>,
): CloakBrowserDiagnostics["font_checklist"]["directories"][number] {
  const base = {
    path: fontPath,
    file_count: 0,
    total_size_bytes: 0,
    normalized_hash: null,
    expected_families_present: [] as string[],
    missing_expected_families: expectedFontFamilies.map((family) => family.label),
    workflow_ids: workflows.map((workflow) => workflow.workflow_id).sort(),
    workflow_names: workflows.map((workflow) => workflow.workflow_name).sort(),
  };
  if (!directoryReadable(fontPath)) {
    return {
      ...base,
      status: "missing",
      reason: "Font directory is missing or not readable",
    };
  }

  const files = listFingerprintFontFiles(fontPath);
  const normalizedHash = createHash("sha256");
  let totalSize = 0;
  const normalizedNames = files.map((file) => normalizeFontFileName(file.relativePath));
  for (const file of files) {
    totalSize += file.size;
    normalizedHash.update(file.relativePath.toLowerCase());
    normalizedHash.update("\0");
    normalizedHash.update(file.contentHash);
    normalizedHash.update("\0");
  }
  const present = expectedFontFamilies
    .filter((family) => normalizedNames.some((name) => name.includes(family.id)))
    .map((family) => family.label);
  const missing = expectedFontFamilies
    .filter((family) => !present.includes(family.label))
    .map((family) => family.label);
  const reasons = [
    workflows.length > 1 ? "Font directory is shared by multiple workflow identities" : null,
    files.length === 0 ? "No font files were found" : null,
    missing.length > 0 ? `Missing expected font families: ${missing.join(", ")}` : null,
  ].filter((reason): reason is string => Boolean(reason));
  return {
    ...base,
    status: reasons.length > 0 ? "warning" : "ok",
    reason: reasons.join("; ") || null,
    file_count: files.length,
    total_size_bytes: totalSize,
    normalized_hash: normalizedHash.digest("hex"),
    expected_families_present: present,
    missing_expected_families: missing,
  };
}

function listFingerprintFontFiles(rootDir: string) {
  const files: Array<{ relativePath: string; size: number; contentHash: string }> = [];
  const visit = (currentDir: string) => {
    for (const entry of nodeFs.readdirSync(currentDir, { withFileTypes: true })) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !isFontFile(entry.name)) continue;
      const stat = nodeFs.statSync(absolutePath);
      const content = nodeFs.readFileSync(absolutePath);
      files.push({
        relativePath: path.relative(rootDir, absolutePath).split(path.sep).join("/"),
        size: stat.size,
        contentHash: createHash("sha256").update(content).digest("hex"),
      });
    }
  };
  visit(rootDir);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

function isFontFile(name: string) {
  return /\.(ttf|otf|woff|woff2)$/i.test(name);
}

function normalizeFontFileName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

async function cloakBinaryInfo(): Promise<CloakBrowserDiagnostics["binary"]> {
  try {
    const cloakbrowser = await loadCloakBrowserDiagnosticsModule();
    const info = cloakbrowser.binaryInfo();
    return {
      version: info.version ?? null,
      platform: info.platform ?? null,
      installed: Boolean(info.installed),
      binary_path: info.binaryPath ?? null,
      cache_dir: info.cacheDir ?? null,
      download_url: info.downloadUrl ?? null,
    };
  } catch {
    return {
      version: null,
      platform: process.platform,
      installed: false,
      binary_path: process.env.CLOAKBROWSER_BINARY_PATH ?? null,
      cache_dir: process.env.CLOAKBROWSER_CACHE_DIR ?? null,
      download_url: process.env.CLOAKBROWSER_DOWNLOAD_URL ?? null,
    };
  }
}

export async function loadCloakBrowserDiagnosticsModule(): Promise<CloakBrowserDiagnosticsModule> {
  return (await import("cloakbrowser")) as unknown as CloakBrowserDiagnosticsModule;
}

async function cloakWrapperVersion() {
  let currentDir = process.cwd();
  while (true) {
    try {
      const packageJson = await fs.readFile(
        path.join(currentDir, "node_modules", "cloakbrowser", "package.json"),
        "utf8",
      );
      const parsed = JSON.parse(packageJson) as { version?: unknown };
      return typeof parsed.version === "string" ? parsed.version : null;
    } catch {
      const parentDir = path.dirname(currentDir);
      if (parentDir === currentDir) return null;
      currentDir = parentDir;
    }
  }
}

function headedDisplayAvailability(): CloakBrowserDiagnostics["headed_display"] {
  if (process.platform !== "linux") {
    return { available: true, reason: null };
  }
  if (process.env.DISPLAY || process.env.WAYLAND_DISPLAY) {
    return { available: true, reason: null };
  }
  return {
    available: false,
    reason: "No DISPLAY or WAYLAND_DISPLAY is configured for headed Linux runs",
  };
}

export async function browserProfileDiagnostics(
  profileRoot: string,
  identityByProfileDir: Map<
    string,
    Pick<
      BrowserProfileDiagnostics,
      "identity_id" | "display_name" | "workflow_id" | "workflow_name" | "last_run_at"
    >
  >,
  retainedProfileNames: Set<string>,
): Promise<BrowserProfileDiagnostics[]> {
  let entries: Array<{ name: string; isDirectory(): boolean }>;
  try {
    entries = await fs.readdir(profileRoot, { withFileTypes: true });
  } catch {
    return [];
  }
  const profiles: BrowserProfileDiagnostics[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const profileDir = entry.name;
    const fullPath = path.join(profileRoot, profileDir);
    const stat = await fs.stat(fullPath).catch(() => null);
    const identity = identityByProfileDir.get(profileDir);
    profiles.push({
      profile_dir: profileDir,
      identity_id: identity?.identity_id ?? null,
      display_name: identity?.display_name ?? null,
      workflow_id: identity?.workflow_id ?? null,
      workflow_name: identity?.workflow_name ?? null,
      approximate_size_bytes: await directorySize(fullPath),
      last_modified_at: stat?.mtime ? stat.mtime.toISOString() : null,
      last_run_at: identity?.last_run_at ?? null,
      active_session: retainedProfileNames.has(profileDir),
    });
  }
  return profiles.sort((left, right) => left.profile_dir.localeCompare(right.profile_dir));
}

type DirectorySizeLimits = {
  maxEntries: number;
  maxDepth: number;
  maxMillis: number;
};

function profileDiagnosticsSizeLimits(): DirectorySizeLimits {
  return {
    maxEntries: positiveEnvInteger("WAM_PROFILE_DIAGNOSTICS_MAX_ENTRIES", 5000),
    maxDepth: positiveEnvInteger("WAM_PROFILE_DIAGNOSTICS_MAX_DEPTH", 8),
    maxMillis: positiveEnvInteger("WAM_PROFILE_DIAGNOSTICS_MAX_MS", 100),
  };
}

function positiveEnvInteger(name: string, fallback: number) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

async function directorySize(directory: string): Promise<number> {
  const limits = profileDiagnosticsSizeLimits();
  const startedAt = Date.now();
  let total = 0;
  let visitedEntries = 0;

  const timedOut = () => Date.now() - startedAt >= limits.maxMillis;
  const visit = async (currentDirectory: string, depth: number): Promise<void> => {
    if (depth > limits.maxDepth || visitedEntries >= limits.maxEntries || timedOut()) return;
    const entries = await fs.readdir(currentDirectory, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (visitedEntries >= limits.maxEntries || timedOut()) break;
      visitedEntries += 1;
      const childPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        await visit(childPath, depth + 1);
      } else if (entry.isFile()) {
        total += (await fs.stat(childPath).catch(() => ({ size: 0 }))).size;
      }
    }
  };

  await visit(directory, 0);
  return total;
}
