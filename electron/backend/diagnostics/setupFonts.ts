import { constants as fsConstants } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  readdir,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

export const CLOAKBROWSER_FONT_PACKAGES = [
  "fonts-noto-color-emoji",
  "fonts-freefont-ttf",
  "fonts-unifont",
  "fonts-ipafont-gothic",
  "fonts-wqy-zenhei",
  "fonts-tlwg-loma-otf",
];

const FONT_EXTENSIONS = new Set([".ttf", ".ttc", ".otf"]);

export function buildCloakBrowserFontSetupPlan(repoRoot: string) {
  const baseDir = path.join(repoRoot, ".local", "cloakbrowser-fonts");
  const debsDir = path.join(baseDir, "debs");
  const extractDir = path.join(baseDir, "extract");
  const fontsDir = path.join(baseDir, "linux");

  return {
    repoRoot,
    baseDir,
    debsDir,
    extractDir,
    fontsDir,
    packages: CLOAKBROWSER_FONT_PACKAGES,
    downloadCommand: {
      command: "apt-get",
      args: ["download", ...CLOAKBROWSER_FONT_PACKAGES],
      cwd: debsDir,
    },
    fontCacheCommand: {
      command: "fc-cache",
      args: ["-f", fontsDir],
    },
  };
}

async function runCommand(
  { command, args, cwd }: { command: string; args: string[]; cwd?: string },
  options: { stdio?: "inherit" | "pipe" | "ignore" } = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: options.stdio ?? "ignore",
    });

    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code}`));
    });
  });
}

async function commandAvailable(command: string): Promise<boolean> {
  const pathDirs = (process.env.PATH ?? "").split(path.delimiter).filter(Boolean);

  for (const pathDir of pathDirs) {
    const executablePath = path.join(pathDir, command);
    try {
      await access(executablePath, fsConstants.X_OK);
      return true;
    } catch {
      // Try the next PATH entry.
    }
  }

  return false;
}

async function listFilesRecursive(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFilesRecursive(entryPath)));
    } else if (entry.isFile()) {
      files.push(entryPath);
    }
  }

  return files;
}

async function copyFontFiles(extractDir: string, fontsDir: string): Promise<number> {
  const sourceRoot = path.join(extractDir, "usr", "share", "fonts");
  const sourceStats = await stat(sourceRoot).catch(() => null);

  if (!sourceStats?.isDirectory()) {
    throw new Error(`No fonts directory found after package extraction: ${sourceRoot}`);
  }

  const sourceFiles = await listFilesRecursive(sourceRoot);
  const fontFiles = sourceFiles.filter((filePath) =>
    FONT_EXTENSIONS.has(path.extname(filePath).toLowerCase())
  );

  for (const fontFile of fontFiles) {
    await copyFile(fontFile, path.join(fontsDir, path.basename(fontFile)));
  }

  return fontFiles.length;
}

async function writeGeneratedReadme(
  plan: ReturnType<typeof buildCloakBrowserFontSetupPlan>,
  copiedFontCount: number
): Promise<void> {
  const readme = `# CloakBrowser Linux Fonts

This directory is generated automatically on app startup.

Use this path in Workflow Settings -> Browser Launch -> Fingerprint fonts directory:

\`\`\`text
${plan.fontsDir}
\`\`\`

Source packages:

${plan.packages.map((packageName) => `- ${packageName}`).join("\n")}

Copied font files: ${copiedFontCount}
`;

  await writeFile(path.join(plan.baseDir, "README.md"), readme);
}

export async function areFontsAlreadySetup(repoRoot: string): Promise<boolean> {
  const fontsDir = path.join(repoRoot, ".local", "cloakbrowser-fonts", "linux");
  try {
    const s = await stat(fontsDir);
    if (!s.isDirectory()) return false;
    const files = await readdir(fontsDir);
    const fontFiles = files.filter((f) => {
      const ext = path.extname(f).toLowerCase();
      return ext === ".ttf" || ext === ".ttc" || ext === ".otf";
    });
    return fontFiles.length > 0;
  } catch {
    return false;
  }
}

export async function setupCloakBrowserFonts({
  repoRoot,
  runner = runCommand,
  log = console.log,
  commandAvailable: probe = commandAvailable,
}: {
  repoRoot: string;
  runner?: typeof runCommand;
  log?: (message: string) => void;
  commandAvailable?: (command: string) => Promise<boolean>;
}): Promise<void> {
  if (process.platform !== "linux") {
    throw new Error("CloakBrowser Linux font setup is only supported on Linux hosts.");
  }

  const plan = buildCloakBrowserFontSetupPlan(repoRoot);

  if (!(await probe("apt-get"))) {
    throw new Error("apt-get is required to download Ubuntu font packages.");
  }

  if (!(await probe("dpkg-deb"))) {
    throw new Error("dpkg-deb is required to extract downloaded font packages.");
  }

  await rm(plan.debsDir, { recursive: true, force: true });
  await rm(plan.extractDir, { recursive: true, force: true });
  await rm(plan.fontsDir, { recursive: true, force: true });
  await mkdir(plan.debsDir, { recursive: true });
  await mkdir(plan.extractDir, { recursive: true });
  await mkdir(plan.fontsDir, { recursive: true });

  log(`Downloading CloakBrowser Linux font packages into ${plan.debsDir}`);
  await runner(plan.downloadCommand);

  const debFiles = (await readdir(plan.debsDir))
    .filter((fileName) => fileName.endsWith(".deb"))
    .sort();

  if (debFiles.length === 0) {
    throw new Error(`No .deb files were downloaded into ${plan.debsDir}`);
  }

  for (const debFile of debFiles) {
    await runner({
      command: "dpkg-deb",
      args: ["-x", path.join(plan.debsDir, debFile), plan.extractDir],
    });
  }

  const copiedFontCount = await copyFontFiles(plan.extractDir, plan.fontsDir);

  if (copiedFontCount === 0) {
    throw new Error(`No font files were copied into ${plan.fontsDir}`);
  }

  if (await commandAvailable("fc-cache")) {
    await runner(plan.fontCacheCommand);
  } else {
    log("fc-cache was not found; skipping fontconfig cache refresh.");
  }

  await writeGeneratedReadme(plan, copiedFontCount);
  log(`CloakBrowser fonts ready: ${plan.fontsDir}`);
}
