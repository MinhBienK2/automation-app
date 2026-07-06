import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";

const fontsHashCache = new Map<string, string>();

export function clearFontsHashCache(): void {
  fontsHashCache.clear();
}

export async function fingerprintFontsHash(fontsDir: string | null | undefined): Promise<string | null> {
  const root = fontsDir?.trim();
  if (!root) return null;

  if (fontsHashCache.has(root)) {
    return fontsHashCache.get(root)!;
  }

  try {
    const files = await listFingerprintFontFiles(root);
    if (files.length === 0) return null;
    const hash = createHash("sha256");
    for (const file of files) {
      hash.update(file.relativePath.toLowerCase());
      hash.update("\0");
      hash.update(file.contentHash);
      hash.update("\0");
    }
    const computedHash = hash.digest("hex");
    fontsHashCache.set(root, computedHash);
    return computedHash;
  } catch {
    return null;
  }
}

async function listFingerprintFontFiles(rootDir: string) {
  const files: Array<{ relativePath: string; contentHash: string }> = [];
  const visit = async (currentDir: string) => {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      if (!entry.isFile() || !/\.(ttf|otf|woff|woff2)$/i.test(entry.name)) continue;
      const content = await fs.readFile(absolutePath);
      files.push({
        relativePath: path.relative(rootDir, absolutePath).split(path.sep).join("/"),
        contentHash: createHash("sha256").update(content).digest("hex"),
      });
    }
  };
  await visit(rootDir);
  return files.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}
